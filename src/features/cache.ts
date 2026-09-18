import type { ResponseData } from "../core/client";

export type CacheOptions = {
  ttl?: number;
  key?: string;
  staleWhileRevalidate?: boolean;
  maxEntries?: number;
};

type CacheEntry = {
  expiresAt: number;
  response: ResponseData;
  etag?: string;
  lastModified?: string;
};

export class MemoryCache {
  private readonly entries = new Map<string, CacheEntry>();

  get(key: string): CacheEntry | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry;
  }

  getExpired(key: string): CacheEntry | undefined {
    return this.entries.get(key);
  }

  set(key: string, response: ResponseData, ttl: number, maxEntries = 100): void {
    const cacheControl = response.headers.get("cache-control")?.toLowerCase() ?? "";
    if (cacheControl.includes("no-store") || cacheControl.includes("private")) return;
    this.entries.delete(key);
    this.entries.set(key, {
      expiresAt: Date.now() + Math.max(0, ttl),
      response,
      ...(response.headers.get("etag") ? { etag: response.headers.get("etag") as string } : {}),
      ...(response.headers.get("last-modified") ? { lastModified: response.headers.get("last-modified") as string } : {})
    });
    while (this.entries.size > Math.max(1, maxEntries)) {
      const first = this.entries.keys().next().value;
      if (first === undefined) break;
      this.entries.delete(first);
    }
  }

  delete(key: string): void { this.entries.delete(key); }
  clear(): void { this.entries.clear(); }

  refresh(key: string, ttl: number): void {
    const entry = this.entries.get(key);
    if (entry) entry.expiresAt = Date.now() + Math.max(0, ttl);
  }

  invalidate(prefix?: string): void {
    if (!prefix) { this.clear(); return; }
    for (const key of this.entries.keys()) if (key.startsWith(prefix)) this.entries.delete(key);
  }
}
