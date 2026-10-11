import { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { useTheme } from "./use-theme";

export type AvatarProps = {
  uri?: string | null;
  /** Used for the initials fallback and the accessibility label. */
  name: string;
  size?: number;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function Avatar({ uri, name, size = 96 }: AvatarProps) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const shape = { width: size, height: size, borderRadius: size / 2 };

  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        accessibilityLabel={name}
        onError={() => setFailed(true)}
        style={[shape, { backgroundColor: colors.surface }]}
      />
    );
  }

  return (
    <View
      accessibilityLabel={name}
      style={[styles.fallback, shape, { backgroundColor: colors.surface }]}
    >
      <Text style={{ color: colors.foreground, fontSize: size * 0.4, fontWeight: "600" }}>
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: "center",
    justifyContent: "center",
  },
});
