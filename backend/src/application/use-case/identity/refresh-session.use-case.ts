import { Inject, Injectable } from '@nestjs/common';
import { DomainError, DomainErrorCode } from '../../../domain/error/domain.error';
import { IUserRepository, USER_REPOSITORY } from '../../../domain/port/user.repository.port';
import { ITokenIssuer, TOKEN_ISSUER } from '../../../domain/port/token-issuer.port';
import { AuthResult, toSafeUser } from '../../serialization/safe-user';

/**
 * Refresh token rotation (NFR-03). Token cu bi thu hoi sau khi dung mot lan;
 * neu phat hien token da dung lai (hash trong DB khong khop) thi thu hoi ca phien.
 */
@Injectable()
export class RefreshSessionUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(TOKEN_ISSUER) private readonly tokens: ITokenIssuer,
  ) {}

  async execute(refreshToken: string): Promise<AuthResult> {
    const claims = await this.tokens.verifyRefreshToken(refreshToken);
    const user = await this.users.findById(claims.userId);
    if (user === null || !user.isActive) {
      throw new DomainError(DomainErrorCode.USER_NOT_FOUND, 'Tai khoan khong ton tai');
    }
    const incomingHash = this.tokens.hashToken(refreshToken);
    if (user.refreshTokenHash !== incomingHash) {
      user.rotateRefreshToken(null);
      await this.users.save(user);
      throw new DomainError(
        DomainErrorCode.INVALID_TOKEN,
        'Phat hien refresh token bi dung lai - da thu hoi toan bo phien',
      );
    }

    const tokens = await this.tokens.issueTokens({
      userId: user.userId,
      role: user.role,
      email: user.email,
    });
    user.rotateRefreshToken(this.tokens.hashToken(tokens.refreshToken));
    await this.users.save(user);

    return { user: toSafeUser(user), tokens };
  }
}
