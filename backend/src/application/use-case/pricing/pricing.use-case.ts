import { Inject, Injectable } from '@nestjs/common';
import {
  DomainError,
  DomainErrorCode,
  ForbiddenError,
  NotFoundDomainError,
} from '../../../domain/error/domain.error';
import { COURT_REPOSITORY, ICourtRepository } from '../../../domain/port/court.repository.port';
import {
  CreateRuleData,
  DayType,
  IPricingRepository,
  PRICING_REPOSITORY,
  PricingRule,
} from '../../../domain/port/pricing.repository.port';
import { calculatePrice } from '../../../domain/service/pricing-engine';
import { UserRole } from '../../../domain/value-object/user-role.vo';

export interface Requester {
  userId: number;
  role: UserRole;
}

export interface PriceQuote {
  courtId: number;
  date: string;
  startTime: string;
  endTime: string;
  dayType: DayType;
  totalAmount: number;
  currency: string;
}

/** Chu san cau hinh bang gia cho cum san cua minh. */
@Injectable()
export class ManagePricingUseCase {
  constructor(
    @Inject(PRICING_REPOSITORY) private readonly pricing: IPricingRepository,
    @Inject(COURT_REPOSITORY) private readonly courts: ICourtRepository,
  ) {}

  async listRules(requester: Requester, clusterId: number): Promise<PricingRule[]> {
    await this.checkOwner(requester, clusterId);
    return this.pricing.findRules(clusterId);
  }

  async createRule(requester: Requester, data: CreateRuleData): Promise<PricingRule> {
    await this.checkOwner(requester, data.clusterId);
    if (data.endTime <= data.startTime) {
      throw new DomainError(DomainErrorCode.INVALID_INPUT, 'Gio ket thuc phai sau gio bat dau');
    }
    return this.pricing.createRule(data);
  }

  async deleteRule(requester: Requester, ruleId: number): Promise<void> {
    const rule = await this.pricing.findRuleById(ruleId);
    if (rule === null) {
      throw new NotFoundDomainError(DomainErrorCode.PRICING_RULE_NOT_FOUND, 'Khong tim thay bang gia');
    }
    await this.checkOwner(requester, rule.clusterId);
    await this.pricing.deleteRule(ruleId);
  }

  private async checkOwner(requester: Requester, clusterId: number): Promise<void> {
    const cluster = await this.courts.findClusterById(clusterId);
    if (cluster === null) {
      throw new NotFoundDomainError(DomainErrorCode.CLUSTER_NOT_FOUND, 'Khong tim thay cum san');
    }
    if (requester.role !== UserRole.ADMIN && cluster.ownerId !== requester.userId) {
      throw new ForbiddenError('Ban khong phai chu cua cum san nay');
    }
  }
}

/** Tinh tien cho san + ngay + gio. Thanh vien 1 se goi ham nay khi dat san. */
@Injectable()
export class QuotePriceUseCase {
  constructor(
    @Inject(PRICING_REPOSITORY) private readonly pricing: IPricingRepository,
    @Inject(COURT_REPOSITORY) private readonly courts: ICourtRepository,
  ) {}

  async execute(input: {
    courtId: number;
    date: string;
    startTime: string;
    endTime: string;
  }): Promise<PriceQuote> {
    const court = await this.courts.findCourtById(input.courtId);
    if (court === null) {
      throw new NotFoundDomainError(DomainErrorCode.COURT_NOT_FOUND, 'Khong tim thay san');
    }
    if (input.endTime <= input.startTime) {
      throw new DomainError(DomainErrorCode.INVALID_INPUT, 'Gio ket thuc phai sau gio bat dau');
    }

    const weekday = new Date(`${input.date}T00:00:00`).getDay();
    const dayType: DayType = (await this.pricing.isHoliday(input.date))
      ? 'HOLIDAY'
      : weekday === 0 || weekday === 6
        ? 'WEEKEND'
        : 'WEEKDAY';

    const rules = await this.pricing.findRules(court.clusterId);
    const total = calculatePrice(rules, dayType, court.courtType, input.startTime, input.endTime);
    if (total === null) {
      throw new DomainError(
        DomainErrorCode.INVALID_INPUT,
        'Chua co bang gia cho khung gio nay, chu san can cau hinh them',
      );
    }
    return {
      courtId: court.courtId,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      dayType,
      totalAmount: total,
      currency: 'VND',
    };
  }
}