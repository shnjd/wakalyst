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

## Auth Worker (`apps/worker`, deployed as `wakalyst-auth`)

```bash
cd apps/worker
cp .dev.vars.example .dev.vars        # fill in the client ID and secret
pnpm dev                              # http://localhost:8787
```

`pnpm dev` also serves whatever web build is in `apps/app/dist`; run
`pnpm --filter @wakalyst/app build:hosted` to refresh it.

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

`pnpm run deploy` first builds the web app with `EXPO_PUBLIC_AUTH_URL=/`
(`build:hosted`), then deploys the Worker with that build as its static
assets. The web app is then at the Worker's own URL, and the Worker always
accepts its own origin, so `ALLOWED_REDIRECTS` needs no change for it. Add the
deployed `/callback` URL to the WakaTime app.

After changing `wrangler.jsonc` vars, run `pnpm typegen` to refresh
`worker-configuration.d.ts`.

## App (`apps/app`)

```bash
cd apps/app
cp .env.example .env.local    # EXPO_PUBLIC_AUTH_URL
pnpm dev                      # then press w, i or a
```

- **Web**: point it at the local Worker (`http://localhost:8787`), which is
  the same site as `localhost:8081`. Pointing a localhost app at the deployed
  Worker does not work: its cookies are third-party there (see below). To test
  the deployed Worker, open its URL; it serves the web app itself. Safari does
  not keep `Secure` cookies on plain `http://localhost`.
- **iOS / Android**: SecureStore and the `wakalyst://` scheme need a
  development build (`npx expo run:ios` / `run:android`, or EAS). Set
  `EXPO_PUBLIC_AUTH_URL` to an address the device can reach (LAN IP or the
  deployed Worker), never `localhost`.

## Web hosting and cookies

The web app keeps no tokens: the Worker holds them in httpOnly cookies. Those
cookies only reach the Worker when the page and the Worker are the same site.
Firefox (Total Cookie Protection), Safari and any browser blocking third-party
cookies drop them otherwise. So the deployed web app is served by the Worker
itself (same origin). The cookies stay `SameSite=None` so local development
across ports and Chrome's default settings keep working.

## CI/CD

- **Checks** (`.github/workflows/ci.yml`, job `check`): lint, typecheck,
  tests, `expo install --check` and a web export on every PR and push to main.
- **Auth Worker** (same file, job `deploy-worker`): after `check` passes on a
  push to main, runs `pnpm run deploy` in `apps/worker`, which builds the
  hosted web app and deploys `wakalyst-auth` with it. Needs the GitHub
  repository secrets `CLOUDFLARE_API_TOKEN` (the "Edit Cloudflare Workers"
  template) and `CLOUDFLARE_ACCOUNT_ID`. The WakaTime secrets stay on the
  Worker; a deploy doesn't touch them.
- **App builds** run on EAS Workflows (`apps/app/.eas/workflows`), configured
  by `apps/app/eas.json`. They need the GitHub repository linked to the Expo
  project with base directory `apps/app`
  (expo.dev → project → GitHub settings).
  - `preview.yml`: Android APK (internal distribution) on pushes to main that
    touch the app, `packages/` or the lockfile.
  - `production.yml`: Android and iOS store builds on a `v*` tag. iOS needs
    Apple credentials first: `eas credentials:configure-build -p ios -e production`.
  - Run either by hand from `apps/app`: `npx eas-cli workflow:run .eas/workflows/preview.yml`.

Native builds point at the deployed Worker through `EXPO_PUBLIC_AUTH_URL` in
`eas.json`. Build numbers live on EAS (`appVersionSource: remote`) and
production builds bump them automatically.
