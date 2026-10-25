import { THEME } from "./tokens";

type Rgba = { r: number; g: number; b: number; a?: number };

const hexRegex = /^#([a-fA-F0-9]{6})$/;
const hexaRegex = /^#([a-fA-F0-9]{8})$/;
const rgbRegex = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/;
const rgbaRegex = /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(0|1|0?\.\d+)\s*\)$/;

function parseHex(hex: string): Rgba {
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
    a: hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : undefined,
  };
}

function parseColor(color: string): Rgba {
  const hex = hexRegex.exec(color) ?? hexaRegex.exec(color);
  if (hex?.[1]) return parseHex(hex[1]);

  const rgb = rgbRegex.exec(color) ?? rgbaRegex.exec(color);
  if (rgb) {
    const [, r, g, b, a] = rgb;
    return { r: Number(r), g: Number(g), b: Number(b), a: a === undefined ? undefined : Number(a) };
  }

  throw new Error("Invalid color format. Supported formats: hex, hexa, rgb, rgba.");
}

function format({ r, g, b, a }: Rgba): string {
  return a === undefined ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`;
}

function assertUnit(name: string, value: number) {
  if (value < 0 || value > 1) throw new Error(`${name} must be between 0 and 1.`);
}

/**
 * Convert a color to RGBA format with a modified opacity.
 * @param color - The input color in hex, hexa, rgb, or rgba.
 * @param opacity - A value between 0 and 1.
 * @returns The color with the modified opacity.
 */
export function opacity(color: string, opacity: number): string {
  assertUnit("Opacity", opacity);
  return format({ ...parseColor(color), a: opacity });
}

/**
 * Lighten a color by moving each channel towards white.
 * @param color - The input color in hex, hexa, rgb, or rgba.
 * @param factor - A value between 0 and 1 (where 1 is white).
 * @returns The lightened color; alpha is kept.
 */
export function lighten(color: string, factor: number): string {
  assertUnit("Factor", factor);
  const c = parseColor(color);
  const channel = (v: number) => Math.min(255, Math.round(v + (255 - v) * factor));
  return format({ r: channel(c.r), g: channel(c.g), b: channel(c.b), a: c.a });
}

/**
 * Darken a color by moving each channel towards black.
 * @param color - The input color in hex, hexa, rgb, or rgba.
 * @param factor - A value between 0 and 1 (where 1 is black).
 * @returns The darkened color; alpha is kept.
 */
export function darken(color: string, factor: number): string {
  assertUnit("Factor", factor);
  const c = parseColor(color);
  const channel = (v: number) => Math.max(0, Math.round(v * (1 - factor)));
  return format({ r: channel(c.r), g: channel(c.g), b: channel(c.b), a: c.a });
}

/** Relative luminance (Rec. 709 weights, no gamma correction) of a hex color, 0 to 1. */
export function hexToLuminance(hex: string): number {
  const { r, g, b } = parseColor(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/**
 * Pick the darkest color whose luminance lies between `minColor` and `maxColor`
 * (defaults: the light scheme's foreground and background). When none fits,
 * returns the color closest to the middle of that range.
 */
export function findDarkestInRange(
  hexColors: string[],
  minColor: string = THEME.color.light.foreground,
  maxColor: string = THEME.color.light.background,
): string | undefined {
  if (hexColors.length === 0) return undefined;

  const minLum = hexToLuminance(minColor);
  const maxLum = hexToLuminance(maxColor);
  const inRange = hexColors.filter((color) => {
    const lum = hexToLuminance(color);
    return lum >= minLum && lum <= maxLum;
  });

  if (inRange.length > 0) {
    return inRange.reduce((darkest, color) =>
      hexToLuminance(color) < hexToLuminance(darkest) ? color : darkest,
    );
  }

  const target = (minLum + maxLum) / 2;
  return hexColors.reduce((closest, color) =>
    Math.abs(hexToLuminance(color) - target) < Math.abs(hexToLuminance(closest) - target)
      ? color
      : closest,
  );
}
