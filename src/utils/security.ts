export type SecurityOptions = {
  allowedHosts?: string[];
  allowedProtocols?: string[];
  allowPrivateNetwork?: boolean;
  maxResponseSize?: number;
  maxRequestSize?: number;
  allowRedirects?: boolean;
  maxRedirects?: number;
};

const DEFAULT_PROTOCOLS = new Set(["http:", "https:"]);
const PRIVATE_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);

function isPrivateIPv4(hostname: string): boolean {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const a = parts[0] as number;
  const b = parts[1] as number;
  return a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function isPrivateIPv6(hostname: string): boolean {
  const value = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!value.includes(":")) return false;
  if (value === "::1" || value === "::") return true;
  if (value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe8") || value.startsWith("fe9") || value.startsWith("fea") || value.startsWith("feb")) return true;
  const mapped = value.match(/::ffff:(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (mapped) return isPrivateIPv4(`${mapped[1]}.${mapped[2]}.${mapped[3]}.${mapped[4]}`);
  const compactMapped = value.match(/::ffff:([0-9a-f]{2})([0-9a-f]{2}):([0-9a-f]{2})([0-9a-f]{2})$/);
  if (compactMapped) {
    const parts = compactMapped.slice(1).map((part) => Number.parseInt(part, 16));
    return isPrivateIPv4(parts.join("."));
  }
  return false;
}

function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/\.$/, "");
}

export function validateUrl(url: string, options: SecurityOptions = {}): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid absolute request URL.");
  }

  const protocols = options.allowedProtocols ? new Set(options.allowedProtocols.map((value) => value.endsWith(":") ? value.toLowerCase() : `${value.toLowerCase()}:`)) : DEFAULT_PROTOCOLS;
  if (!protocols.has(parsed.protocol.toLowerCase())) throw new Error(`URL protocol ${parsed.protocol} is not allowed.`);
  if (parsed.username || parsed.password) throw new Error("URLs containing embedded credentials are not allowed.");

  const hostname = normalizeHost(parsed.hostname);
  if (!options.allowPrivateNetwork && (PRIVATE_HOSTS.has(hostname) || isPrivateIPv4(hostname) || isPrivateIPv6(hostname))) {
    throw new Error("Requests to private or loopback network addresses are disabled by default.");
  }

  if (options.allowedHosts?.length) {
    const allowed = options.allowedHosts.map((host) => normalizeHost(host.replace(/^\*\./, "")));
    const matches = allowed.some((host) => hostname === host || hostname.endsWith(`.${host}`));
    if (!matches) throw new Error(`Host ${hostname} is not allowed.`);
  }

  return parsed;
}

export function validateRedirectCount(value: number | undefined): void {
  if (value !== undefined && (!Number.isSafeInteger(value) || value < 0 || value > 20)) throw new Error("maxRedirects must be an integer between 0 and 20.");
}


export function validateSize(value: number | undefined, name: string): void {
  if (value !== undefined && (!Number.isSafeInteger(value) || value <= 0)) throw new Error(`${name} must be a positive safe integer.`);
}

export function isSensitiveQueryKey(key: string): boolean {
  return /^(?:token|access[_-]?token|refresh[_-]?token|api[_-]?key|apikey|key|secret|password|passwd|authorization|auth|signature|sig)$/i.test(key);
}

export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const keys: string[] = [];
    parsed.searchParams.forEach((_value, key) => keys.push(key));
    for (const key of keys) {
      if (isSensitiveQueryKey(key)) parsed.searchParams.set(key, "[REDACTED]");
    }
    return parsed.toString();
  } catch {
    return "[INVALID_URL]";
  }
}
