/**
 * Ma loi nghiep vu - duoc controller chuyen thanh HTTP status tuong ung.
 * Ten doi duoc gan truc tiep voi Test Case (TC-BOOK-xx, TC-CONCURRENCY-xx) phuc vu traceability.
 */
export enum DomainErrorCode {
  SLOT_NOT_FOUND = 'SLOT_NOT_FOUND',
  SLOT_NOT_AVAILABLE = 'SLOT_NOT_AVAILABLE',
  SLOT_LOCK_EXPIRED = 'SLOT_LOCK_EXPIRED',
  SLOT_NOT_LOCKED_BY_USER = 'SLOT_NOT_LOCKED_BY_USER',
  SLOT_ALREADY_BOOKED = 'SLOT_ALREADY_BOOKED',
  DEADLOCK_RETRY_EXHAUSTED = 'DEADLOCK_RETRY_EXHAUSTED',
  BOOKING_NOT_FOUND = 'BOOKING_NOT_FOUND',
  BOOKING_NOT_CANCELLABLE = 'BOOKING_NOT_CANCELLABLE',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  PHONE_ALREADY_EXISTS = 'PHONE_ALREADY_EXISTS',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  INVALID_TOKEN = 'INVALID_TOKEN',
  FORBIDDEN = 'FORBIDDEN',
  CLUSTER_NOT_APPROVED = 'CLUSTER_NOT_APPROVED',
  CLUSTER_NOT_FOUND = 'CLUSTER_NOT_FOUND',
  COURT_NOT_FOUND = 'COURT_NOT_FOUND',
  INVALID_INPUT = 'INVALID_INPUT',
  PRICING_RULE_NOT_FOUND = 'PRICING_RULE_NOT_FOUND',
    MATCH_NOT_FOUND = 'MATCH_NOT_FOUND',
  MATCH_FULL = 'MATCH_FULL',
  MATCH_ALREADY_JOINED = 'MATCH_ALREADY_JOINED',
  MATCH_NOT_JOINED = 'MATCH_NOT_JOINED',
}

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: DomainErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
  }
}

export class ConflictError extends DomainError {
  constructor(code: DomainErrorCode, message: string, details?: Record<string, unknown>) {
    super(code, message, details);
    this.name = 'ConflictError';
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Khong du quyen thuc hien thao tac nay', details?: Record<string, unknown>) {
    super(DomainErrorCode.FORBIDDEN, message, details);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundDomainError extends DomainError {
  constructor(code: DomainErrorCode, message: string, details?: Record<string, unknown>) {
    super(code, message, details);
    this.name = 'NotFoundDomainError';
  }
}
