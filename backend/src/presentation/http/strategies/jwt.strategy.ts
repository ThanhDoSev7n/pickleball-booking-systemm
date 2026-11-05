import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { ITokenIssuer, TOKEN_ISSUER } from '../../../domain/port/token-issuer.port';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

const BEARER_PREFIX_LENGTH = 7;

/**
 * ADR-003: moi request duoc xac thuc bang access token stateless (khong co session).
 * Ten strategy 'jwt' duoc AuthGuard('jwt') tim trong passport registry.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    @Inject(TOKEN_ISSUER) private readonly issuer: ITokenIssuer,
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
    return { userId: claims.userId, role: claims.role, email: claims.email };
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
