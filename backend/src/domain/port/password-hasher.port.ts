export const PASSWORD_HASHER = 'PASSWORD_HASHER';

/** Port de tach bcrypt khoi domain - NFR-03 (OWASP): luong hash tich cuc, khong bao gio luu mat khau tra. */
export interface IPasswordHasher {
  hash(plain: string): Promise<string>;
  verify(plain: string, hash: string): Promise<boolean>;
  /** Cho phep nang cap cost factor khi cau hinh doi (FR-16). */
  needsRehash(hash: string): boolean;
}
