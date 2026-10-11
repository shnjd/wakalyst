import { queryOptions, useQuery } from "@tanstack/react-query";
import type { WakaTimeClient } from "@wakalyst/api";
import { useWakaTime } from "./client";

export const queryKeys = {
  currentUser: ["users", "current"] as const,
};

export const currentUserQuery = (client: WakaTimeClient) =>
  queryOptions({
    queryKey: queryKeys.currentUser,
    queryFn: () => client.getCurrentUser(),
  });

/** The signed-in user. Fails with `UnauthorizedError` when there is no session. */
export function useCurrentUser() {
  return useQuery(currentUserQuery(useWakaTime()));
}
