import { UnauthorizedError, WakaTimeError } from "@wakalyst/api";
import { describe, expect, it } from "vitest";
import { createQueryClient } from "./client";

describe("createQueryClient", () => {
  const retry = createQueryClient().getDefaultOptions().queries?.retry;
  if (typeof retry !== "function") throw new Error("expected a retry function");

  it("never retries a missing session", () => {
    expect(retry(0, new UnauthorizedError())).toBe(false);
  });

  it("retries other failures twice", () => {
    const error = new WakaTimeError(502, "bad gateway");
    expect([0, 1, 2].map((n) => retry(n, error))).toEqual([true, true, false]);
  });
});
