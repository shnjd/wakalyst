# Wakalyst

An unofficial WakaTime client for iOS, Android and web (desktop later), in one
pnpm + Turborepo monorepo. Read `agent-docs/` before larger changes:

- [architecture.md](agent-docs/architecture.md): packages, data flow, sign-in flow
- [conventions.md](agent-docs/conventions.md): naming, folders, styling, state
- [setup.md](agent-docs/setup.md): local setup per platform, secrets, Worker dev
- [wakatime-api.md](agent-docs/wakatime-api.md): endpoints used and their quirks
- [decisions/](agent-docs/decisions/): one short file per decision

## Commands

Run from the repo root. Node 22.13+ (24 LTS recommended) and pnpm 12.

```bash
pnpm install                         # install everything
pnpm check                           # Biome lint + format check (pnpm fix to apply)
pnpm typecheck                       # tsc in every package
pnpm test                            # Vitest in every package
pnpm --filter @wakalyst/app build    # web export of the Expo app
pnpm --filter @wakalyst/app dev      # Expo dev server
pnpm --filter @wakalyst/worker dev   # auth Worker on :8787
```

Before calling a task done, run `pnpm check`, `pnpm typecheck` and `pnpm test`.

## Rules

- Add or change Expo-managed packages only with `npx expo install <pkg>` inside
  `apps/app`, never by editing versions by hand. `expo install` needs the Expo
  API; with no network to it, `EXPO_OFFLINE=1` uses the SDK's bundled versions.
- Versions shared across packages live in the `catalog:` in `pnpm-workspace.yaml`.
- Screens and platform glue live in `apps/`; anything a desktop shell could
  reuse lives in `packages/`.
- The WakaTime client secret only ever exists in the auth Worker.
- Expo changes between SDKs: check the installed package's types or
  https://docs.expo.dev/versions/v57.0.0/ instead of relying on memory.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
