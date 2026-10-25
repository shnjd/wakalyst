import type { z } from "zod";
import { UnauthorizedError, WakaTimeError } from "./errors";
import { type CurrentUser, currentUserResponseSchema } from "./schemas";

export const WAKATIME_URL = "https://wakatime.com";
export const WAKATIME_API_URL = `${WAKATIME_URL}/api/v1`;

/**
 * Sends a request for a WakaTime API path (relative to `/api/v1`, e.g.
 * `/users/current`) and returns the raw response. The fetcher decides how
 * the request is authenticated: a bearer token on native, the Worker's
 * cookie proxy on web.
 */
export type Fetcher = (path: string, init?: RequestInit) => Promise<Response>;

export type WakaTimeClient = ReturnType<typeof createWakaTimeClient>;

export function createWakaTimeClient(fetcher: Fetcher) {
  async function get<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    const res = await fetcher(path, { method: "GET", headers: { Accept: "application/json" } });
    if (res.status === 401) throw new UnauthorizedError();
    if (!res.ok) throw new WakaTimeError(res.status, `GET ${path} failed with ${res.status}`);
    return schema.parse(await res.json());
  }

  return {
    async getCurrentUser(): Promise<CurrentUser> {
      return (await get("/users/current", currentUserResponseSchema)).data;
    },
  };
}
