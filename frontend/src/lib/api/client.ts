import axios, { AxiosError, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

export interface ApiTokens {
  accessToken: string;
  refreshToken: string;
  tokenType?: string;
  expiresIn?: number;
}

export interface ApiErrorPayload {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}

const ACCESS_KEY = 'datsanpick.accessToken';
const REFRESH_KEY = 'datsanpick.refreshToken';

const browser = () => typeof window !== 'undefined';

let memoryAccess: string | null = null;
let memoryRefresh: string | null = null;

export function setTokens(tokens: ApiTokens | null | undefined) {
  if (!tokens) return;
  memoryAccess = tokens.accessToken ?? null;
  memoryRefresh = tokens.refreshToken ?? null;
  if (!browser()) return;
  if (tokens.accessToken) window.localStorage.setItem(ACCESS_KEY, tokens.accessToken);
  if (tokens.refreshToken) window.localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
}

export function clearTokens() {
  memoryAccess = null;
  memoryRefresh = null;
  if (!browser()) return;
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
}

export function getAccessToken(): string | null {
  if (memoryAccess) return memoryAccess;
  if (!browser()) return null;
  memoryAccess = window.localStorage.getItem(ACCESS_KEY);
  return memoryAccess;
}

export function getRefreshToken(): string | null {
  if (memoryRefresh) return memoryRefresh;
  if (!browser()) return null;
  memoryRefresh = window.localStorage.getItem(REFRESH_KEY);
  return memoryRefresh;
}

export function hasStoredSession(): boolean {
  return Boolean(getRefreshToken());
}

const baseURL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';

export const apiClient = axios.create({
  baseURL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

type RetriableConfig = AxiosRequestConfig & { _retried?: boolean };

let pendingRefresh: Promise<string | null> | null = null;

// Refresh dong: nhieu request 401 cung luc thi chi goi /auth/refresh 1 lan
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  if (!pendingRefresh) {
    pendingRefresh = axios
      .post(`${baseURL}/auth/refresh`, { refreshToken }, { timeout: 10000 })
      .then((res) => {
        const tokens = (res.data as { tokens?: ApiTokens } | null)?.tokens;
        if (!tokens?.accessToken) return null;
        setTokens(tokens);
        return tokens.accessToken;
      })
      .catch(() => null)
      .finally(() => {
        pendingRefresh = null;
      });
  }
  return pendingRefresh;
}

const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh'];

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    const status = error.response?.status;
    const url = config?.url ?? '';
    const isAuthCall = AUTH_PATHS.some((path) => url.includes(path));

    if (status === 401 && config && !config._retried && !isAuthCall && getRefreshToken()) {
      config._retried = true;
      const newToken = await refreshAccessToken();
      if (newToken) {
        config.headers = { ...config.headers, Authorization: `Bearer ${newToken}` };
        return apiClient.request(config);
      }
      clearTokens();
    }
    return Promise.reject(error);
  },
);

export function toApiError(error: unknown): ApiErrorPayload {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as Partial<ApiErrorPayload> | undefined;
    if (!error.response) {
      return { statusCode: 0, code: 'NETWORK_ERROR', message: 'Khong the ket noi den server' };
    }
    return {
      statusCode: data?.statusCode ?? error.response.status,
      code: data?.code ?? `HTTP_${error.response.status}`,
      message: data?.message ?? 'Co loi xay ra, vui long thu lai',
      details: data?.details,
    };
  }
  return {
    statusCode: 0,
    code: 'UNKNOWN_ERROR',
    message: error instanceof Error ? error.message : 'Co loi xay ra',
  };
}
