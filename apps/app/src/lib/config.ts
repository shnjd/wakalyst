/**
 * The auth Worker. "/" means this site: the web build the Worker itself
 * serves (`pnpm build:hosted`). Native builds need a full URL.
 */
export const AUTH_URL = process.env.EXPO_PUBLIC_AUTH_URL ?? "http://localhost:8787";
