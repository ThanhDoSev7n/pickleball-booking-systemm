import { createHash, randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  AuthSubject,
  ITokenIssuer,
  IssuedTokens,
  TokenClaims,
} from '../../domain/port/token-issuer.port';

const ACCESS_TOKEN_TYPE = 'access';
const REFRESH_TOKEN_TYPE = 'refresh';
const DEFAULT_TTL_SECONDS = 900;
const UNIT_TO_SECONDS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86_400,
  w: 604_800,
};

/**
 * ADR-003: JWT stateless + RBAC.
 * Refresh token dang opaque (jti ngau nhien) duoc luu hash SHA-256 trong users.refresh_token_hash
 * de co the thu hoi (rotation) khi phat hien leak - NFR-03.
 */
@Injectable()
export class JwtTokenIssuer implements ITokenIssuer {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async issueTokens(subject: AuthSubject): Promise<IssuedTokens> {
    const payload = { sub: subject.userId, role: subject.role, email: subject.email };
    const accessTtl = ttlSeconds(this.config.get<string>('JWT_TTL', '15m'));
    const refreshTtl = ttlSeconds(this.config.get<string>('JWT_REFRESH_TTL', '7d'));
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync({ ...payload, typ: ACCESS_TOKEN_TYPE }, { expiresIn: accessTtl }),
      this.jwt.signAsync(
        { ...payload, typ: REFRESH_TOKEN_TYPE, jti: randomUUID() },
        { expiresIn: refreshTtl },
      ),
    ]);
    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: accessTtl,
    };
  }

  async verifyAccessToken(rawToken: string): Promise<TokenClaims> {
    return this.verify(rawToken, ACCESS_TOKEN_TYPE);
  }

  async verifyRefreshToken(rawToken: string): Promise<TokenClaims> {
    return this.verify(rawToken, REFRESH_TOKEN_TYPE);
  }

  hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private async verify(rawToken: string, expectedType: string): Promise<TokenClaims> {
    let payload: Record<string, unknown>;
    try {
      payload = await this.jwt.verifyAsync<Record<string, unknown>>(rawToken);
    } catch {
      throw new UnauthorizedException('Token khong hop le hoac da het han');
    }
    if (payload['typ'] !== expectedType) {
      throw new UnauthorizedException('Loai token khong dung');
    }
    return {
      userId: Number(payload['sub']),
      role: payload['role'] as TokenClaims['role'],
      email: String(payload['email'] ?? ''),
      type: expectedType as TokenClaims['type'],
    };
  }
}

/** '15m' | '7d' | '30s' | 900 -> so giay. */
export function ttlSeconds(value: string | number | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.trunc(value);
  }
  const raw = (value ?? '').toString().trim();
  const match = /^(\d+)\s*([smhdw])?$/i.exec(raw);
  if (match === null) {
    return DEFAULT_TTL_SECONDS;
  }
  const unit = (match[2] ?? 's').toLowerCase();
  return Number(match[1]) * UNIT_TO_SECONDS[unit];
}
