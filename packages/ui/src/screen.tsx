import type { ReactNode } from "react";
import { StyleSheet, View, type ViewProps } from "react-native";
import { useTheme } from "./use-theme";

/** A full-screen background with a centered, width-capped column. */
export function Screen({ children, style, ...props }: ViewProps & { children: ReactNode }) {
  const { colors, spacing } = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View {...props} style={[styles.column, { padding: spacing.xl, gap: spacing.lg }, style]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  column: {
    width: "100%",
    maxWidth: 480,
    alignItems: "center",
  },
});
