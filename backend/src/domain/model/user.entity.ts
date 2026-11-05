import { UserRole } from '../value-object/user-role.vo';

/**
 * Aggregate root Identity Context (ADR-003).
 * passwordHash khong bao gio duoc dua ra ngoai qua DTO - location cua no chi la entity nay.
 */
export class User {
  userId!: number;
  fullName!: string;
  email!: string;
  phoneNumber!: string;
  passwordHash!: string;
  role!: UserRole;
  isActive!: boolean;
  refreshTokenHash!: string | null;
  createdAt!: Date;
  updatedAt!: Date;

  static register(props: {
    fullName: string;
    email: string;
    phoneNumber: string;
    passwordHash: string;
    role?: UserRole;
  }): User {
    const user = new User();
    user.fullName = props.fullName.trim();
    user.email = normalizeEmail(props.email);
    user.phoneNumber = normalizePhone(props.phoneNumber);
    user.passwordHash = props.passwordHash;
    // Registration cong khai chi tao duoc CUSTOMER. Cac role khac do Admin/Owner cap (FR-16).
    user.role = props.role ?? UserRole.CUSTOMER;
    user.isActive = true;
    user.refreshTokenHash = null;
    return user;
  }

  hasRole(...roles: UserRole[]): boolean {
    return roles.includes(this.role);
  }

  canOwnCluster(): boolean {
    return this.hasRole(UserRole.OWNER, UserRole.ADMIN);
  }

  isAdmin(): boolean {
    return this.role === UserRole.ADMIN;
  }

  setActive(isActive: boolean): void {
    this.isActive = isActive;
  }

  rotateRefreshToken(hash: string | null): void {
    this.refreshTokenHash = hash;
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Chuan hoa SDT VN: 0xxxxxxxxx -> 8xxxxxxxxx (10 so), giu nguyen neu la quoc te. */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  if (digits.startsWith('0084')) {
    return digits.slice(4);
  }
  if (digits.startsWith('+84')) {
    return digits.slice(3);
  }
  if (digits.startsWith('84') && digits.length === 11) {
    return digits.slice(2);
  }
  if (digits.startsWith('0') && digits.length === 10) {
    return digits.slice(1);
  }
  return digits;
}
