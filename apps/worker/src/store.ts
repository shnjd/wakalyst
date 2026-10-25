import { type TokenSet, tokenSetSchema } from "@wakalyst/auth/session";
import { z } from "zod";
import { randomToken } from "./crypto";

const STATE_TTL_SECONDS = 5 * 60;
/** KV's minimum TTL. */
const HANDOFF_TTL_SECONDS = 60;

const pendingSignInSchema = z.discriminatedUnion("platform", [
  z.object({ platform: z.literal("native"), redirectUri: z.string(), codeChallenge: z.string() }),
  z.object({ platform: z.literal("web"), redirectUri: z.string() }),
]);
export type PendingSignIn = z.infer<typeof pendingSignInSchema>;

const handoffSchema = z.object({ tokens: tokenSetSchema, codeChallenge: z.string() });
export type Handoff = z.infer<typeof handoffSchema>;

/** Read a key once: it is deleted whether or not it parses. */
async function take<T>(kv: KVNamespace, key: string, schema: z.ZodType<T>): Promise<T | null> {
  const value = await kv.get(key, "json");
  if (value === null) return null;
  await kv.delete(key);
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function saveState(kv: KVNamespace, pending: PendingSignIn): Promise<string> {
  const state = randomToken();
  await kv.put(`state:${state}`, JSON.stringify(pending), { expirationTtl: STATE_TTL_SECONDS });
  return state;
}

export function takeState(kv: KVNamespace, state: string): Promise<PendingSignIn | null> {
  return take(kv, `state:${state}`, pendingSignInSchema);
}

export async function saveHandoff(
  kv: KVNamespace,
  tokens: TokenSet,
  codeChallenge: string,
): Promise<string> {
  const code = randomToken();
  const value: Handoff = { tokens, codeChallenge };
  await kv.put(`handoff:${code}`, JSON.stringify(value), { expirationTtl: HANDOFF_TTL_SECONDS });
  return code;
}

export function takeHandoff(kv: KVNamespace, code: string): Promise<Handoff | null> {
  return take(kv, `handoff:${code}`, handoffSchema);
}
