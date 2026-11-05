import { Inject, Injectable } from '@nestjs/common';
import { User, normalizeEmail, normalizePhone } from '../../../domain/model/user.entity';
import { DomainError, DomainErrorCode } from '../../../domain/error/domain.error';
import { IUserRepository, USER_REPOSITORY } from '../../../domain/port/user.repository.port';
import {
  IPasswordHasher,
  PASSWORD_HASHER,
} from '../../../domain/port/password-hasher.port';
import { ITokenIssuer, TOKEN_ISSUER } from '../../../domain/port/token-issuer.port';
import { UserRole } from '../../../domain/value-object/user-role.vo';
import { AuthResult, toSafeUser } from '../../serialization/safe-user';

export interface RegisterInput {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  /** Chi Admin moi duoc chi dinh role khi tao tai khoan (FR-16). */
  role?: UserRole;
  requestedBy?: User;
}

/** FR-16: dang ky tai khoan + dang nhap ngay sau do (JWT). */
@Injectable()
export class RegisterUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: IPasswordHasher,
    @Inject(TOKEN_ISSUER) private readonly tokens: ITokenIssuer,
  ) {}

  async execute(input: RegisterInput): Promise<AuthResult> {
    const email = normalizeEmail(input.email);
    const phone = normalizePhone(input.phoneNumber);

    if (await this.users.existsByEmail(email)) {
      throw new DomainError(DomainErrorCode.EMAIL_ALREADY_EXISTS, 'Email da duoc su dung');
    }
    if (await this.users.existsByPhone(phone)) {
      throw new DomainError(DomainErrorCode.PHONE_ALREADY_EXISTS, 'So dien thoai da duoc su dung');
    }

    const privileged = input.requestedBy?.isAdmin() ?? false;
    const role = privileged && input.role !== undefined ? input.role : UserRole.CUSTOMER;

    const passwordHash = await this.hasher.hash(input.password);
    const user = await this.users.save(
      User.register({
        fullName: input.fullName,
        email,
        phoneNumber: phone,
        passwordHash,
        role,
      }),
    );

    const tokens = await this.tokens.issueTokens({
      userId: user.userId,
      role: user.role,
      email: user.email,
    });
    // Neu khong luu hash thi RefreshSessionUseCase coi token hop le la token dung lai (rotation).
    user.rotateRefreshToken(this.tokens.hashToken(tokens.refreshToken));
    await this.users.save(user);
    return { user: toSafeUser(user), tokens };
  }
}
