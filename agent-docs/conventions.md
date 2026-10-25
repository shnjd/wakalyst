# Conventions

- **Names**: packages are `@wakalyst/<name>`; files are kebab-case; React
  components are PascalCase named exports (route files default-export).
- **Routes**: `apps/app/src/app/` holds routes only. Components go in
  `src/components/`, platform glue in `src/lib/` (`.web.ts` for web variants).
- **Styling**: plain React Native `StyleSheet` with tokens from
  `@wakalyst/theme`. Read colors through `useTheme()` from `@wakalyst/ui` so
  light and dark both work; no hard-coded colors in screens. Static styles go
  in `StyleSheet.create`, theme-dependent values inline.
- **State**: server data through TanStack Query hooks in `@wakalyst/query`;
  add a query key to `queryKeys` for each new query. Client state (settings)
  will use Zustand when it is needed.
- **Validation**: every WakaTime response and every Worker input goes through
  a Zod schema.
- **Errors**: throw `UnauthorizedError` for "sign in again", `WakaTimeError`
  for other HTTP failures.
- **Tests**: Vitest next to the code (`*.test.ts`). Pure logic in packages
  is tested before a screen uses it. The Worker is tested through
  `app.request()` with an in-memory KV and a stubbed `fetch`.
- **Formatting**: Biome (2 spaces, double quotes, 100 columns). `pnpm fix`.
