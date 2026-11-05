import { Inject, Injectable } from '@nestjs/common';
import { BookingSlot } from '../../../domain/model/booking-slot.entity';
import { Court } from '../../../domain/model/court.entity';
import { ICourtRepository, COURT_REPOSITORY } from '../../../domain/port/court.repository.port';
import { ISlotRepository, SLOT_REPOSITORY } from '../../../domain/port/slot.repository.port';
import { SlotStatus } from '../../../domain/value-object/slot-status.vo';

export interface AvailabilityInput {
  date: string;
  city?: string;
  clusterId?: number;
  courtId?: number;
  courtType?: string;
  timeFrom?: string;
  timeTo?: string;
}

export interface SlotView {
  slotId: number;
  courtId: number;
  startTime: string;
  endTime: string;
  /** AVAILABLE | LOCKED | EXPIRING: slot bi giu boi user khac con thoi gian. */
  availability: 'AVAILABLE' | 'HELD';
  /** Con bao nhieu giay neu slot dang bi giu (lazy release, muc 4.7.1). */
  holdRemainingSeconds: number;
}

export interface CourtAvailabilityView {
  courtId: number;
  courtName: string;
  courtType: string;
  clusterId: number;
  clusterName: string;
  city: string;
  slots: SlotView[];
  availableCount: number;
}

/** FR-01: tra cuu san trong theo thoi gian thuc. */
@Injectable()
export class SearchAvailabilityUseCase {
  constructor(
    @Inject(SLOT_REPOSITORY) private readonly slots: ISlotRepository,
    @Inject(COURT_REPOSITORY) private readonly courts: ICourtRepository,
  ) {}

  async execute(input: AvailabilityInput): Promise<CourtAvailabilityView[]> {
    const now = new Date();
    const courtRows = await this.courts.findCourts({
      city: input.city,
      clusterId: input.clusterId,
      courtType: input.courtType,
      bookableOnly: true,
    });
    if (input.courtId !== undefined) {
      courtRows.length = 0;
      const single = await this.courts.findCourtById(input.courtId);
      if (single) {
        courtRows.push(single);
      }
    }
    if (courtRows.length === 0) {
      return [];
    }

    const courtIds = courtRows.map((court) => court.courtId);
    // Tao slot cho ngay neu chua co (idempotent, duoc goi lazy khi co luu tra).
    await this.slots.ensureSlotsExist(courtIds, input.date);

    const foundSlots = await this.slots.search(
      {
        date: input.date,
        city: input.city,
        clusterId: input.clusterId,
        courtId: input.courtId,
        courtType: input.courtType as never,
        timeFrom: input.timeFrom,
        timeTo: input.timeTo,
      },
      now,
    );

    const grouped = new Map<number, SlotView[]>();
    for (const slot of foundSlots) {
      const list = grouped.get(slot.courtId) ?? [];
      list.push(toSlotView(slot, now));
      grouped.set(slot.courtId, list);
    }

    

    return courtRows
      .filter((court) => grouped.has(court.courtId))
      .map((court) => {
        const slotsForCourt = grouped.get(court.courtId) as SlotView[];
        return {
          courtId: court.courtId,
          courtName: court.name,
          courtType: court.courtType,
          clusterId: court.clusterId,
          clusterName: court.clusterName,
          city: court.city,
          slots: slotsForCourt,
          availableCount: slotsForCourt.filter((s) => s.availability === 'AVAILABLE').length,
        };
      });
  }
}

function toSlotView(slot: BookingSlot, now: Date): SlotView {
  const held = slot.status === SlotStatus.LOCKED && !slot.isLockExpiredAt(now);
  return {
    slotId: slot.slotId,
    courtId: slot.courtId,
    startTime: slot.startTime.toISOString(),
    endTime: slot.endTime.toISOString(),
    availability: held ? 'HELD' : 'AVAILABLE',
    holdRemainingSeconds: held ? slot.remainingLockSeconds(now) : 0,
  };
}

