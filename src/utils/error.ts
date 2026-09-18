export type ThusErrorCode =
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "DEADLINE_EXCEEDED"
  | "HTTP_ERROR"
  | "ABORTED"
  | "UNKNOWN_ERROR"
  | "REQUEST_TOO_LARGE"
  | "RESPONSE_TOO_LARGE"
  | "SECURITY_ERROR";

export type ThusErrorOptions = {
  message: string;
  code?: ThusErrorCode;
  status?: number | null;
  url?: string | null;
  method?: string | null;
  response?: unknown;
  cause?: unknown;
  retryAfter?: number;
};

export class ThusError extends Error {
  readonly code: ThusErrorCode;
  readonly status: number | null;
  readonly url: string | null;
  readonly method: string | null;
  readonly response: unknown;
  readonly cause: unknown;
  readonly retryAfter: number | undefined;

  constructor(options: ThusErrorOptions);
  constructor(message: string, status?: number | null, url?: string | null);
  constructor(optionsOrMessage: ThusErrorOptions | string, status?: number | null, url?: string | null) {
    const options: ThusErrorOptions = typeof optionsOrMessage === "string"
      ? { message: optionsOrMessage, ...(status !== undefined ? { status } : {}), ...(url !== undefined ? { url } : {}) }
      : optionsOrMessage;
    super(options.message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "ThusError";
    this.code = options.code ?? (options.status ? "HTTP_ERROR" : "UNKNOWN_ERROR");
    this.status = options.status ?? null;
    this.url = options.url ?? null;
    this.method = options.method ?? null;
    this.response = options.response;
    this.cause = options.cause;
    this.retryAfter = options.retryAfter;
  }
}
