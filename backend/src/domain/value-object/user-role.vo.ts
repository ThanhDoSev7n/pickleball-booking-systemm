/**
 * Identity Context - RBAC 4 role (ADR-003, muc 1.2.1 / 4.7.3).
 * Ten role trung voi gia tri luu trong DB (enum duoc luu dang varchar de de doc).
 */
export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  STAFF = 'STAFF',
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
}

/** Cac role co the thao tac tai quay (Staff Portal). */
export const OPERATIONAL_ROLES: readonly UserRole[] = [UserRole.STAFF, UserRole.OWNER, UserRole.ADMIN];

export const ALL_ROLES: readonly UserRole[] = [
  UserRole.CUSTOMER,
  UserRole.STAFF,
  UserRole.OWNER,
  UserRole.ADMIN,
];
