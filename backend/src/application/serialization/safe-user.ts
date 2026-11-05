import { User } from '../../domain/model/user.entity';
import { IssuedTokens } from '../../domain/port/token-issuer.port';
import { UserRole } from '../../domain/value-object/user-role.vo';

/** DTO output o tang application - khong bao gio bao gam passwordHash. */
export interface SafeUser {
  userId: number;
  fullName: string;
  email: string;
  phoneNumber: string;
  role: UserRole;
  isActive: boolean;
}

export interface AuthResult {
  user: SafeUser;
  tokens: IssuedTokens;
}

export function toSafeUser(user: User): SafeUser {
  return {
    userId: user.userId,
    fullName: user.fullName,
    email: user.email,
    phoneNumber: user.phoneNumber,
    role: user.role,
    isActive: user.isActive,
  };
}
