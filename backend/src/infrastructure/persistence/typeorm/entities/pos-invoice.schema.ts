import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('pos_invoices')
export class PosInvoiceSchema {
  @PrimaryGeneratedColumn({ name: 'invoice_id', type: 'int', unsigned: true }) invoiceId!: number;
  @Column({ name: 'invoice_code', type: 'varchar', length: 32 }) invoiceCode!: string;
  @Column({ name: 'booking_id', type: 'int', unsigned: true }) bookingId!: number;
  @Column({ name: 'staff_user_id', type: 'int', unsigned: true }) staffUserId!: number;
  @Column({ name: 'cluster_id', type: 'int', unsigned: true }) clusterId!: number;
  @Column({ type: 'decimal', precision: 12, scale: 2 }) total!: string;
  @Column({ name: 'court_amount', type: 'decimal', precision: 12, scale: 2 }) courtAmount!: string;
  @Column({ name: 'payment_method', type: 'enum', enum: ['CASH', 'CARD', 'TRANSFER'] }) paymentMethod!: string;
  @CreateDateColumn({ name: 'created_at', type: 'datetime' }) createdAt!: Date;
}

@Entity('pos_invoice_items')
export class PosInvoiceItemSchema {
  @PrimaryGeneratedColumn({ name: 'item_id', type: 'int', unsigned: true }) itemId!: number;
  @Column({ name: 'invoice_id', type: 'int', unsigned: true }) invoiceId!: number;
  @Column({ name: 'service_id', type: 'int', unsigned: true }) serviceId!: number;
  @Column({ name: 'service_name', type: 'varchar', length: 120 }) serviceName!: string;
  @Column({ type: 'int', unsigned: true }) quantity!: number;
  @Column({ name: 'unit_price', type: 'decimal', precision: 12, scale: 2 }) unitPrice!: string;
  @Column({ type: 'decimal', precision: 12, scale: 2 }) subtotal!: string;
}
