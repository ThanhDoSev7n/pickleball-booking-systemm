import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from '../../../../domain/model/user.entity';
import { IUserRepository } from '../../../../domain/port/user.repository.port';
import { UserSchema } from '../entities/user.schema';
import { blankUserRow, toDomainUser, toSchemaUser } from '../entity-mapper';
import { normalizeEmail, normalizePhone } from '../../../../domain/model/user.entity';

@Injectable()
export class TypeOrmUserRepository implements IUserRepository {
  constructor(private readonly dataSource: DataSource) {}

  async save(user: User): Promise<User> {
    const existing = user.userId
      ? await this.dataSource.manager.findOne(UserSchema, { where: { userId: user.userId } })
      : null;
    const row = toSchemaUser(user, existing ?? blankUserRow());
    const saved = await this.dataSource.manager.save(UserSchema, row);
    return toDomainUser(saved);
  }

  async findById(userId: number): Promise<User | null> {
    // RefreshSessionUseCase can doc refreshTokenHash de phat hien token bi dung lai,
    // chi select rieng cot do - passwordHash van duoc git kin o tang persistence.
    const row = await this.dataSource.manager
      .createQueryBuilder(UserSchema, 'user')
      .addSelect('user.refreshTokenHash')
      .where('user.userId = :userId', { userId })
      .getOne();
    return row ? toDomainUser(row) : null;
  }

  /** findOne duoc goi voi select explicit vi passwordHash dat select:false. */
  async findByEmail(email: string): Promise<User | null> {
    const row = await this.dataSource.manager
      .createQueryBuilder(UserSchema, 'user')
      // addSelect dung ten property (khong phai ten cot) thi TypeORM moi map duoc vao entity.
      .addSelect(['user.passwordHash', 'user.refreshTokenHash'])
      .where('user.email = :email', { email: normalizeEmail(email) })
      .getOne();
    return row ? toDomainUser(row) : null;
  }

  async findByPhone(phone: string): Promise<User | null> {
    const row = await this.dataSource.manager
      .createQueryBuilder(UserSchema, 'user')
      .where('user.phone_number = :phone', { phone: normalizePhone(phone) })
      .getOne();
    return row ? toDomainUser(row) : null;
  }

  async existsByEmail(email: string): Promise<boolean> {
    return this.dataSource.manager.exists(UserSchema, {
      where: { email: normalizeEmail(email) },
    });
  }

  async existsByPhone(phone: string): Promise<boolean> {
    return this.dataSource.manager.exists(UserSchema, {
      where: { phoneNumber: normalizePhone(phone) },
    });
  }

  async listAll(): Promise<User[]> {
    const rows = await this.dataSource.manager.find(UserSchema, { order: { userId: 'ASC' } });
    return rows.map(toDomainUser);
  }
}
