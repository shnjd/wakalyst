# Setup

## Install

```bash
nvm use            # Node 24 (22.13+ works)
npm i -g pnpm@12   # or corepack, if your corepack knows pnpm 12
pnpm install
```

## WakaTime app

Create an app at https://wakatime.com/apps and add the Worker's callback as a
redirect URI, for example `http://localhost:8787/callback` for local work and
`https://wakalyst-auth.<account>.workers.dev/callback` once deployed.

## Auth Worker (`apps/auth`)

```bash
cd apps/auth
cp .dev.vars.example .dev.vars        # fill in the client ID and secret
pnpm dev                              # http://localhost:8787
```

`ALLOWED_REDIRECTS` lists where the Worker may send users back to (see
`wrangler.jsonc`). `.dev.vars.example` also allows `exp://` for Expo Go.

Deploy:

```bash
npx wrangler login
npx wrangler kv namespace create AUTH_STATES   # only if the id in wrangler.jsonc isn't yours
npx wrangler secret put WAKATIME_CLIENT_ID
npx wrangler secret put WAKATIME_CLIENT_SECRET
pnpm run deploy                        # "pnpm deploy" is a different, built-in pnpm command
```

Then set `ALLOWED_REDIRECTS` in `wrangler.jsonc` to include the deployed web
app's URL (ending in `/`), and add the deployed `/callback` URL to the
WakaTime app.

After changing `wrangler.jsonc` vars, run `pnpm typegen` to refresh
`worker-configuration.d.ts`.

## App (`apps/app`)

```bash
cd apps/app
cp .env.example .env.local    # EXPO_PUBLIC_AUTH_URL
pnpm dev                      # then press w, i or a
```

- **Web**: works against the local Worker on `localhost` in Chrome and
  Firefox. Safari does not keep `Secure` cookies on plain `http://localhost`;
  use a deployed Worker over HTTPS there.
- **iOS / Android**: SecureStore and the `wakalyst://` scheme need a
  development build (`npx expo run:ios` / `run:android`, or EAS). Set
  `EXPO_PUBLIC_AUTH_URL` to an address the device can reach (LAN IP or the
  deployed Worker), never `localhost`.

## Web hosting and cookies

The Worker's cookies are `SameSite=None`, so a web app on another site can use
them, but browsers that block third-party cookies (Safari, Chrome with
third-party cookies off) need the web app and the Worker on the same site,
for example `app.example.dev` and `auth.example.dev`.
