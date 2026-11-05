export const PRICING_REPOSITORY = 'PRICING_REPOSITORY';

export type DayType = 'WEEKDAY' | 'WEEKEND' | 'HOLIDAY';

export interface PricingRule {
  ruleId: number;
  clusterId: number;
  courtType: string | null;
  dayType: DayType;
  startTime: string;
  endTime: string;
  pricePerHour: number;
}

export interface CreateRuleData {
  clusterId: number;
  courtType?: string | null;
  dayType: DayType;
  startTime: string;
  endTime: string;
  pricePerHour: number;
}

export interface IPricingRepository {
  findRules(clusterId: number): Promise<PricingRule[]>;
  findRuleById(ruleId: number): Promise<PricingRule | null>;
  createRule(data: CreateRuleData): Promise<PricingRule>;
  deleteRule(ruleId: number): Promise<void>;
  isHoliday(date: string): Promise<boolean>;
}