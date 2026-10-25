import { describe, expect, it, vi } from "vitest";
import { createWakaTimeClient } from "./client";
import { UnauthorizedError, WakaTimeError } from "./errors";
import { parseOAuthTokenResponse } from "./schemas";

const user = {
  id: "u1",
  username: "ada",
  display_name: "Ada Lovelace",
  full_name: "Ada Lovelace",
  photo: "https://wakatime.com/photo/u1",
  extra_field: true,
};

describe("createWakaTimeClient", () => {
  it("fetches and parses the current user", async () => {
    const fetcher = vi.fn(async () => Response.json({ data: user }));
    const client = createWakaTimeClient(fetcher);

    await expect(client.getCurrentUser()).resolves.toMatchObject({
      id: "u1",
      display_name: "Ada Lovelace",
    });
    expect(fetcher).toHaveBeenCalledWith("/users/current", expect.anything());
  });

  it("maps 401 to UnauthorizedError and other failures to WakaTimeError", async () => {
    const unauthorized = createWakaTimeClient(async () => new Response(null, { status: 401 }));
    await expect(unauthorized.getCurrentUser()).rejects.toBeInstanceOf(UnauthorizedError);

    const failing = createWakaTimeClient(async () => new Response(null, { status: 502 }));
    await expect(failing.getCurrentUser()).rejects.toMatchObject({ status: 502 });
    await expect(failing.getCurrentUser()).rejects.toBeInstanceOf(WakaTimeError);
  });

  it("rejects a malformed body", async () => {
    const client = createWakaTimeClient(async () => Response.json({ data: { id: 1 } }));
    await expect(client.getCurrentUser()).rejects.toThrow();
  });
});

describe("parseOAuthTokenResponse", () => {
  it("parses JSON", () => {
    const body = JSON.stringify({ access_token: "a", refresh_token: "r", expires_in: 3600 });
    expect(parseOAuthTokenResponse(body, "application/json")).toMatchObject({
      access_token: "a",
      expires_in: 3600,
    });
  });

  it("parses form-encoded and coerces numbers", () => {
    const body = "access_token=a&refresh_token=r&expires_in=60&scope=read_stats";
    expect(parseOAuthTokenResponse(body, "application/x-www-form-urlencoded")).toMatchObject({
      access_token: "a",
      refresh_token: "r",
      expires_in: 60,
    });
  });

  it("rejects a response without tokens", () => {
    expect(() => parseOAuthTokenResponse("error=invalid_grant", null)).toThrow();
  });
});
