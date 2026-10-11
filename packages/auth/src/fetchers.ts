import { type Fetcher, UnauthorizedError, WAKATIME_API_URL } from "@wakalyst/api";
import type { AuthClient } from "./client";
import type { SessionStorage, TokenSet } from "./session";

/** Refresh this long before the access token actually expires. */
const EXPIRY_MARGIN_MS = 60_000;

export type NativeFetcherOptions = {
  auth: AuthClient;
  storage: SessionStorage;
  fetchImpl?: typeof fetch;
  now?: () => number;
};

/**
 * Native: call WakaTime directly with the stored bearer token. Refreshes
 * ahead of expiry and once more on a 401; a failed refresh clears the
 * session and surfaces as `UnauthorizedError`.
 */
export function createNativeFetcher({
  auth,
  storage,
  fetchImpl = fetch,
  now = Date.now,
}: NativeFetcherOptions): Fetcher {
  let refreshing: Promise<TokenSet> | null = null;

  function refresh(tokens: TokenSet): Promise<TokenSet> {
    refreshing ??= auth
      .refresh(tokens.refreshToken)
      .then(async (next) => {
        await storage.set(next);
        return next;
      })
      .catch(async (err) => {
        if (err instanceof UnauthorizedError) await storage.clear();
        throw err;
      })
      .finally(() => {
        refreshing = null;
      });
    return refreshing;
  }

  const send = (path: string, init: RequestInit | undefined, tokens: TokenSet) => {
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${tokens.accessToken}`);
    return fetchImpl(`${WAKATIME_API_URL}${path}`, { ...init, headers });
  };

  return async (path, init) => {
    let tokens = await storage.get();
    if (!tokens) throw new UnauthorizedError();
    if (tokens.expiresAt - EXPIRY_MARGIN_MS <= now()) tokens = await refresh(tokens);

    const res = await send(path, init, tokens);
    if (res.status !== 401) return res;
    return send(path, init, await refresh(tokens));
  };
}

export type WebFetcherOptions = {
  auth: AuthClient;
  fetchImpl?: typeof fetch;
};

/**
 * Web: call WakaTime through the Worker's `/api/v1/*` proxy, which adds the
 * token from its httpOnly cookie. On a 401, asks the Worker to refresh the
 * cookie and retries once.
 */
export function createWebFetcher({ auth, fetchImpl = fetch }: WebFetcherOptions): Fetcher {
  const send = (path: string, init?: RequestInit) =>
    fetchImpl(`${auth.url}/api/v1${path}`, { ...init, credentials: "include" });

  return async (path, init) => {
    const res = await send(path, init);
    if (res.status !== 401) return res;
    await auth.refreshCookie();
    return send(path, init);
  };
}
