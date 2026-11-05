import { toApiError } from './api/client';

/** Ma nghiep vu backend (DomainErrorCode ben NestJS) -> thong điệp tieng Viet. */
export const DOMAIN_ERROR_MESSAGES: Record<string, string> = {
  SLOT_NOT_FOUND: 'Khung giờ không còn tồn tại, vui lòng chọn khung khác.',
  SLOT_NOT_AVAILABLE: 'Khung giờ vừa bị người khác đặt, vui lòng chọn khung khác.',
  SLOT_LOCK_EXPIRED: 'Thời gian giữ chỗ đã hết hạn, vui lòng giữ chỗ lại.',
  SLOT_NOT_LOCKED_BY_USER: 'Khung giờ này không thuộc phiên giữ chỗ của bạn.',
  SLOT_ALREADY_BOOKED: 'Khung giờ đã được đặt trước đó.',
  DEADLOCK_RETRY_EXHAUSTED: 'Hệ thống đang bận, vui lòng thử lại sau ít giây.',
  BOOKING_NOT_FOUND: 'Không tìm thấy lịch đặt sân.',
  BOOKING_NOT_CANCELLABLE: 'Lịch đặt này không thể hủy (đã check-in hoặc đã cận giờ chơi).',
  USER_NOT_FOUND: 'Không tìm thấy tài khoản.',
  EMAIL_ALREADY_EXISTS: 'Email đã được đăng ký, vui lòng dùng email khác hoặc đăng nhập.',
  PHONE_ALREADY_EXISTS: 'Số điện thoại đã được đăng ký.',
  INVALID_CREDENTIALS: 'Email hoặc mật khẩu không đúng.',
  INVALID_TOKEN: 'Phiên đăng nhập không hợp lệ, vui lòng đăng nhập lại.',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
  CLUSTER_NOT_APPROVED: 'Cụm sân chưa được phê duyệt để nhận đặt.',
  NETWORK_ERROR: 'Không kết nối được tới server. Hãy chắc chắn backend đang chạy tại http://localhost:3000.',
  TIMEOUT_ERROR: 'Server phản hồi quá chậm, vui lòng thử lại.',
  HTTP_400: 'Dữ liệu gửi lên không hợp lệ.',
  HTTP_401: 'Bạn cần đăng nhập để thực hiện thao tác này.',
  HTTP_403: 'Bạn không có quyền truy cập nội dung này.',
  HTTP_404: 'Không tìm thấy dữ liệu yêu cầu.',
  HTTP_409: 'Trạng thái dữ liệu đã thay đổi, vui lòng làm mới lại trang.',
  HTTP_422: 'Dữ liệu không hợp lệ, vui lòng kiểm tra lại.',
  HTTP_429: 'Bạn thao tác quá nhanh, vui lòng chờ ít giây.',
  HTTP_500: 'Server đang gặp lỗi, vui lòng thử lại sau.',
  HTTP_502: 'Server tạm không phản hồi (gateway lỗi).',
  HTTP_503: 'Server tạm thời bận, vui lòng thử lại sau.',
  UNKNOWN_ERROR: 'Đã xảy ra lỗi không xác định.',
};

export function apiErrorPayload(error: unknown) {
  return toApiError(error);
}

export function apiErrorCode(error: unknown): string {
  return toApiError(error).code;
}

export function apiErrorMessage(error: unknown): string {
  const { code, message, statusCode } = toApiError(error);
  const mapped = DOMAIN_ERROR_MESSAGES[code];
  if (mapped) return mapped;
  if (code.startsWith('HTTP_')) {
    const byStatus = DOMAIN_ERROR_MESSAGES[`HTTP_${statusCode}`];
    if (byStatus) return byStatus;
  }
  if (typeof message === 'string' && message.trim() && !/^Request failed/i.test(message)) return message;
  return DOMAIN_ERROR_MESSAGES.UNKNOWN_ERROR;
}

/** 409 SLOT_NOT_AVAILABLE -> UI refresh lai luoi slot */
export function isSlotTakenError(error: unknown): boolean {
  const payload = toApiError(error);
  return payload.code === 'SLOT_NOT_AVAILABLE' || payload.code === 'SLOT_ALREADY_BOOKED';
}

/**
 * Backend tra kem details.slotId trong 409. Xoa DUNG slot bi gianh khoi selection;
 * neu khong thi selection cu van ton tai va user bam lock lai that bai mai.
 */
export function takenSlotIdOf(error: unknown): number | null {
  const raw = toApiError(error).details as { slotId?: unknown } | undefined;
  const slotId = Number(raw?.slotId);
  return Number.isFinite(slotId) && slotId > 0 ? slotId : null;
}

export function isLockExpiredError(error: unknown): boolean {
  return toApiError(error).code === 'SLOT_LOCK_EXPIRED';
}

export function isAuthError(error: unknown): boolean {
  const payload = toApiError(error);
  return payload.code === 'INVALID_CREDENTIALS' || payload.code === 'INVALID_TOKEN' || payload.statusCode === 401;
}

export function isNetworkError(error: unknown): boolean {
  const payload = toApiError(error);
  return payload.code === 'NETWORK_ERROR' || payload.code === 'TIMEOUT_ERROR';
}
