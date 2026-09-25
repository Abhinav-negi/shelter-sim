// Typed fetch wrapper shared by every src/api/* module. Normalises every failure
// (HTTP error response, network failure, unparsable body) to ApiError so callers
// never need to distinguish "server said no" from "server unreachable" by hand.

export class ApiError extends Error {
  code: string;
  field?: string | undefined;

  constructor(code: string, message: string, field?: string | undefined) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.field = field;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
  } catch {
    throw new ApiError('NETWORK_ERROR', 'Could not reach the server.');
  }

  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      // non-JSON body — leave body null, handled below.
    }
  }

  if (!res.ok) {
    const err = (body ?? {}) as Partial<{ code: string; message: string; field: string }>;
    throw new ApiError(
      err.code ?? 'UNKNOWN_ERROR',
      err.message ?? `Request failed (${res.status})`,
      err.field,
    );
  }

  return body as T;
}

export function get<T>(path: string): Promise<T> {
  return request<T>(path);
}

export function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
}

export function put<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'PUT', ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
}

export function del<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' });
}
