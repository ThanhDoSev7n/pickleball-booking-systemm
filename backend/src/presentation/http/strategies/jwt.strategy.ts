import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { ITokenIssuer, TOKEN_ISSUER } from '../../../domain/port/token-issuer.port';
import { IUserRepository, USER_REPOSITORY } from '../../../domain/port/user.repository.port';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

const BEARER_PREFIX_LENGTH = 7;

/**
 * Moi request xac thuc token va tai lai role/trang thai de thu hoi quyen ngay khi Admin doi.
 * Ten strategy 'jwt' duoc AuthGuard('jwt') tim trong passport registry.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    @Inject(TOKEN_ISSUER) private readonly issuer: ITokenIssuer,
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    config: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: readSecret(config),
      passReqToCallback: true,
    });
  }

  /**
   * Passport da kiem chu ky, nhung verifyAccessToken con chan `typ === 'access'`:
   * neu khong thi refresh token (han 7 ngay) dung duoc nhu access token (han 15 phut).
   */
  async validate(request: Request): Promise<AuthenticatedUser> {
    const rawToken = extractRawToken(request);
    const claims = await this.issuer.verifyAccessToken(rawToken);
    const user = await this.users.findById(claims.userId);
    if (user === null || !user.isActive) {
      throw new UnauthorizedException('Tài khoản không còn hoạt động');
    }
    // Dung role hien tai de thay doi vai tro/vo hieu hoa tai khoan co hieu luc ngay,
    // khong phu thuoc vao thoi han con lai cua access token cu.
    return { userId: user.userId, role: user.role, email: user.email };
  }
}

function readSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_SECRET');
  if (!secret) {
    throw new Error('Thieu JWT_SECRET trong .env');
  }
  return secret;
}

function extractRawToken(request: Request): string {
  const header = request.headers['authorization'] ?? '';
  const raw = header.startsWith('Bearer ') ? header.slice(BEARER_PREFIX_LENGTH).trim() : '';
  if (raw === '') {
    throw new UnauthorizedException('Thieu access token trong header Authorization');
  }
  return raw;
}
