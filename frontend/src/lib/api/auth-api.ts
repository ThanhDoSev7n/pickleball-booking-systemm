import { apiClient, setTokens, clearTokens, type ApiTokens } from './client';

export type UserRole = 'CUSTOMER' | 'STAFF' | 'OWNER' | 'ADMIN';

export interface AuthUser {
  userId: number;
  fullName: string;
  email: string;
  phoneNumber: string;
  role: UserRole;
  isActive: boolean;
}

export interface AuthResult {
  user: AuthUser;
  tokens: ApiTokens;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  CUSTOMER: 'Khách hàng',
  STAFF: 'Nhân viên',
  OWNER: 'Chủ sân',
  ADMIN: 'Quản trị',
};

export async function login(email: string, password: string): Promise<AuthResult> {
  const { data } = await apiClient.post<AuthResult>('/auth/login', { email, password });
  setTokens(data.tokens);
  return data;
}

export async function register(payload: RegisterPayload): Promise<AuthResult> {
  const { data } = await apiClient.post<AuthResult>('/auth/register', payload);
  setTokens(data.tokens);
  return data;
}

export async function fetchMe(): Promise<AuthUser> {
  const { data } = await apiClient.get<{ user: AuthUser }>('/auth/me');
  return data.user;
}

export function logout() {
  clearTokens();
}
