import { createWakaTimeClient } from "@wakalyst/api";
import {
  createAuthClient,
  createNativeFetcher,
  type SessionStorage,
  tokenSetSchema,
} from "@wakalyst/auth";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { AUTH_URL } from "./config";

// Native: tokens live in SecureStore and the app calls WakaTime directly.
// The web version of this module is session.web.ts.

const STORAGE_KEY = "wakalyst.session";

const storage: SessionStorage = {
  async get() {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) return null;
    const parsed = tokenSetSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  },
  set: (tokens) => SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(tokens)),
  clear: () => SecureStore.deleteItemAsync(STORAGE_KEY),
};

const auth = createAuthClient(AUTH_URL);

export const wakatime = createWakaTimeClient(createNativeFetcher({ auth, storage }));

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function pkceChallenge(verifier: string): Promise<string> {
  const base64 = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
    encoding: Crypto.CryptoEncoding.BASE64,
  });
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Where the Worker sends the browser back to. Builds use the app's own scheme;
 * `Linking.createURL` can fold the dev server's host into it in development
 * builds, which the Worker's allowlist would reject. Expo Go has no custom
 * scheme, so it gets `exp://<host>/--/auth`.
 */
function authRedirectUri(): string {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return Linking.createURL("auth");
  }
  const scheme = Constants.expoConfig?.scheme;
  return `${(Array.isArray(scheme) ? scheme[0] : scheme) ?? "wakalyst"}://auth`;
}

/**
 * Opens WakaTime sign-in in the system browser. Resolves `true` once tokens
 * are stored, `false` if the user closed the browser.
 */
export async function signIn(): Promise<boolean> {
  const verifier = toHex(Crypto.getRandomBytes(32));
  const redirectUri = authRedirectUri();
  const url = auth.authorizeUrl({
    platform: "native",
    redirectUri,
    codeChallenge: await pkceChallenge(verifier),
  });

  const result = await WebBrowser.openAuthSessionAsync(url, redirectUri);
  if (result.type !== "success") return false;

  const { queryParams } = Linking.parse(result.url);
  const code = queryParams?.code;
  if (typeof code !== "string") {
    throw new Error(`Sign-in failed: ${queryParams?.error ?? "no code returned"}`);
  }
  await storage.set(await auth.exchange(code, verifier));
  return true;
}

export async function signOut(): Promise<void> {
  const tokens = await storage.get();
  await storage.clear();
  // Best effort: the local session is gone either way.
  if (tokens) await auth.revoke(tokens.accessToken).catch(() => undefined);
}
