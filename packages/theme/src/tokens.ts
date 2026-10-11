import palette from "./palette.json";

export const THEME = {
  spacing: {
    xs: 2,
    sm: 2.5,
    md: 3,
    lg: 3.5,
    xl: 4,
  },
  radius: {
    "2xs": 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    "2xl": 28,
  },
  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    "2xl": 24,
    "3xl": 30,
    "4xl": 36,
    "5xl": 48,
    "6xl": 60,
    "7xl": 72,
    "8xl": 96,
    "9xl": 128,
  },
  iconSize: {
    "3xs": 12,
    "2xs": 16,
    xs: 20,
    sm: 24,
    md: 28,
    lg: 32,
    xl: 36,
    "2xl": 40,
    "3xl": 44,
  },
  breakPoints: {
    mobile: 768,
    tab: 1200,
    desktop: 2000,
  },
  color: palette.color,
} as const;

export type ColorScheme = "light" | "dark";
export type SchemeColors = (typeof THEME.color)[ColorScheme];
export type ColorName = keyof SchemeColors;

/** The palette for one scheme; anything but "dark" falls back to light. */
export function colorsFor(scheme: ColorScheme | null | undefined) {
  return THEME.color[scheme === "dark" ? "dark" : "light"];
}

export type TSpacing = keyof typeof THEME.spacing;
export type IconSize = keyof typeof THEME.iconSize;
