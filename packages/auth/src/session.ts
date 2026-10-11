import type { OAuthTokenResponse } from "@wakalyst/api";
import { z } from "zod";

/** The tokens a native app keeps. The web app never holds these; the Worker keeps them in cookies. */
export const tokenSetSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  /** Epoch milliseconds. */
  expiresAt: z.number(),
});
export type TokenSet = z.infer<typeof tokenSetSchema>;

/** Used when WakaTime omits both `expires_at` and `expires_in`. */
const DEFAULT_LIFETIME_MS = 60 * 60 * 1000;

export function toTokenSet(res: OAuthTokenResponse, now = Date.now()): TokenSet {
  const fromDate = res.expires_at ? Date.parse(res.expires_at) : Number.NaN;
  const expiresAt = Number.isFinite(fromDate)
    ? fromDate
    : now + (res.expires_in ? res.expires_in * 1000 : DEFAULT_LIFETIME_MS);
  return { accessToken: res.access_token, refreshToken: res.refresh_token, expiresAt };
}

/** Where a native app persists its tokens (SecureStore in the app, memory in tests). */
export interface SessionStorage {
  get(): Promise<TokenSet | null>;
  set(tokens: TokenSet): Promise<void>;
  clear(): Promise<void>;
}

export function createMemoryStorage(initial: TokenSet | null = null): SessionStorage {
  let tokens = initial;
  return {
    get: async () => tokens,
    set: async (next) => {
      tokens = next;
    },
    clear: async () => {
      tokens = null;
    },
  };
}
