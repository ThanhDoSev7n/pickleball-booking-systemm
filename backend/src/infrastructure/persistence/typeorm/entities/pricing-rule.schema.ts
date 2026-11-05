import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { CourtType } from '../../../../domain/value-object/court-type.vo';

@Entity('pricing_rules')
export class PricingRuleSchema {
  @PrimaryGeneratedColumn({ name: 'rule_id', type: 'int', unsigned: true })
  ruleId!: number;

  @Column({ name: 'cluster_id', type: 'int', unsigned: true })
  clusterId!: number;

  @Column({ name: 'court_type', type: 'enum', enum: CourtType, nullable: true })
  courtType!: CourtType | null;

  @Column({ name: 'day_type', type: 'enum', enum: ['WEEKDAY', 'WEEKEND', 'HOLIDAY'] })
  dayType!: 'WEEKDAY' | 'WEEKEND' | 'HOLIDAY';

  @Column({ name: 'start_time', type: 'time' })
  startTime!: string;

  @Column({ name: 'end_time', type: 'time' })
  endTime!: string;

  @Column({
    name: 'price_per_hour',
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: { to: (v: number) => v, from: (v: string) => Number(v) },
  })
  pricePerHour!: number;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;
}