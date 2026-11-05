import { ClusterStatus, CourtType } from '../value-object/court-type.vo';

/**
 * Reference data cua Court & Pricing Context (Thanh vien 2 so huu ghi).
 * Booking Context chi doc: can danh sach san va trang thai duyet cum san (FR-15)
 * de loc slot hien thi cho khach.
 */
export class CourtCluster {
  clusterId!: number;
  name!: string;
  address!: string;
  city!: string;
  ownerId!: number;
  status!: ClusterStatus;
  isActive!: boolean;
  courts!: Court[];

  isBookable(): boolean {
    return this.isActive && this.status === ClusterStatus.APPROVED;
  }
}

export class Court {
  courtId!: number;
  clusterId!: number;
  name!: string;
  courtType!: CourtType;
  isActive!: boolean;
  /** Khoi tao slot tu cac gia tri nay; gia linh hoat do Pricing Engine xu ly. */
  openingTime!: string;
  closingTime!: string;
  slotDurationMinutes!: number;
  /** Duoc nap tu join cluster de UI hien thi "San 3 - Pickleball Ha Dong". */
  clusterName!: string;
  city!: string;

  constructor(
    courtId = 0,
    clusterId = 0,
    name = '',
    courtType: CourtType = CourtType.OUTDOOR,
    isActive = true,
    openingTime = '06:00',
    closingTime = '22:00',
    slotDurationMinutes = 60,
  ) {
    this.courtId = courtId;
    this.clusterId = clusterId;
    this.name = name;
    this.courtType = courtType;
    this.isActive = isActive;
    this.openingTime = openingTime;
    this.closingTime = closingTime;
    this.slotDurationMinutes = slotDurationMinutes;
  }
}
