import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { DomainError, DomainErrorCode } from '../../../domain/error/domain.error';
import type { Response } from 'express';

interface ErrorBody {
  statusCode: number;
  /** Frontend can cu code de hien thi thong diep tieng Viet, khong parse message. */
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Mot error contract duy nhat cho moi HTTP response loi (muc 4.7.3).
 * Ma nghiep vu duoc giu nguyen ten trong DomainErrorCode de TC-BOOK-xx trace duoc.
 */
@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const body = this.buildBody(exception);

    if (body.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }
    response.status(body.statusCode).json(body);
  }

  private buildBody(exception: unknown): ErrorBody {
    if (exception instanceof DomainError) {
      return {
        statusCode: HTTP_STATUS_BY_DOMAIN_CODE[exception.code] ?? HttpStatus.BAD_REQUEST,
        code: exception.code,
        message: exception.message,
        details: exception.details,
      };
    }
    if (exception instanceof HttpException) {
      return fromHttpException(exception);
    }
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Lo he thong, vui long thu lai sau',
    };
  }
}

const HTTP_STATUS_BY_DOMAIN_CODE: Readonly<Partial<Record<DomainErrorCode, HttpStatus>>> = {
  [DomainErrorCode.INVALID_CREDENTIALS]: HttpStatus.UNAUTHORIZED,
  [DomainErrorCode.INVALID_TOKEN]: HttpStatus.UNAUTHORIZED,
  [DomainErrorCode.FORBIDDEN]: HttpStatus.FORBIDDEN,
  [DomainErrorCode.SLOT_NOT_LOCKED_BY_USER]: HttpStatus.FORBIDDEN,
  [DomainErrorCode.SLOT_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [DomainErrorCode.BOOKING_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [DomainErrorCode.USER_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [DomainErrorCode.SLOT_NOT_AVAILABLE]: HttpStatus.CONFLICT,
  [DomainErrorCode.SLOT_LOCK_EXPIRED]: HttpStatus.CONFLICT,
  [DomainErrorCode.SLOT_ALREADY_BOOKED]: HttpStatus.CONFLICT,
  [DomainErrorCode.EMAIL_ALREADY_EXISTS]: HttpStatus.CONFLICT,
  [DomainErrorCode.PHONE_ALREADY_EXISTS]: HttpStatus.CONFLICT,
  [DomainErrorCode.BOOKING_NOT_CANCELLABLE]: HttpStatus.CONFLICT,
  [DomainErrorCode.CLUSTER_NOT_APPROVED]: HttpStatus.CONFLICT,
  [DomainErrorCode.DEADLOCK_RETRY_EXHAUSTED]: HttpStatus.CONFLICT,
};

const CODE_BY_HTTP_STATUS: Readonly<Partial<Record<number, string>>> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_ERROR',
  [HttpStatus.UNAUTHORIZED]: 'INVALID_TOKEN',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
};

function fromHttpException(exception: HttpException): ErrorBody {
  const statusCode = exception.getStatus();
  const payload = exception.getResponse();
  let message = exception.message;
  let details: Record<string, unknown> | undefined;

  if (typeof payload === 'string') {
    message = payload;
  } else if (payload !== null && typeof payload === 'object') {
    const raw = (payload as { message?: string | string[]; error?: string }).message;
    if (Array.isArray(raw)) {
      // ValidationPipe tra ve danh sach loi theo tung truong.
      message = raw.join('; ');
      details = { violations: raw };
    } else if (typeof raw === 'string') {
      message = raw;
    }
  }

  return {
    statusCode,
    code: CODE_BY_HTTP_STATUS[statusCode] ?? 'HTTP_ERROR',
    message,
    details,
  };
}
