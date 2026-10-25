import { UnauthorizedError } from "@wakalyst/api";
import { useCurrentUser } from "@wakalyst/query";
import { Button, Screen, Text } from "@wakalyst/ui";
import { ActivityIndicator } from "react-native";
import { Profile } from "../components/profile";
import { SignIn } from "../components/sign-in";

export default function Home() {
  const user = useCurrentUser();

  if (user.data) return <Profile user={user.data} />;
  if (user.error instanceof UnauthorizedError) return <SignIn />;

  if (user.error) {
    return (
      <Screen>
        <Text variant="title">Couldn't reach WakaTime</Text>
        <Text tone="muted">{user.error.message}</Text>
        <Button title="Try again" onPress={() => user.refetch()} loading={user.isFetching} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ActivityIndicator />
    </Screen>
  );
}
