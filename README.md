# Wakalyst

A minimal, unofficial [WakaTime](https://wakatime.com) client for iOS, Android
and the web.

- `apps/app`: the Expo app
- `apps/worker`: the Cloudflare Worker that signs users in with WakaTime and proxies the web app's API calls
- `packages/*`: shared TypeScript (API client, auth, queries, theme, UI)

See [agent-docs/setup.md](agent-docs/setup.md) to run it locally and
[AGENTS.md](AGENTS.md) for the everyday commands.
