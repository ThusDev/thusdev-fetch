import { retry, type RetryOptions } from "../features/retry";
import { createTimeout } from "../features/timeout";
import { logger, sanitizeHeaders } from "../utils/logger";
import { ThusError } from "../utils/error";
import { InterceptorManager } from "../features/interceptors";
import { PluginManager } from "../features/plugins";
import { startTimer, endTimer } from "../features/timeline";
import { explainError } from "../utils/error-explainer";
import { ThusConfig } from "./config";
import { MemoryCache, type CacheOptions } from "../features/cache";
import type { RequestHooks } from "../features/hooks";
import { MetricsStore, type RequestMetrics } from "../utils/metrics";
import { validateSize, validateUrl, validateRedirectCount, sanitizeUrl, type SecurityOptions } from "../utils/security";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
export type RetryConfig = number | RetryOptions;

export type RequestConfig = {
  url: string;
  baseURL?: string;
  method?: HttpMethod;
  headers?: HeadersInit;
  body?: unknown;
  timeout?: number;
  retry?: RetryConfig;
  signal?: AbortSignal;
  credentials?: RequestCredentials;
  cache?: RequestCache;
  mode?: RequestMode;
  redirect?: RequestRedirect;
  referrer?: string;
  integrity?: string;
  responseType?: "auto" | "json" | "text" | "arrayBuffer" | "blob" | "stream";
  deadline?: number;
  security?: SecurityOptions;
  cacheOptions?: CacheOptions;
  onRequestStart?: RequestHooks["onRequestStart"];
  onRequestEnd?: RequestHooks["onRequestEnd"];
  onRetry?: RequestHooks["onRetry"];
};

export type ResponseData<T = unknown> = {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
  url: string;
  duration: number;
};

function joinURL(baseURL: string | undefined, url: string): string {
  if (!baseURL) return url;
  if (!url) return baseURL;
  return `${baseURL.replace(/\/$/, "")}/${url.replace(/^\//, "")}`;
}

function isJsonContentType(contentType: string | null): boolean {
  return contentType?.includes("application/json") || contentType?.includes("+json") || false;
}

async function readResponseText(response: Response, maxResponseSize?: number): Promise<string> {
  if (maxResponseSize === undefined) return response.text();
  const length = response.headers.get("content-length");
  if (length !== null && Number(length) > maxResponseSize) throw new ThusError({ message: `Response exceeded the ${maxResponseSize}-byte limit.`, code: "RESPONSE_TOO_LARGE", status: response.status, url: response.url });
  if (!response.body) return response.text();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > maxResponseSize) {
        await reader.cancel();
        throw new ThusError({ message: `Response exceeded the ${maxResponseSize}-byte limit.`, code: "RESPONSE_TOO_LARGE", status: response.status, url: response.url });
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

async function readResponseBytes(response: Response, maxResponseSize?: number): Promise<ArrayBuffer> {
  if (maxResponseSize === undefined) return response.arrayBuffer();
  const length = response.headers.get("content-length");
  if (length !== null && Number(length) > maxResponseSize) throw new ThusError({ message: `Response exceeded the ${maxResponseSize}-byte limit.`, code: "RESPONSE_TOO_LARGE", status: response.status, url: response.url });
  if (!response.body) {
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > maxResponseSize) throw new ThusError({ message: `Response exceeded the ${maxResponseSize}-byte limit.`, code: "RESPONSE_TOO_LARGE", status: response.status, url: response.url });
    return buffer;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > maxResponseSize) {
        await reader.cancel();
        throw new ThusError({ message: `Response exceeded the ${maxResponseSize}-byte limit.`, code: "RESPONSE_TOO_LARGE", status: response.status, url: response.url });
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes.buffer;
}

async function parseResponse(response: Response, maxResponseSize?: number, responseType: RequestConfig["responseType"] = "auto"): Promise<unknown> {
  if (response.status === 204 || response.status === 205 || response.status === 304) return undefined;
  if (responseType === "stream") return response.body;
  if (responseType === "arrayBuffer") return readResponseBytes(response, maxResponseSize);
  if (responseType === "blob") {
    if (maxResponseSize === undefined) return response.blob();
    return new Blob([await readResponseBytes(response, maxResponseSize)]);
  }
  const contentType = response.headers.get("content-type");
  if (responseType === "text") return readResponseText(response, maxResponseSize);
  if (maxResponseSize === undefined) {
    if (responseType === "json" || isJsonContentType(contentType)) {
      try { return await response.json(); } catch { return await response.text(); }
    }
    const text = await response.text();
    if (!text) return undefined;
    try { return JSON.parse(text); } catch { return text; }
  }
  const text = await readResponseText(response, maxResponseSize);
  if (!text) return undefined;
  if (isJsonContentType(contentType)) {
    try { return JSON.parse(text); } catch { return text; }
  }
  try { return JSON.parse(text); } catch { return text; }
}

function mergeAbortSignals(timeoutSignal: AbortSignal, externalSignal?: AbortSignal): AbortSignal {
  if (!externalSignal) return timeoutSignal;
  if (typeof AbortSignal.any === "function") return AbortSignal.any([timeoutSignal, externalSignal]);
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (timeoutSignal.aborted || externalSignal.aborted) controller.abort();
  timeoutSignal.addEventListener("abort", abort, { once: true });
  externalSignal.addEventListener("abort", abort, { once: true });
  return controller.signal;
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return undefined;
  return Math.max(0, timestamp - Date.now());
}

function cloneResponse<T>(response: ResponseData<T>): ResponseData<T> {
  return { ...response, headers: new Headers(response.headers) };
}

function createBoundedStream(response: Response, maxResponseSize: number): ReadableStream<Uint8Array> | null {
  if (!response.body) return null;
  const reader = response.body.getReader();
  let total = 0;
  let closed = false;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const part = await reader.read();
        if (part.done) {
          closed = true;
          controller.close();
          reader.releaseLock();
          return;
        }
        total += part.value.byteLength;
        if (total > maxResponseSize) {
          await reader.cancel();
          closed = true;
          reader.releaseLock();
          controller.error(new ThusError({
            message: `Response exceeded the ${maxResponseSize}-byte limit.`,
            code: "RESPONSE_TOO_LARGE",
            status: response.status,
            url: response.url
          }));
          return;
        }
        controller.enqueue(part.value);
      } catch (error) {
        if (!closed) {
          closed = true;
          try { reader.releaseLock(); } catch {}
        }
        controller.error(error);
      }
    },
    async cancel(reason) {
      if (closed) return;
      closed = true;
      await reader.cancel(reason);
      reader.releaseLock();
    }
  });
}

export class ThusFetch {
  readonly interceptors = new InterceptorManager();
  readonly plugins = new PluginManager();
  readonly metrics = new MetricsStore();
  private readonly cache = new MemoryCache();
  private readonly cacheRevalidations = new Map<string, Promise<void>>();

  constructor(private readonly defaults: Partial<RequestConfig> & RequestHooks = {}) {}

  getMetrics(): RequestMetrics {
    return this.metrics.snapshot();
  }

  resetMetrics(): void {
    this.metrics.reset();
  }

  clearCache(): void {
    this.cache.clear();
  }

  invalidateCache(prefix?: string): void {
    this.cache.invalidate(prefix);
  }

  private cacheKey(config: RequestConfig, url: string): string {
    return config.cacheOptions?.key ?? `${config.method ?? "GET"}:${url}`;
  }

  private scheduleCacheRevalidation<T>(key: string, request: () => Promise<T>): void {
    if (this.cacheRevalidations.has(key)) return;
    const promise = request().then(() => undefined).catch(() => undefined).finally(() => {
      this.cacheRevalidations.delete(key);
    });
    this.cacheRevalidations.set(key, promise);
  }
  private async fetchWithRedirectPolicy(initialUrl: string, options: RequestInit, security?: SecurityOptions): Promise<Response> {
    if (options.redirect !== "follow") return fetch(initialUrl, options);
    if (!security?.allowRedirects) throw new ThusError({ message: "Following redirects is disabled by default. Enable security.allowRedirects explicitly.", code: "SECURITY_ERROR", url: sanitizeUrl(initialUrl), method: String(options.method ?? "GET") });
    const maxRedirects = security.maxRedirects ?? 5;
    let currentUrl = initialUrl;
    let response = await fetch(currentUrl, { ...options, redirect: "manual" });
    for (let redirectCount = 0; redirectCount < maxRedirects && response.status >= 300 && response.status < 400; redirectCount += 1) {
      const location = response.headers.get("location");
      if (!location) break;
      const nextUrl = new URL(location, currentUrl).toString();
      try { validateUrl(nextUrl, security); } catch (error) {
        throw new ThusError({ message: error instanceof Error ? error.message : "Redirect target failed security validation.", code: "SECURITY_ERROR", url: sanitizeUrl(nextUrl), method: String(options.method ?? "GET"), cause: error });
      }
      currentUrl = nextUrl;
      response = await fetch(currentUrl, { ...options, redirect: "manual" });
    }
    if (response.status >= 300 && response.status < 400) throw new ThusError({ message: `Maximum redirect count of ${maxRedirects} exceeded.`, code: "SECURITY_ERROR", url: sanitizeUrl(currentUrl), method: String(options.method ?? "GET") });
    return response;
  }


  async request<T = unknown>(config: RequestConfig): Promise<T> {
    const mergedConfig: RequestConfig = { ...this.defaults, ...config };
    const method = mergedConfig.method ?? "GET";
    const url = joinURL(mergedConfig.baseURL, mergedConfig.url);
    const deadlineController = new AbortController();
    const deadlineId = mergedConfig.deadline === undefined ? undefined : setTimeout(() => deadlineController.abort(), mergedConfig.deadline);
    const execute = async (): Promise<T> => {
      const requestStart = startTimer();
      const controller = new AbortController();
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      let finalConfig = mergedConfig;

      try {
        finalConfig = await this.interceptors.runRequest({ ...mergedConfig });
        finalConfig = await this.plugins.runBefore(finalConfig);
        const finalMethod = finalConfig.method ?? "GET";
        const finalUrl = joinURL(finalConfig.baseURL, finalConfig.url);
        try {
          validateSize(finalConfig.security?.maxResponseSize, "maxResponseSize");
          validateSize(finalConfig.security?.maxRequestSize, "maxRequestSize");
          validateSize(finalConfig.deadline, "deadline");
          validateRedirectCount(finalConfig.security?.maxRedirects);
          validateUrl(finalUrl, finalConfig.security);
        } catch (error) {
          throw new ThusError({ message: error instanceof Error ? error.message : "Request security validation failed.", code: "SECURITY_ERROR", url: sanitizeUrl(finalUrl), method: finalMethod, cause: error });
        }
        await finalConfig.onRequestStart?.({ method: finalMethod, url: sanitizeUrl(finalUrl) });

        if (finalConfig.timeout !== undefined) {
          if (finalConfig.timeout <= 0) throw new ThusError({
            message: "Timeout must be greater than zero.",
            code: "TIMEOUT",
            url: finalUrl,
            method: finalMethod
          });
          timeoutId = createTimeout(finalConfig.timeout, controller);
        }

        const headers = new Headers(finalConfig.headers);
        const body = finalConfig.body;
        const explicitCacheKey = Boolean(finalConfig.cacheOptions?.key);
        const finalCacheEnabled = finalMethod === "GET" && (finalConfig.cacheOptions?.ttl ?? 0) > 0;
        const finalCacheKey = this.cacheKey(finalConfig, finalUrl);
        const cached = finalCacheEnabled && (!headers.has("authorization") || explicitCacheKey) ? this.cache.getExpired(finalCacheKey) : undefined;

        if (finalCacheEnabled && cached && finalConfig.cacheOptions?.staleWhileRevalidate) {
          const backgroundConfig: RequestConfig = {
            ...finalConfig,
            cacheOptions: { ...finalConfig.cacheOptions, staleWhileRevalidate: false }
          };
          this.scheduleCacheRevalidation(finalCacheKey, () => this.request(backgroundConfig));
          const duration = endTimer(requestStart);
          this.metrics.recordSuccess(duration);
          await finalConfig.onRequestEnd?.({ method: finalMethod, url: finalUrl, status: cached.response.status, duration });
          return cached.response.data as T;
        }

        if (finalCacheEnabled && cached) {
          if (cached.etag) headers.set("if-none-match", cached.etag);
          if (cached.lastModified) headers.set("if-modified-since", cached.lastModified);
        }

        if (body !== undefined && body !== null && !(body instanceof FormData) && !(body instanceof Blob) && !(body instanceof ArrayBuffer) && !(body instanceof URLSearchParams) && typeof body !== "string") {
          if (!headers.has("content-type")) headers.set("content-type", "application/json");
        }

        const options: RequestInit = {
          method: finalMethod,
          headers,
          signal: mergeAbortSignals(mergeAbortSignals(controller.signal, deadlineController.signal), finalConfig.signal),
          ...(finalConfig.credentials !== undefined ? { credentials: finalConfig.credentials } : {}),
          ...(finalConfig.cache !== undefined ? { cache: finalConfig.cache } : {}),
          ...(finalConfig.mode !== undefined ? { mode: finalConfig.mode } : {}),
          redirect: finalConfig.redirect ?? "error",
          ...(finalConfig.referrer !== undefined ? { referrer: finalConfig.referrer } : {}),
          ...(finalConfig.integrity !== undefined ? { integrity: finalConfig.integrity } : {})
        };

        if (body !== undefined && body !== null) {
          options.body = typeof body === "string" || body instanceof FormData || body instanceof Blob || body instanceof ArrayBuffer || body instanceof URLSearchParams
            ? body
            : JSON.stringify(body);
          const maxRequestSize = finalConfig.security?.maxRequestSize;
          if (maxRequestSize !== undefined && typeof options.body === "string" && new TextEncoder().encode(options.body).byteLength > maxRequestSize) {
            throw new ThusError({ message: `Request exceeded the ${maxRequestSize}-byte limit.`, code: "REQUEST_TOO_LARGE", url: finalUrl, method: finalMethod });
          }
          const contentLength = headers.get("content-length");
          if (maxRequestSize !== undefined && contentLength !== null && Number(contentLength) > maxRequestSize) {
            throw new ThusError({ message: `Request exceeded the ${maxRequestSize}-byte limit.`, code: "REQUEST_TOO_LARGE", url: finalUrl, method: finalMethod });
          }
        }

        if (finalCacheEnabled && (!headers.has("authorization") || explicitCacheKey)) {
          const fresh = this.cache.get(finalCacheKey);
          if (fresh) {
            const duration = endTimer(requestStart);
            this.metrics.recordSuccess(duration);
            await finalConfig.onRequestEnd?.({ method: finalMethod, url: finalUrl, status: fresh.response.status, duration });
            return fresh.response.data as T;
          }
        }

        if (ThusConfig.debug) {
          logger.info(`${finalMethod} ${sanitizeUrl(finalUrl)}`);
          logger.info(`Headers ${JSON.stringify(sanitizeHeaders(headers))}`);
        }

        let response: Response;
        try {
          response = await this.fetchWithRedirectPolicy(finalUrl, options, finalConfig.security);
        } catch (error) {
          const duration = endTimer(requestStart);
          if (error instanceof ThusError) {
            this.metrics.recordFailure(duration);
            await finalConfig.onRequestEnd?.({ method: finalMethod, url: finalUrl, duration, error });
            throw error;
          }
          if (deadlineController.signal.aborted) {
            const timeoutError = new ThusError({
              message: `Request deadline exceeded after ${mergedConfig.deadline}ms.`,
              code: "DEADLINE_EXCEEDED",
              url: finalUrl,
              method: finalMethod,
              cause: error
            });
            this.metrics.recordFailure(duration);
            await finalConfig.onRequestEnd?.({ method: finalMethod, url: finalUrl, duration, error: timeoutError });
            throw timeoutError;
          }
          if (controller.signal.aborted && !finalConfig.signal?.aborted) {
            const timeoutError = new ThusError({
              message: `Request timed out after ${finalConfig.timeout}ms.`,
              code: "TIMEOUT",
              url: finalUrl,
              method: finalMethod,
              cause: error
            });
            this.metrics.recordFailure(duration);
            await finalConfig.onRequestEnd?.({ method: finalMethod, url: finalUrl, duration, error: timeoutError });
            throw timeoutError;
          }
          if (finalConfig.signal?.aborted) {
            const abortedError = new ThusError({
              message: "The request was aborted.",
              code: "ABORTED",
              url: finalUrl,
              method: finalMethod,
              cause: error
            });
            this.metrics.recordFailure(duration);
            await finalConfig.onRequestEnd?.({ method: finalMethod, url: finalUrl, duration, error: abortedError });
            throw abortedError;
          }
          const networkError = new ThusError({
            message: "The request could not be completed because no HTTP response was received.",
            code: "NETWORK_ERROR",
            url: finalUrl,
            method: finalMethod,
            cause: error
          });
          this.metrics.recordFailure(duration);
          await finalConfig.onRequestEnd?.({ method: finalMethod, url: finalUrl, duration, error: networkError });
          throw networkError;
        }

        if (finalConfig.responseType === "stream" && finalConfig.security?.maxResponseSize !== undefined) {
          const boundedStream = createBoundedStream(response, finalConfig.security.maxResponseSize);
          if (boundedStream) {
            const duration = endTimer(requestStart);
            const result: ResponseData<ReadableStream<Uint8Array>> = {
              data: boundedStream,
              status: response.status,
              statusText: response.statusText,
              headers: response.headers,
              url: response.url || finalUrl,
              duration
            };
            const intercepted = await this.interceptors.runResponse(result);
            const finalResponse = await this.plugins.runAfter(intercepted);
            this.metrics.recordSuccess(duration);
            await finalConfig.onRequestEnd?.({ method: finalMethod, url: finalUrl, status: response.status, duration });
            return finalResponse.data as T;
          }
        }

        if (response.status === 304 && cached) {
          const duration = endTimer(requestStart);
          const result = cloneResponse(cached.response);
          result.duration = duration;
          this.cache.refresh(finalCacheKey, finalConfig.cacheOptions?.ttl ?? 0);
          this.metrics.recordSuccess(duration);
          await finalConfig.onRequestEnd?.({ method: finalMethod, url: finalUrl, status: 304, duration });
          return result.data as T;
        }

        const data = await parseResponse(response, finalConfig.security?.maxResponseSize, finalConfig.responseType);
        const duration = endTimer(requestStart);
        const result: ResponseData<T> = {
          data: data as T,
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          url: response.url || finalUrl,
          duration
        };

        if (!response.ok) {
          const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
          const httpError = new ThusError({
            message: explainError(response.status),
            code: "HTTP_ERROR",
            status: response.status,
            url: finalUrl,
            method: finalMethod,
            response: data,
            ...(retryAfter !== undefined ? { retryAfter } : {})
          });
          this.metrics.recordFailure(duration);
          await finalConfig.onRequestEnd?.({ method: finalMethod, url: finalUrl, status: response.status, duration, error: httpError });
          throw httpError;
        }

        const intercepted = await this.interceptors.runResponse(result);
        const finalResponse = await this.plugins.runAfter(intercepted);

        if (finalCacheEnabled) this.cache.set(finalCacheKey, finalResponse, finalConfig.cacheOptions?.ttl ?? 0, finalConfig.cacheOptions?.maxEntries ?? 100);
        this.metrics.recordSuccess(duration);
        await finalConfig.onRequestEnd?.({ method: finalMethod, url: finalUrl, status: response.status, duration });
        if (ThusConfig.debug) logger.success(`${finalMethod} ${sanitizeUrl(finalUrl)} ${response.status} (${duration}ms)`);
        return finalResponse.data as T;
      } catch (error) {
        if (ThusConfig.debug && error instanceof ThusError) logger.error(`${error.code} ${error.message}`);
        throw error;
      } finally {
        if (timeoutId !== undefined) clearTimeout(timeoutId);
      }
    };

    const retryValue = config.retry ?? this.defaults.retry;
    const retryValueWithHook: RetryOptions = typeof retryValue === "number"
      ? { attempts: retryValue, onRetry: async (context) => {
          this.metrics.recordRetry();
          await mergedConfig.onRetry?.(context);
        } }
      : { ...(retryValue ?? {}), onRetry: async (context) => {
          this.metrics.recordRetry();
          await retryValue?.onRetry?.(context);
          await mergedConfig.onRetry?.(context);
        } };
    this.metrics.recordStart();
    try {
      return await retry(execute, retryValue === undefined ? undefined : retryValueWithHook, { method, url });
    } finally {
      if (deadlineId !== undefined) clearTimeout(deadlineId);
    }
  }

  get<T = unknown>(url: string, config: Omit<Partial<RequestConfig>, "url" | "method" | "body"> = {}): Promise<T> {
    return this.request<T>({ ...config, url, method: "GET" });
  }

  post<T = unknown>(url: string, body?: unknown, config: Omit<Partial<RequestConfig>, "url" | "method" | "body"> = {}): Promise<T> {
    return this.request<T>({ ...config, url, body, method: "POST" });
  }

  put<T = unknown>(url: string, body?: unknown, config: Omit<Partial<RequestConfig>, "url" | "method" | "body"> = {}): Promise<T> {
    return this.request<T>({ ...config, url, body, method: "PUT" });
  }

  patch<T = unknown>(url: string, body?: unknown, config: Omit<Partial<RequestConfig>, "url" | "method" | "body"> = {}): Promise<T> {
    return this.request<T>({ ...config, url, body, method: "PATCH" });
  }

  delete<T = unknown>(url: string, config: Omit<Partial<RequestConfig>, "url" | "method" | "body"> = {}): Promise<T> {
    return this.request<T>({ ...config, url, method: "DELETE" });
  }

  head<T = unknown>(url: string, config: Omit<Partial<RequestConfig>, "url" | "method" | "body"> = {}): Promise<T> {
    return this.request<T>({ ...config, url, method: "HEAD" });
  }

  options<T = unknown>(url: string, config: Omit<Partial<RequestConfig>, "url" | "method" | "body"> = {}): Promise<T> {
    return this.request<T>({ ...config, url, method: "OPTIONS" });
  }
}

export function createClient(defaults: Partial<RequestConfig> & RequestHooks = {}): ThusFetch {
  return new ThusFetch(defaults);
}
