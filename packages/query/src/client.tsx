import { QueryClient } from "@tanstack/react-query";
import { UnauthorizedError, type WakaTimeClient } from "@wakalyst/api";
import { createContext, type ReactNode, useContext } from "react";

const MAX_RETRIES = 2;

/** Retries transient failures, never a missing session. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        retry: (failureCount, error) =>
          !(error instanceof UnauthorizedError) && failureCount < MAX_RETRIES,
      },
    },
  });
}

const WakaTimeContext = createContext<WakaTimeClient | null>(null);

export function WakaTimeProvider({
  client,
  children,
}: {
  client: WakaTimeClient;
  children: ReactNode;
}) {
  return <WakaTimeContext value={client}>{children}</WakaTimeContext>;
}

export function useWakaTime(): WakaTimeClient {
  const client = useContext(WakaTimeContext);
  if (!client) throw new Error("useWakaTime must be used inside <WakaTimeProvider>");
  return client;
}
