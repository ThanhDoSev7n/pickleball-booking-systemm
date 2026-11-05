import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole } from '../../../../domain/value-object/user-role.vo';

/**
 * Adapter persistence cho Identity Context.
 * Bang/cot/ten rang buoc dat theo muc 2.2.4 va duoc tao that boi database/schema.sql
 * (DB_SYNCHRONIZE=false) de giu nguyen ten uk_/idx_/fk_ trong bao cao SADD.
 */
@Entity('users')
export class UserSchema {
  @PrimaryGeneratedColumn({ name: 'user_id', type: 'int', unsigned: true })
  userId!: number;

  @Column({ name: 'full_name', type: 'varchar', length: 120 })
  fullName!: string;

  @Column({ type: 'varchar', length: 160 })
  email!: string;

  @Column({ name: 'phone_number', type: 'varchar', length: 15 })
  phoneNumber!: string;

  /** select:false ngan passwordHash ri ro ra ngoai khi vo tinh findOne(). */
  @Column({ name: 'password_hash', type: 'varchar', length: 100, select: false })
  passwordHash!: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.CUSTOMER })
  role!: UserRole;

  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 1 })
  isActive!: boolean;

  @Column({
    name: 'refresh_token_hash',
    type: 'char',
    length: 64,
    nullable: true,
    select: false,
  })
  refreshTokenHash!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;
}
