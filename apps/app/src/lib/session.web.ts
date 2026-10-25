import { createWakaTimeClient } from "@wakalyst/api";
import { createAuthClient, createWebFetcher } from "@wakalyst/auth";
import { AUTH_URL } from "./config";

// Web: the Worker keeps the tokens in httpOnly cookies and proxies WakaTime
// calls, so no token ever reaches this JavaScript.

const auth = createAuthClient(AUTH_URL);

export const wakatime = createWakaTimeClient(createWebFetcher({ auth }));

/** Navigates away to WakaTime; the Worker sends the browser back here signed in. */
export async function signIn(): Promise<boolean> {
  window.location.assign(
    auth.authorizeUrl({ platform: "web", redirectUri: `${window.location.origin}/` }),
  );
  return false;
}

export async function signOut(): Promise<void> {
  await auth.revoke();
}
