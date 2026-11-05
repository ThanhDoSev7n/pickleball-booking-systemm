import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  CreateRuleData,
  IPricingRepository,
  PricingRule,
} from '../../../../domain/port/pricing.repository.port';
import { CourtType } from '../../../../domain/value-object/court-type.vo';
import { PricingRuleSchema } from '../entities/pricing-rule.schema';

function toRule(row: PricingRuleSchema): PricingRule {
  return {
    ruleId: row.ruleId,
    clusterId: row.clusterId,
    courtType: row.courtType,
    dayType: row.dayType,
    startTime: row.startTime.slice(0, 5),
    endTime: row.endTime.slice(0, 5),
    pricePerHour: row.pricePerHour,
  };
}

@Injectable()
export class TypeOrmPricingRepository implements IPricingRepository {
  constructor(private readonly dataSource: DataSource) {}

  private get repo() {
    return this.dataSource.getRepository(PricingRuleSchema);
  }

  async findRules(clusterId: number): Promise<PricingRule[]> {
    const rows = await this.repo.find({ where: { clusterId }, order: { startTime: 'ASC' } });
    return rows.map(toRule);
  }

  async findRuleById(ruleId: number): Promise<PricingRule | null> {
    const row = await this.repo.findOne({ where: { ruleId } });
    return row ? toRule(row) : null;
  }

  async createRule(data: CreateRuleData): Promise<PricingRule> {
    const saved = await this.repo.save(
      this.repo.create({
        clusterId: data.clusterId,
        courtType: (data.courtType as CourtType | null | undefined) ?? null,
        dayType: data.dayType,
        startTime: data.startTime,
        endTime: data.endTime,
        pricePerHour: data.pricePerHour,
      }),
    );
    return toRule(saved);
  }

  async deleteRule(ruleId: number): Promise<void> {
    await this.repo.delete(ruleId);
  }

  async isHoliday(date: string): Promise<boolean> {
    const rows: unknown[] = await this.dataSource.query(
      'SELECT 1 FROM holidays WHERE holiday_date = ? LIMIT 1',
      [date],
    );
    return rows.length > 0;
  }
}