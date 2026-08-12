import type {
  AuthAccess,
  AuthConfiguration,
  AuthMeResponse,
  AuthProfile,
} from '../types';

interface ApiErrorBody {
  errorCode?: string;
  title?: string;
}

export class AuthApiError extends Error {
  public readonly status: number;
  public readonly errorCode: string;

  constructor(status: number, errorCode: string) {
    super(errorCode);
    this.status = status;
    this.errorCode = errorCode;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as ApiErrorBody;
    throw new AuthApiError(response.status, body.errorCode ?? 'AUTH_REQUEST_FAILED');
  }

  return response.json() as Promise<T>;
}

async function csrfToken(): Promise<string> {
  const response = await request<{ token: string }>('/api/auth/csrf');
  return response.token;
}

async function postWithCsrf<T>(path: string, body?: unknown): Promise<T> {
  const token = await csrfToken();
  return request<T>(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-TOKEN': token,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export const authApi = {
  configuration: () => request<AuthConfiguration>('/api/auth/config'),
  me: () => request<AuthMeResponse>('/api/auth/me'),
  access: () => request<AuthAccess>('/api/auth/access'),
  pendingProfiles: async () => {
    const response = await request<{ availableProfiles: AuthProfile[] }>('/api/auth/pending-profiles');
    return response.availableProfiles;
  },
  selectProfile: (profileId: string) =>
    postWithCsrf<AuthMeResponse>('/api/auth/select-profile', { profileId }),
  switchProfile: (profileId: string) =>
    postWithCsrf<AuthMeResponse>('/api/auth/switch-profile', { profileId }),
  logout: () => postWithCsrf<{ success: boolean }>('/api/auth/logout'),
  devLogin: (profileCode = 'SURVEY_ADMIN') =>
    request<AuthMeResponse>(
      `/api/auth/dev/login?email=abc%40vmu.edu.vn&profileCode=${encodeURIComponent(profileCode)}`,
    ),
};
