import { Text as RNText, type TextProps as RNTextProps, StyleSheet } from "react-native";
import { useTheme } from "./use-theme";

const variants = StyleSheet.create({
  display: { fontSize: 36, lineHeight: 42, fontWeight: "700" },
  title: { fontSize: 24, lineHeight: 30, fontWeight: "700" },
  body: { fontSize: 16, lineHeight: 24 },
  caption: { fontSize: 14, lineHeight: 20 },
});

export type TextProps = RNTextProps & {
  variant?: keyof typeof variants;
  tone?: "default" | "muted" | "danger";
};

export function Text({ variant = "body", tone = "default", style, ...props }: TextProps) {
  const { colors } = useTheme();
  const color =
    tone === "muted" ? colors.muted : tone === "danger" ? colors.danger : colors.foreground;
  return <RNText {...props} style={[variants[variant], { color }, style]} />;
}
