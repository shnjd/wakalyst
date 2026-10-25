import { parseOAuthTokenResponse, WAKATIME_URL } from "@wakalyst/api";
import { type TokenSet, toTokenSet } from "@wakalyst/auth/session";

export type OAuthConfig = {
  clientId: string;
  clientSecret: string;
  /** This Worker's `/callback`, registered as a redirect URI in the WakaTime app. */
  redirectUri: string;
};

/** WakaTime refused the grant (bad code, revoked or expired refresh token). */
export class GrantError extends Error {
  constructor(readonly status: number) {
    super(`WakaTime rejected the grant with ${status}`);
    this.name = "GrantError";
  }
}

export function authorizeUrl(config: OAuthConfig, scopes: string, state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: scopes,
    state,
  });
  return `${WAKATIME_URL}/oauth/authorize?${params}`;
}

async function postForm(path: string, form: Record<string, string>): Promise<Response> {
  return fetch(`${WAKATIME_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams(form),
  });
}

async function requestTokens(
  config: OAuthConfig,
  grant: Record<string, string>,
): Promise<TokenSet> {
  const res = await postForm("/oauth/token", {
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    ...grant,
  });
  if (res.status >= 400 && res.status < 500) throw new GrantError(res.status);
  if (!res.ok) throw new Error(`WakaTime token endpoint failed with ${res.status}`);
  return toTokenSet(parseOAuthTokenResponse(await res.text(), res.headers.get("Content-Type")));
}

export function exchangeCode(config: OAuthConfig, code: string): Promise<TokenSet> {
  return requestTokens(config, { grant_type: "authorization_code", code });
}

export function refreshTokens(config: OAuthConfig, refreshToken: string): Promise<TokenSet> {
  return requestTokens(config, { grant_type: "refresh_token", refresh_token: refreshToken });
}

export async function revokeToken(config: OAuthConfig, token: string): Promise<void> {
  const res = await postForm("/oauth/revoke", {
    client_id: config.clientId,
    client_secret: config.clientSecret,
    token,
  });
  // A token that is already invalid is as good as revoked.
  if (res.status >= 500) throw new Error(`WakaTime revoke failed with ${res.status}`);
}
