interface ApiErrorBody {
  errorCode?: string;
  title?: string;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly errorCode: string;

  constructor(status: number, errorCode: string) {
    super(errorCode);
    this.status = status;
    this.errorCode = errorCode;
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
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
    throw new ApiError(response.status, body.errorCode ?? 'API_REQUEST_FAILED');
  }

  return response.json() as Promise<T>;
}

let cachedCsrfToken: string | null = null;
let csrfTokenPromise: Promise<string> | null = null;

export async function getCsrfToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedCsrfToken) {
    return cachedCsrfToken;
  }

  if (!csrfTokenPromise || forceRefresh) {
    csrfTokenPromise = apiRequest<{ token: string }>('/api/auth/csrf')
      .then((res) => {
        cachedCsrfToken = res.token;
        return res.token;
      })
      .finally(() => {
        csrfTokenPromise = null;
      });
  }

  return csrfTokenPromise;
}

export async function csrfRequest<T>(
  path: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<T> {
  const token = await getCsrfToken();
  try {
    return await apiRequest<T>(path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': token,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 400 || error.status === 403)) {
      const freshToken = await getCsrfToken(true);
      return apiRequest<T>(path, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': freshToken,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    }
    throw error;
  }
}
