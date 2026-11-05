import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { IPasswordHasher } from '../../domain/port/password-hasher.port';

const BCRYPT_PREFIX_LENGTH = 2;
const BCRYPT_VERSION_LENGTH = 3;

@Injectable()
export class BcryptPasswordHasher implements IPasswordHasher {
  private readonly saltRounds: number;

  constructor(config: ConfigService) {
    this.saltRounds = Number(config.get('BCRYPT_SALT_ROUNDS', 10));
  }

  async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.saltRounds);
  }

  async verify(plain: string, hash: string): Promise<boolean> {
    if (!hash) {
      return false;
    }
    return bcrypt.compare(plain, hash);
  }

  /** Cho phep nang cost factor khi cau hinh doi (FR-16). */
  needsRehash(hash: string): boolean {
    const cost = Number(hash.slice(BCRYPT_PREFIX_LENGTH, BCRYPT_VERSION_LENGTH));
    return !Number.isFinite(cost) || cost < this.saltRounds;
  }
}
