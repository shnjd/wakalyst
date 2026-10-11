import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient, WakaTimeProvider } from "@wakalyst/query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { wakatime } from "../lib/session";

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <WakaTimeProvider client={wakatime}>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }} />
      </WakaTimeProvider>
    </QueryClientProvider>
  );
}
