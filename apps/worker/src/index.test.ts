import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { codeChallenge } from "./crypto";
import { app } from "./index";

/** Enough of KVNamespace for the Worker: string values, TTLs ignored. */
function memoryKV() {
  const data = new Map<string, string>();
  const kv = {
    data,
    async get(key: string, type?: "json") {
      const value = data.get(key) ?? null;
      return value !== null && type === "json" ? JSON.parse(value) : value;
    },
    async put(key: string, value: string) {
      data.set(key, value);
    },
    async delete(key: string) {
      data.delete(key);
    },
  };
  return kv;
}

const ORIGIN = "https://auth.test";
const WEB = "http://localhost:8081";
const VERIFIER = "v".repeat(64);

let kv: ReturnType<typeof memoryKV>;
let env: Env;
let wakatime: ReturnType<typeof vi.fn>;
let wakatimeRequests: Request[];

beforeEach(() => {
  kv = memoryKV();
  env = {
    AUTH_STATES: kv as unknown as KVNamespace,
    WAKATIME_CLIENT_ID: "client-id",
    WAKATIME_CLIENT_SECRET: "client-secret",
    WAKATIME_SCOPES: "read_stats",
    ALLOWED_REDIRECTS: `wakalyst://auth,${WEB}/`,
  };
  wakatimeRequests = [];
  wakatime = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    wakatimeRequests.push(req);
    const { pathname } = new URL(req.url);
    if (pathname === "/oauth/token") {
      const form = new URLSearchParams(await req.clone().text());
      if (form.get("code") === "bad" || form.get("refresh_token") === "bad") {
        return new Response("invalid_grant", { status: 400 });
      }
      const expiresIn = form.get("code") === "long-lived" ? 2 * 365 * 24 * 60 * 60 : 3600;
      return Response.json({ access_token: "at", refresh_token: "rt", expires_in: expiresIn });
    }
    if (pathname === "/oauth/revoke") return new Response(null, { status: 200 });
    if (pathname === "/api/v1/users/current") return Response.json({ data: { id: "u1" } });
    return new Response("not found", { status: 404 });
  });
  vi.stubGlobal("fetch", wakatime);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const request = (path: string, init?: RequestInit) => app.request(`${ORIGIN}${path}`, init, env);

const post = (path: string, body?: unknown, headers: Record<string, string> = {}) =>
  request(path, {
    method: "POST",
    headers: body === undefined ? headers : { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

async function startSignIn(platform: "native" | "web") {
  const query = new URLSearchParams(
    platform === "native"
      ? {
          platform,
          redirect_uri: "wakalyst://auth",
          code_challenge: await codeChallenge(VERIFIER),
        }
      : { platform, redirect_uri: `${WEB}/` },
  );
  const res = await request(`/authorize?${query}`);
  expect(res.status).toBe(302);
  const location = new URL(res.headers.get("Location") ?? "");
  return { location, state: location.searchParams.get("state") ?? "" };
}

const callback = (state: string, code = "good") =>
  request(`/callback?${new URLSearchParams({ state, code })}`);

describe("/authorize", () => {
  it("redirects to WakaTime with a stored state and the Worker's own callback", async () => {
    const { location, state } = await startSignIn("native");
    expect(location.origin + location.pathname).toBe("https://wakatime.com/oauth/authorize");
    expect(location.searchParams.get("redirect_uri")).toBe(`${ORIGIN}/callback`);
    expect(location.searchParams.get("client_id")).toBe("client-id");
    expect(location.searchParams.get("scope")).toBe("read_stats");
    expect(state.length).toBeGreaterThanOrEqual(43);
    expect(kv.data.has(`state:${state}`)).toBe(true);
  });

  it("rejects redirect URIs outside the allowlist", async () => {
    for (const uri of [
      "https://evil.dev/",
      "http://localhost:8081.evil.dev/",
      "wakalyst://authx",
    ]) {
      const res = await request(`/authorize?platform=web&redirect_uri=${encodeURIComponent(uri)}`);
      expect(res.status, uri).toBe(400);
    }
  });

  it("requires a PKCE challenge on native", async () => {
    const res = await request("/authorize?platform=native&redirect_uri=wakalyst://auth");
    expect(res.status).toBe(400);
  });
});

describe("native sign-in", () => {
  it("hands off tokens through a one-time code bound to the PKCE verifier", async () => {
    const { state } = await startSignIn("native");
    const res = await callback(state);
    expect(res.status).toBe(302);
    const back = new URL(res.headers.get("Location") ?? "");
    expect(back.protocol).toBe("wakalyst:");
    const code = back.searchParams.get("code") ?? "";

    // The code exchange with WakaTime sends the real callback URL.
    const form = new URLSearchParams(await wakatimeRequests[0]?.text());
    expect(form.get("redirect_uri")).toBe(`${ORIGIN}/callback`);
    expect(form.get("client_secret")).toBe("client-secret");

    const wrong = await post("/token", { code, code_verifier: "w".repeat(64) });
    expect(wrong.status).toBe(400);
    // A failed attempt burns the code.
    expect((await post("/token", { code, code_verifier: VERIFIER })).status).toBe(400);

    const { state: state2 } = await startSignIn("native");
    const code2 = new URL((await callback(state2)).headers.get("Location") ?? "").searchParams.get(
      "code",
    );
    const ok = await post("/token", { code: code2, code_verifier: VERIFIER });
    expect(ok.status).toBe(200);
    await expect(ok.json()).resolves.toMatchObject({ accessToken: "at", refreshToken: "rt" });

    const replay = await post("/token", { code: code2, code_verifier: VERIFIER });
    expect(replay.status).toBe(400);
  });

  it("rejects an unknown or reused state", async () => {
    expect((await callback("nope")).status).toBe(400);
    const { state } = await startSignIn("native");
    await callback(state);
    expect((await callback(state)).status).toBe(400);
  });

  it("returns errors to the app instead of tokens", async () => {
    const { state } = await startSignIn("native");
    const denied = await request(`/callback?state=${state}&error=access_denied`);
    expect(denied.headers.get("Location")).toBe("wakalyst://auth?error=access_denied");

    const { state: state2 } = await startSignIn("native");
    const bad = await callback(state2, "bad");
    expect(bad.headers.get("Location")).toBe("wakalyst://auth?error=invalid_grant");
  });

  it("refreshes and revokes with tokens in the body", async () => {
    const refreshed = await post("/refresh", { refresh_token: "rt" });
    expect(refreshed.status).toBe(200);
    await expect(refreshed.json()).resolves.toMatchObject({ accessToken: "at" });

    expect((await post("/refresh", { refresh_token: "bad" })).status).toBe(401);

    const revoked = await post("/revoke", { token: "at" });
    expect(revoked.status).toBe(204);
    const revokeCall = wakatimeRequests.at(-1);
    expect(new URL(revokeCall?.url ?? "").pathname).toBe("/oauth/revoke");
    expect(new URLSearchParams(await revokeCall?.text()).get("token")).toBe("at");
  });
});

describe("web sign-in", () => {
  const cookieHeader = (res: Response) =>
    res.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");

  it("sets httpOnly __Host- cookies and returns to the web app", async () => {
    const { state } = await startSignIn("web");
    const res = await callback(state);
    expect(res.headers.get("Location")).toBe(`${WEB}/`);
    const cookies = res.headers.getSetCookie();
    expect(cookies).toHaveLength(2);
    for (const cookie of cookies) {
      expect(cookie).toMatch(/^__Host-wk_(at|rt)=/);
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("Secure");
      expect(cookie).toContain("SameSite=None");
    }
  });

  it("caps cookie lifetimes at 400 days for long-lived tokens", async () => {
    const { state } = await startSignIn("web");
    const res = await callback(state, "long-lived");
    expect(res.status).toBe(302);
    for (const cookie of res.headers.getSetCookie()) {
      expect(cookie).toContain(`Max-Age=${400 * 24 * 60 * 60}`);
    }
  });

  it("proxies GETs to WakaTime with the cookie's token", async () => {
    expect((await request("/api/v1/users/current")).status).toBe(401);

    const { state } = await startSignIn("web");
    const cookie = cookieHeader(await callback(state));
    const res = await request("/api/v1/users/current?x=1", { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
    const upstream = wakatimeRequests.at(-1);
    expect(upstream?.url).toBe("https://wakatime.com/api/v1/users/current?x=1");
    expect(upstream?.headers.get("Authorization")).toBe("Bearer at");
  });

  it("only refreshes or revokes by cookie from an allowed origin", async () => {
    const { state } = await startSignIn("web");
    const cookie = cookieHeader(await callback(state));

    expect((await post("/refresh", undefined, { Cookie: cookie })).status).toBe(403);
    expect(
      (await post("/refresh", undefined, { Cookie: cookie, Origin: "https://evil.dev" })).status,
    ).toBe(403);

    const refreshed = await post("/refresh", undefined, { Cookie: cookie, Origin: WEB });
    expect(refreshed.status).toBe(204);
    expect(refreshed.headers.getSetCookie()).toHaveLength(2);

    const revoked = await post("/revoke", undefined, { Cookie: cookie, Origin: WEB });
    expect(revoked.status).toBe(204);
    for (const c of revoked.headers.getSetCookie()) expect(c).toContain("Max-Age=0");
    expect(new URL(wakatimeRequests.at(-1)?.url ?? "").pathname).toBe("/oauth/revoke");
  });

  it("answers CORS only for allowed origins", async () => {
    const allowed = await request("/api/v1/users/current", { headers: { Origin: WEB } });
    expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe(WEB);
    expect(allowed.headers.get("Access-Control-Allow-Credentials")).toBe("true");

    const other = await request("/api/v1/users/current", {
      headers: { Origin: "https://evil.dev" },
    });
    expect(other.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
