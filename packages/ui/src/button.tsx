import { ActivityIndicator, Pressable, type PressableProps, StyleSheet, Text } from "react-native";
import { useTheme } from "./use-theme";

export type ButtonProps = Omit<PressableProps, "children"> & {
  title: string;
  variant?: "primary" | "secondary";
  loading?: boolean;
};

export function Button({
  title,
  variant = "primary",
  loading = false,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const { colors, radius, spacing } = useTheme();
  const primary = variant === "primary";
  const foreground = primary ? colors.onPrimary : colors.foreground;
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: loading }}
      disabled={inactive}
      style={(state) => [
        styles.base,
        {
          backgroundColor: primary ? colors.primary : colors.surface,
          borderRadius: radius.sm,
          paddingHorizontal: spacing.xl,
          opacity: inactive ? 0.6 : state.pressed ? 0.8 : 1,
        },
        typeof style === "function" ? style(state) : style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <Text style={[styles.label, { color: foreground }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
  },
});
