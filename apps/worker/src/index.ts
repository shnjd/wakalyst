import { WAKATIME_API_URL } from "@wakalyst/api";
import type { TokenSet } from "@wakalyst/auth/session";
import { type Context, Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { cors } from "hono/cors";
import type { CookieOptions } from "hono/utils/cookie";
import { z } from "zod";
import { codeChallenge } from "./crypto";
import { allowedOrigins, isAllowedRedirect, parseAllowList } from "./redirects";
import { saveHandoff, saveState, takeHandoff, takeState } from "./store";
import {
  authorizeUrl,
  exchangeCode,
  GrantError,
  type OAuthConfig,
  refreshTokens,
  revokeToken,
} from "./wakatime";

type AppEnv = { Bindings: Env };
type Ctx = Context<AppEnv>;

const ACCESS_COOKIE = "wk_at";
const REFRESH_COOKIE = "wk_rt";
/** Browsers cap cookie lifetimes at 400 days, and Hono refuses to set a longer Max-Age. */
const MAX_COOKIE_AGE = 400 * 24 * 60 * 60;

// "__Host-" cookies: Secure, Path=/, no Domain. SameSite=None so a web app on
// another site can still send them with `credentials: "include"`.
const cookieBase = { prefix: "host", httpOnly: true, sameSite: "None" } satisfies CookieOptions;

function oauthConfig(c: Ctx): OAuthConfig {
  return {
    clientId: c.env.WAKATIME_CLIENT_ID,
    clientSecret: c.env.WAKATIME_CLIENT_SECRET,
    redirectUri: `${new URL(c.req.url).origin}/callback`,
  };
}

/** `ALLOWED_REDIRECTS` plus this Worker's own origin, which serves the web app. */
const allowList = (c: Ctx) => [
  ...parseAllowList(c.env.ALLOWED_REDIRECTS),
  `${new URL(c.req.url).origin}/`,
];

/** Cookie-authenticated POSTs must come from an allowed web origin (CSRF guard). */
const fromAllowedOrigin = (c: Ctx) =>
  allowedOrigins(allowList(c)).has(c.req.header("Origin") ?? "");

function setSessionCookies(c: Ctx, tokens: TokenSet) {
  // WakaTime access tokens can outlive the cookie cap; /refresh renews them after that.
  const maxAge = Math.min(
    MAX_COOKIE_AGE,
    Math.max(0, Math.floor((tokens.expiresAt - Date.now()) / 1000)),
  );
  setCookie(c, ACCESS_COOKIE, tokens.accessToken, { ...cookieBase, maxAge });
  setCookie(c, REFRESH_COOKIE, tokens.refreshToken, {
    ...cookieBase,
    maxAge: MAX_COOKIE_AGE,
  });
}

function clearSessionCookies(c: Ctx) {
  deleteCookie(c, ACCESS_COOKIE, cookieBase);
  deleteCookie(c, REFRESH_COOKIE, cookieBase);
}

async function jsonBody<T>(c: Ctx, schema: z.ZodType<T>): Promise<T | null> {
  const body = await c.req.json().catch(() => undefined);
  const parsed = schema.safeParse(body);
  return parsed.success ? parsed.data : null;
}

function withQuery(uri: string, params: Record<string, string>): string {
  const separator = uri.includes("?") ? "&" : "?";
  return `${uri}${separator}${new URLSearchParams(params)}`;
}

const authorizeQuery = z.discriminatedUnion("platform", [
  z.object({
    platform: z.literal("native"),
    redirect_uri: z.string(),
    code_challenge: z.string().min(43).max(128),
  }),
  z.object({ platform: z.literal("web"), redirect_uri: z.string() }),
]);

export const app = new Hono<AppEnv>();

app.use("*", (c, next) =>
  cors({
    origin: (origin) => (allowedOrigins(allowList(c)).has(origin) ? origin : null),
    credentials: true,
    allowMethods: ["GET", "POST"],
    allowHeaders: ["Content-Type"],
  })(c, next),
);

app.onError((err, c) => {
  // Workers Logs can drop the first line of a stack, so log the message on its own.
  console.error(`${c.req.method} ${c.req.path} failed: ${err.name}: ${err.message}`, err.stack);
  return c.text("server_error", 500);
});

/** Start sign-in: remember where to return, then send the browser to WakaTime. */
app.get("/authorize", async (c) => {
  const query = authorizeQuery.safeParse(c.req.query());
  if (!query.success) return c.text("invalid_request", 400);
  if (!isAllowedRedirect(query.data.redirect_uri, allowList(c))) {
    return c.text("redirect_uri_not_allowed", 400);
  }

  const state = await saveState(
    c.env.AUTH_STATES,
    query.data.platform === "native"
      ? {
          platform: "native",
          redirectUri: query.data.redirect_uri,
          codeChallenge: query.data.code_challenge,
        }
      : { platform: "web", redirectUri: query.data.redirect_uri },
  );
  return c.redirect(authorizeUrl(oauthConfig(c), c.env.WAKATIME_SCOPES, state));
});

/** WakaTime returns here. Native gets a one-time code; web gets cookies. */
app.get("/callback", async (c) => {
  const state = c.req.query("state");
  const pending = state ? await takeState(c.env.AUTH_STATES, state) : null;
  if (!pending) return c.text("invalid_state", 400);

  const code = c.req.query("code");
  if (!code) {
    return c.redirect(withQuery(pending.redirectUri, { error: c.req.query("error") ?? "denied" }));
  }

  let tokens: TokenSet;
  try {
    tokens = await exchangeCode(oauthConfig(c), code);
  } catch (err) {
    if (!(err instanceof GrantError)) throw err;
    return c.redirect(withQuery(pending.redirectUri, { error: "invalid_grant" }));
  }

  if (pending.platform === "native") {
    const handoff = await saveHandoff(c.env.AUTH_STATES, tokens, pending.codeChallenge);
    return c.redirect(withQuery(pending.redirectUri, { code: handoff }));
  }

  // Every sign-in mints a new WakaTime token, so revoke the one this browser held before.
  const previous = getCookie(c, ACCESS_COOKIE, "host");
  if (previous && previous !== tokens.accessToken) {
    await revokeToken(oauthConfig(c), previous).catch((err) => console.error("revoke failed", err));
  }

  setSessionCookies(c, tokens);
  return c.redirect(pending.redirectUri);
});

/** Native: trade the one-time code (plus the PKCE verifier) for tokens. */
app.post("/token", async (c) => {
  const body = await jsonBody(c, z.object({ code: z.string(), code_verifier: z.string() }));
  if (!body) return c.text("invalid_request", 400);

  const handoff = await takeHandoff(c.env.AUTH_STATES, body.code);
  if (!handoff || (await codeChallenge(body.code_verifier)) !== handoff.codeChallenge) {
    return c.text("invalid_grant", 400);
  }
  return c.json(handoff.tokens);
});

/** Native: body carries the refresh token. Web: the refresh cookie does. */
app.post("/refresh", async (c) => {
  const body = await jsonBody(c, z.object({ refresh_token: z.string().min(1) }));
  const isWeb = !body;
  if (isWeb && !fromAllowedOrigin(c)) return c.text("forbidden", 403);

  const refreshToken = body?.refresh_token ?? getCookie(c, REFRESH_COOKIE, "host");
  if (!refreshToken) return c.text("unauthorized", 401);

  let tokens: TokenSet;
  try {
    tokens = await refreshTokens(oauthConfig(c), refreshToken);
  } catch (err) {
    if (!(err instanceof GrantError)) throw err;
    if (isWeb) clearSessionCookies(c);
    return c.text("unauthorized", 401);
  }

  if (!isWeb) return c.json(tokens);
  setSessionCookies(c, tokens);
  return c.body(null, 204);
});

/** Sign out. Native sends the access token; web uses (and clears) the cookies. */
app.post("/revoke", async (c) => {
  const body = await jsonBody(c, z.object({ token: z.string().min(1) }));
  if (body) {
    await revokeToken(oauthConfig(c), body.token);
    return c.body(null, 204);
  }

  if (!fromAllowedOrigin(c)) return c.text("forbidden", 403);
  const token = getCookie(c, ACCESS_COOKIE, "host");
  clearSessionCookies(c);
  if (token) await revokeToken(oauthConfig(c), token);
  return c.body(null, 204);
});

/** Web: read-only proxy to the WakaTime API that adds the cookie's token. */
app.get("/api/v1/*", async (c) => {
  const token = getCookie(c, ACCESS_COOKIE, "host");
  if (!token) return c.text("unauthorized", 401);

  const url = new URL(c.req.url);
  const upstream = await fetch(
    `${WAKATIME_API_URL}${url.pathname.slice("/api/v1".length)}${url.search}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
  );
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
      "Cache-Control": "private, no-store",
    },
  });
});

export default app;
