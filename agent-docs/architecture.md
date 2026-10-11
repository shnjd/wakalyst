# Architecture

## Layout

```
apps/
  app/        Expo SDK 57 app (Expo Router): iOS, Android, web
  auth/       Cloudflare Worker (Hono): OAuth with WakaTime, web API proxy
packages/
  api/        Typed WakaTime client + Zod schemas. No React.
  auth/       Token model, auth Worker client, native and web fetchers. No React.
  query/      TanStack Query client, provider and hooks over api/
  theme/      Design tokens (palette, spacing, radius, type) + color helpers
  ui/         Shared React Native components (StyleSheet + theme tokens)
  tsconfig/   Shared TS configs
```

Packages export TypeScript source (`"exports": "./src/index.ts"`); Metro,
Wrangler and Vitest compile it, so there is no build step between packages.

## Data flow

`createWakaTimeClient(fetcher)` (api/) parses responses with Zod and maps a 401
to `UnauthorizedError`. The fetcher decides how a request is authenticated:

- **Native** (`createNativeFetcher`): tokens in SecureStore, requests go
  straight to `https://wakatime.com/api/v1` with a bearer token. It refreshes
  a minute before expiry and once more on a 401; a rejected refresh clears the
  session.
- **Web** (`createWebFetcher`): requests go to the Worker's `/api/v1/*` proxy
  with `credentials: "include"`; the Worker adds the token from an httpOnly
  cookie. On a 401 it asks the Worker to refresh the cookie and retries once.

`apps/app/src/lib/session.ts` and `session.web.ts` pick the fetcher per
platform (Metro resolves `.web.ts` on web). Screens use hooks from query/,
which never retry an `UnauthorizedError`; the home screen shows sign-in when
the current-user query fails with it.

## Sign-in flow

1. The app opens `GET {worker}/authorize?platform=…&redirect_uri=…` (native
   adds a PKCE `code_challenge`). The Worker checks `redirect_uri` against
   `ALLOWED_REDIRECTS`, stores the request in KV under a random state for 5
   minutes and redirects to WakaTime with `redirect_uri={worker}/callback`.
2. WakaTime returns to `{worker}/callback`. The Worker takes (reads and
   deletes) the state and exchanges the code using the client secret.
3. Native: the tokens are stored in KV under a one-time code for 60 seconds
   and the browser is sent to `wakalyst://auth?code=…`. The app posts the code
   and its PKCE verifier to `/token` and keeps the tokens in SecureStore. The
   verifier means an app that intercepts the redirect can't redeem the code.
4. Web: the Worker sets `__Host-wk_at` / `__Host-wk_rt` (httpOnly, Secure,
   SameSite=None) and redirects to the web app.
5. `/refresh` renews tokens (native: refresh token in the body; web: cookie).
   `/revoke` revokes at WakaTime (native: access token in the body; web:
   cookie, which it also clears).

Cookie-authenticated POSTs must carry an `Origin` from the allowlist (CSRF
guard). CORS allows the origins of the allowlist's http(s) entries, with
credentials. Errors from WakaTime come back to the app as `?error=…`.
