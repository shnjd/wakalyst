import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@wakalyst/query";
import { Button, Screen, Text } from "@wakalyst/ui";
import { StyleSheet } from "react-native";
import { signIn } from "../lib/session";

export function SignIn() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: signIn,
    onSuccess: (signedIn) => {
      if (signedIn) return queryClient.invalidateQueries({ queryKey: queryKeys.currentUser });
    },
  });

  return (
    <Screen>
      <Text variant="display">Wakalyst</Text>
      <Text variant="title" style={styles.center}>
        Track your coding time, the minimalist way
      </Text>
      <Text tone="muted" style={styles.center}>
        A simple, unofficial client for WakaTime, focused on clarity, minimal UI and instant
        insights.
      </Text>
      <Button
        title="Sign in with WakaTime"
        onPress={() => mutation.mutate()}
        loading={mutation.isPending}
        style={styles.button}
      />
      {mutation.error ? (
        <Text tone="danger" variant="caption" style={styles.center}>
          {mutation.error.message}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: "center" },
  button: { alignSelf: "stretch" },
});
