import { colorsFor, opacity, THEME } from "@wakalyst/theme";
import { useMemo } from "react";
import { useColorScheme } from "react-native";

/** Theme tokens plus the palette for the current color scheme. */
export function useTheme() {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  return useMemo(() => {
    const palette = colorsFor(scheme);
    return {
      ...THEME,
      scheme,
      colors: {
        ...palette,
        muted: opacity(palette.foreground, 0.64),
        onPrimary: scheme === "dark" ? "#000000" : "#ffffff",
        danger: THEME.color.danger,
      },
    };
  }, [scheme]);
}

export type Theme = ReturnType<typeof useTheme>;
