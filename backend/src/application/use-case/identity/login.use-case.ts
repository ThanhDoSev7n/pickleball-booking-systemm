import { Inject, Injectable } from '@nestjs/common';
import { DomainError, DomainErrorCode } from '../../../domain/error/domain.error';
import { User } from '../../../domain/model/user.entity';
import {
  IPasswordHasher,
  PASSWORD_HASHER,
} from '../../../domain/port/password-hasher.port';
import { IUserRepository, USER_REPOSITORY } from '../../../domain/port/user.repository.port';
import { ITokenIssuer, TOKEN_ISSUER } from '../../../domain/port/token-issuer.port';
import { normalizeEmail } from '../../../domain/model/user.entity';
import { AuthResult, toSafeUser } from '../../serialization/safe-user';

export interface LoginInput {
  email: string;
  password: string;
}

/**
 * FR-16 dang nhap. Tra ve INVALID_CREDENTIALS chung cho sai email hoac sai mat khau
 * de tranh user enumeration (NFR-03 / OWASP A07).
 */
@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: IPasswordHasher,
    @Inject(TOKEN_ISSUER) private readonly tokens: ITokenIssuer,
  ) {}

  async execute(input: LoginInput): Promise<AuthResult> {
    const user = await this.users.findByEmail(normalizeEmail(input.email));
    if (user === null) {
      throw new DomainError(DomainErrorCode.INVALID_CREDENTIALS, 'Email hoac mat khau khong dung');
    }
    if (!user.isActive) {
      throw new DomainError(DomainErrorCode.FORBIDDEN, 'Tai khoan da bi khoa');
    }
    if (!(await this.hasher.verify(input.password, user.passwordHash))) {
      throw new DomainError(DomainErrorCode.INVALID_CREDENTIALS, 'Email hoac mat khau khong dung');
    }

    return {
      user: toSafeUser(user),
      tokens: await this.issueAndPersistRefresh(user),
    };
  }

  private async issueAndPersistRefresh(user: User) {
    const tokens = await this.tokens.issueTokens({
      userId: user.userId,
      role: user.role,
      email: user.email,
    });
    user.rotateRefreshToken(this.tokens.hashToken(tokens.refreshToken));
    await this.users.save(user);
    return tokens;
  }
}
