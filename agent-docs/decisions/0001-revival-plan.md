# 0001: Restart on Expo SDK 57 with a Hono auth Worker

Date: 2026-10-11. Status: accepted.

The repo held a scaffold (Expo SDK 52, Next.js landing page, a Worker with
broken OAuth), so it was restarted in place instead of migrated SDK by SDK.

- **Tooling**: pnpm workspaces with a version catalog, Turborepo, Biome,
  TypeScript 6.0, Vitest 5.
- **App**: Expo SDK 57 + Expo Router for iOS, Android and web. The Next.js
  landing app is dropped; its copy is on the sign-in screen.
- **Styling**: plain React Native `StyleSheet` with shared theme tokens,
  instead of the proposed Uniwind (owner's choice).
- **Auth**: a Cloudflare Worker on Hono owns the client secret. Native apps
  get tokens through a one-time code bound to a PKCE verifier and keep them in
  SecureStore; the web app never sees tokens and goes through the Worker's
  cookie-backed proxy.
- **Desktop**: later, by wrapping the web build with Tauri.
- **Versions**: Expo-managed packages change only through `expo install`;
  pnpm `overrides` pin peers that pnpm would otherwise auto-install at
  versions SDK 57 doesn't support.
