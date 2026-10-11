import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CurrentUser } from "@wakalyst/api";
import { Avatar, Button, Screen, Text } from "@wakalyst/ui";
import { StyleSheet } from "react-native";
import { signOut } from "../lib/session";

export function Profile({ user }: { user: CurrentUser }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: signOut,
    // Drop every cached response; the current-user query then fails as signed out.
    onSettled: () => queryClient.resetQueries(),
  });

  return (
    <Screen>
      <Avatar uri={user.photo} name={user.display_name} />
      <Text variant="title">{user.display_name}</Text>
      {user.username ? <Text tone="muted">@{user.username}</Text> : null}
      <Button
        title="Sign out"
        variant="secondary"
        onPress={() => mutation.mutate()}
        loading={mutation.isPending}
        style={styles.button}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  button: { alignSelf: "stretch" },
});
