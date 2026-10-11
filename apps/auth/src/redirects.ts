/** Parse the comma-separated `ALLOWED_REDIRECTS` var. */
export function parseAllowList(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * An entry ending in "/" allows any URL under it; any other entry must match
 * exactly. So "http://localhost:8081/" allows "http://localhost:8081/x" but
 * not "http://localhost:8081.evil.dev/".
 */
export function isAllowedRedirect(uri: string, allowList: string[]): boolean {
  return allowList.some((entry) => (entry.endsWith("/") ? uri.startsWith(entry) : uri === entry));
}

/** Origins of the http(s) entries: the web apps allowed to call the Worker with cookies. */
export function allowedOrigins(allowList: string[]): Set<string> {
  const origins = new Set<string>();
  for (const entry of allowList) {
    if (!/^https?:\/\//.test(entry)) continue;
    try {
      origins.add(new URL(entry).origin);
    } catch {
      // Ignore malformed entries; they can never match a real Origin header.
    }
  }
  return origins;
}
