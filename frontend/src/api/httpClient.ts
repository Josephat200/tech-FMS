type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type RequestOptions<TBody = unknown> = {
  method?: HttpMethod;
  body?: TBody;
  headers?: Record<string, string>;
  auth?: boolean;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;
let accessToken: string | null = null;
let refreshHandler: (() => Promise<string | null>) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function registerRefreshHandler(handler: () => Promise<string | null>) {
  refreshHandler = handler;
}

async function request<TResponse, TBody = unknown>(
  endpoint: string,
  options: RequestOptions<TBody> = {},
  retry = true,
): Promise<TResponse> {
  const { method = 'GET', body, headers, auth = true } = options;

  const requestHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    ...(headers ?? {}),
  };

  if (auth && accessToken) {
    requestHeaders.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: requestHeaders,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && retry && auth && refreshHandler) {
    const refreshed = await refreshHandler();
    if (refreshed) {
      return request<TResponse, TBody>(endpoint, options, false);
    }
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message =
      errorBody?.error?.message ||
      errorBody?.message ||
      `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return response.json() as Promise<TResponse>;
}

export const httpClient = {
  get: <TResponse>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<TResponse>(endpoint, { ...options, method: 'GET' }),
  post: <TResponse, TBody = unknown>(
    endpoint: string,
    body?: TBody,
    options?: Omit<RequestOptions<TBody>, 'method' | 'body'>,
  ) => request<TResponse, TBody>(endpoint, { ...options, method: 'POST', body }),
  put: <TResponse, TBody = unknown>(
    endpoint: string,
    body?: TBody,
    options?: Omit<RequestOptions<TBody>, 'method' | 'body'>,
  ) => request<TResponse, TBody>(endpoint, { ...options, method: 'PUT', body }),
  patch: <TResponse, TBody = unknown>(
    endpoint: string,
    body?: TBody,
    options?: Omit<RequestOptions<TBody>, 'method' | 'body'>,
  ) => request<TResponse, TBody>(endpoint, { ...options, method: 'PATCH', body }),
};
