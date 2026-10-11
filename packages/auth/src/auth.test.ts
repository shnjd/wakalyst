import { UnauthorizedError } from "@wakalyst/api";
import { describe, expect, it, vi } from "vitest";
import { createAuthClient } from "./client";
import { createNativeFetcher, createWebFetcher } from "./fetchers";
import { createMemoryStorage, type TokenSet, toTokenSet } from "./session";

const AUTH = "https://auth.example.dev";
const NOW = 1_000_000_000_000;
const fresh: TokenSet = { accessToken: "a1", refreshToken: "r1", expiresAt: NOW + 3_600_000 };
const renewed: TokenSet = { accessToken: "a2", refreshToken: "r2", expiresAt: NOW + 7_200_000 };

type Route = (req: Request) => Response | Promise<Response>;

/** A fetch stub that routes by "METHOD url-without-query" and records every request. */
function stubFetch(routes: Record<string, Route>) {
  const calls: Request[] = [];
  const impl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    calls.push(req);
    const url = new URL(req.url);
    const route = routes[`${req.method} ${url.origin}${url.pathname}`];
    if (!route) throw new Error(`unexpected ${req.method} ${req.url}`);
    return route(req);
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

const USER_URL = "https://wakatime.com/api/v1/users/current";

describe("toTokenSet", () => {
  it("prefers expires_at, then expires_in", () => {
    expect(
      toTokenSet({ access_token: "a", refresh_token: "r", expires_at: "2030-01-01T00:00:00Z" }),
    ).toMatchObject({ expiresAt: Date.parse("2030-01-01T00:00:00Z") });
    expect(toTokenSet({ access_token: "a", refresh_token: "r", expires_in: 10 }, NOW)).toEqual({
      accessToken: "a",
      refreshToken: "r",
      expiresAt: NOW + 10_000,
    });
  });
});

describe("createAuthClient", () => {
  it("builds authorize URLs per platform", () => {
    const auth = createAuthClient(`${AUTH}/`);
    const native = new URL(
      auth.authorizeUrl({
        platform: "native",
        redirectUri: "wakalyst://auth",
        codeChallenge: "abc",
      }),
    );
    expect(native.origin + native.pathname).toBe(`${AUTH}/authorize`);
    expect(Object.fromEntries(native.searchParams)).toEqual({
      platform: "native",
      redirect_uri: "wakalyst://auth",
      code_challenge: "abc",
    });

    const web = new URL(auth.authorizeUrl({ platform: "web", redirectUri: "http://localhost/" }));
    expect(web.searchParams.has("code_challenge")).toBe(false);
  });

  it("exchanges a code and maps a 400 to UnauthorizedError", async () => {
    const ok = stubFetch({ [`POST ${AUTH}/token`]: () => Response.json(fresh) });
    await expect(createAuthClient(AUTH, ok.impl).exchange("c", "v")).resolves.toEqual(fresh);
    await expect(ok.calls[0]?.json()).resolves.toEqual({ code: "c", code_verifier: "v" });

    const bad = stubFetch({ [`POST ${AUTH}/token`]: () => new Response(null, { status: 400 }) });
    await expect(createAuthClient(AUTH, bad.impl).exchange("c", "v")).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });
});

describe("createNativeFetcher", () => {
  it("sends the bearer token", async () => {
    const { impl, calls } = stubFetch({ [`GET ${USER_URL}`]: () => Response.json({}) });
    const fetcher = createNativeFetcher({
      auth: createAuthClient(AUTH, impl),
      storage: createMemoryStorage(fresh),
      fetchImpl: impl,
      now: () => NOW,
    });

    await fetcher("/users/current");
    expect(calls[0]?.headers.get("Authorization")).toBe("Bearer a1");
  });

  it("throws UnauthorizedError without a session", async () => {
    const { impl } = stubFetch({});
    const fetcher = createNativeFetcher({
      auth: createAuthClient(AUTH, impl),
      storage: createMemoryStorage(),
      fetchImpl: impl,
    });
    await expect(fetcher("/users/current")).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("refreshes an expired token once, even for concurrent calls", async () => {
    const { impl, calls } = stubFetch({
      [`POST ${AUTH}/refresh`]: () => Response.json(renewed),
      [`GET ${USER_URL}`]: () => Response.json({}),
    });
    const storage = createMemoryStorage({ ...fresh, expiresAt: NOW });
    const fetcher = createNativeFetcher({
      auth: createAuthClient(AUTH, impl),
      storage,
      fetchImpl: impl,
      now: () => NOW,
    });

    await Promise.all([fetcher("/users/current"), fetcher("/users/current")]);
    expect(calls.filter((c) => c.url.endsWith("/refresh"))).toHaveLength(1);
    expect(calls.at(-1)?.headers.get("Authorization")).toBe("Bearer a2");
    await expect(storage.get()).resolves.toEqual(renewed);
  });

  it("refreshes and retries on a 401", async () => {
    const { impl, calls } = stubFetch({
      [`POST ${AUTH}/refresh`]: () => Response.json(renewed),
      [`GET ${USER_URL}`]: (req) =>
        req.headers.get("Authorization") === "Bearer a2"
          ? Response.json({})
          : new Response(null, { status: 401 }),
    });
    const fetcher = createNativeFetcher({
      auth: createAuthClient(AUTH, impl),
      storage: createMemoryStorage(fresh),
      fetchImpl: impl,
      now: () => NOW,
    });

    const res = await fetcher("/users/current");
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(3);
  });

  it("clears the session when the refresh token is rejected", async () => {
    const { impl } = stubFetch({
      [`POST ${AUTH}/refresh`]: () => new Response(null, { status: 401 }),
    });
    const storage = createMemoryStorage({ ...fresh, expiresAt: NOW });
    const fetcher = createNativeFetcher({
      auth: createAuthClient(AUTH, impl),
      storage,
      fetchImpl: impl,
      now: () => NOW,
    });

    await expect(fetcher("/users/current")).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(storage.get()).resolves.toBeNull();
  });
});

describe("createWebFetcher", () => {
  it("goes through the Worker proxy and refreshes the cookie on a 401", async () => {
    let refreshed = false;
    const { impl, calls } = stubFetch({
      [`POST ${AUTH}/refresh`]: () => {
        refreshed = true;
        return new Response(null, { status: 204 });
      },
      [`GET ${AUTH}/api/v1/users/current`]: () =>
        refreshed ? Response.json({}) : new Response(null, { status: 401 }),
    });
    const fetcher = createWebFetcher({ auth: createAuthClient(AUTH, impl), fetchImpl: impl });

    const res = await fetcher("/users/current", { method: "GET" });
    expect(res.status).toBe(200);
    expect(calls.map((c) => `${c.method} ${new URL(c.url).pathname}`)).toEqual([
      "GET /api/v1/users/current",
      "POST /refresh",
      "GET /api/v1/users/current",
    ]);
    expect(calls.every((c) => c.credentials === "include")).toBe(true);
  });
});
