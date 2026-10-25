import { UnauthorizedError, WakaTimeError } from "@wakalyst/api";
import { type TokenSet, tokenSetSchema } from "./session";

export type Platform = "native" | "web";

export type AuthorizeParams =
  | { platform: "native"; redirectUri: string; codeChallenge: string }
  | { platform: "web"; redirectUri: string };

export type AuthClient = ReturnType<typeof createAuthClient>;

/**
 * Talks to the auth Worker. Native calls send tokens in the body; web calls
 * send no tokens and rely on the Worker's httpOnly cookies instead.
 */
export function createAuthClient(authUrl: string, fetchImpl: typeof fetch = fetch) {
  const base = authUrl.replace(/\/+$/, "");

  async function post(path: string, body?: unknown): Promise<Response> {
    const res = await fetchImpl(`${base}${path}`, {
      method: "POST",
      credentials: "include",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 400 || res.status === 401) throw new UnauthorizedError();
    if (!res.ok) throw new WakaTimeError(res.status, `POST ${path} failed with ${res.status}`);
    return res;
  }

  return {
    url: base,

    /** The URL to open in a browser to start sign-in. */
    authorizeUrl(params: AuthorizeParams): string {
      const query = new URLSearchParams({
        platform: params.platform,
        redirect_uri: params.redirectUri,
      });
      if (params.platform === "native") query.set("code_challenge", params.codeChallenge);
      return `${base}/authorize?${query}`;
    },

    /** Native: trade the one-time code from the `wakalyst://auth` redirect for tokens. */
    async exchange(code: string, codeVerifier: string): Promise<TokenSet> {
      const res = await post("/token", { code, code_verifier: codeVerifier });
      return tokenSetSchema.parse(await res.json());
    },

    /** Native: get fresh tokens. */
    async refresh(refreshToken: string): Promise<TokenSet> {
      const res = await post("/refresh", { refresh_token: refreshToken });
      return tokenSetSchema.parse(await res.json());
    },

    /** Web: renew the access-token cookie from the refresh-token cookie. */
    async refreshCookie(): Promise<void> {
      await post("/refresh");
    },

    /** Native: revoke this access token. Web: revoke the cookie's token and clear the cookies. */
    async revoke(accessToken?: string): Promise<void> {
      await post("/revoke", accessToken === undefined ? undefined : { token: accessToken });
    },
  };
}
