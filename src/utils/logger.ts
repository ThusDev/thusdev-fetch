const SENSITIVE_HEADERS = new Set([
  "authorization", "cookie", "set-cookie", "x-api-key", "api-key", "proxy-authorization", "x-auth-token", "x-access-token"
]);

export function sanitizeHeaders(headers: HeadersInit | undefined): Record<string, string> {
  const normalized = new Headers(headers);
  const result: Record<string, string> = {};
  normalized.forEach((value, key) => {
    result[key] = SENSITIVE_HEADERS.has(key.toLowerCase()) ? "[REDACTED]" : value;
  });
  return result;
}

export const logger = {
  info: (message: string) => console.info(`[ThusFetch] ${message}`),
  success: (message: string) => console.info(`[ThusFetch OK] ${message}`),
  error: (message: string) => console.error(`[ThusFetch ERROR] ${message}`)
};
