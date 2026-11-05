import { UserRole } from '../value-object/user-role.vo';

export const TOKEN_ISSUER = 'TOKEN_ISSUER';

export interface AuthSubject {
  userId: number;
  role: UserRole;
  email: string;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  /** Giay */
  expiresIn: number;
}

export interface TokenClaims {
  userId: number;
  role: UserRole;
  email: string;
  /** 'access' | 'refresh' */
  type: 'access' | 'refresh';
}

export interface ITokenIssuer {
  issueTokens(subject: AuthSubject): Promise<IssuedTokens>;
  verifyAccessToken(rawToken: string): Promise<TokenClaims>;
  verifyRefreshToken(rawToken: string): Promise<TokenClaims>;
  hashToken(rawToken: string): string;
}
