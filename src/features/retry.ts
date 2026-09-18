export type RetryContext = {
  attempt: number;
  method?: string;
  url?: string;
};

export type RetryOptions = {
  attempts?: number;
  delay?: number;
  maxDelay?: number;
  factor?: number;
  jitter?: boolean;
  retryAfter?: boolean;
  retryUnsafeMethods?: boolean;
  onRetry?: (context: RetryContext & { error: unknown }) => void | Promise<void>;
  retryOn?: (error: unknown, context: RetryContext) => boolean;
};

const DEFAULT_RETRY_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const IDEMPOTENT_METHODS = new Set(["GET", "HEAD", "OPTIONS", "PUT", "DELETE"]);

export function isRetryableError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return false;
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (code === "TIMEOUT" || code === "ABORTED" || code === "DEADLINE_EXCEEDED") return code === "TIMEOUT";
  }
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === "number" && DEFAULT_RETRY_STATUS_CODES.has(status);
  }
  return true;
}

export function normalizeRetryOptions(value: number | RetryOptions | undefined): Required<Omit<RetryOptions, "retryOn" | "onRetry">> & Pick<RetryOptions, "retryOn" | "onRetry"> {
  if (typeof value === "number") {
    return {
      attempts: Math.max(0, Math.floor(value)),
      delay: 100,
      maxDelay: 2000,
      factor: 2,
      jitter: true,
      retryAfter: true,
      retryUnsafeMethods: false
    };
  }

  return {
    attempts: Math.max(0, Math.floor(value?.attempts ?? 0)),
    delay: Math.max(0, value?.delay ?? 100),
    maxDelay: Math.max(0, value?.maxDelay ?? 2000),
    factor: Math.max(1, value?.factor ?? 2),
    jitter: value?.jitter ?? true,
    retryAfter: value?.retryAfter ?? true,
    retryUnsafeMethods: value?.retryUnsafeMethods ?? false,
    ...(value?.onRetry ? { onRetry: value.onRetry } : {}),
    ...(value?.retryOn ? { retryOn: value.retryOn } : {})
  };
}

function getRetryAfter(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("retryAfter" in error)) return undefined;
  const value = (error as { retryAfter?: unknown }).retryAfter;
  return typeof value === "number" && value >= 0 ? value : undefined;
}

export async function retry<T>(fn: () => Promise<T>, value?: number | RetryOptions, context: Omit<RetryContext, "attempt"> = {}): Promise<T> {
  const options = normalizeRetryOptions(value);
  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (error) {
      const currentContext: RetryContext = { ...context, attempt };
      if (attempt >= options.attempts) throw error;
      if (context.method && !options.retryUnsafeMethods && !IDEMPOTENT_METHODS.has(context.method.toUpperCase())) throw error;
      if (options.retryOn && !options.retryOn(error, currentContext)) throw error;
      if (!options.retryOn && !isRetryableError(error)) throw error;

      const exponentialDelay = Math.min(options.maxDelay, options.delay * options.factor ** attempt);
      const retryAfter = options.retryAfter ? getRetryAfter(error) : undefined;
      const boundedRetryAfter = retryAfter === undefined ? undefined : Math.min(options.maxDelay, retryAfter);
      const baseWait = boundedRetryAfter === undefined ? exponentialDelay : Math.max(exponentialDelay, boundedRetryAfter);
      const wait = options.jitter
        ? Math.floor(Math.random() * (baseWait + 1))
        : baseWait;

      if (options.onRetry) await options.onRetry({ ...currentContext, error });
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      attempt += 1;
    }
  }
}
