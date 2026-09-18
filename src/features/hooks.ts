export type RequestHooks = {
  onRequestStart?: (context: { method: string; url: string }) => void | Promise<void>;
  onRequestEnd?: (context: { method: string; url: string; status?: number; duration: number; error?: unknown }) => void | Promise<void>;
  onRetry?: (context: { attempt: number; method?: string; url?: string; error: unknown }) => void | Promise<void>;
};
