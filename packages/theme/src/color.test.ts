import { describe, expect, it } from "vitest";
import { darken, findDarkestInRange, hexToLuminance, lighten, opacity } from "./color";

describe("opacity", () => {
  it("converts every supported format to rgba", () => {
    expect(opacity("#ff8000", 0.5)).toBe("rgba(255, 128, 0, 0.5)");
    expect(opacity("#ff8000cc", 0.2)).toBe("rgba(255, 128, 0, 0.2)");
    expect(opacity("rgb(1, 2, 3)", 1)).toBe("rgba(1, 2, 3, 1)");
    expect(opacity("rgba(1, 2, 3, 0.4)", 0)).toBe("rgba(1, 2, 3, 0)");
  });

  it("rejects bad input", () => {
    expect(() => opacity("#fff", 0.5)).toThrow(/Invalid color/);
    expect(() => opacity("#ffffff", 2)).toThrow(/between 0 and 1/);
  });
});

describe("lighten and darken", () => {
  it("move channels towards white and black", () => {
    expect(lighten("#000000", 0.5)).toBe("rgb(128, 128, 128)");
    expect(lighten("#123456", 1)).toBe("rgb(255, 255, 255)");
    expect(darken("#ffffff", 0.5)).toBe("rgb(128, 128, 128)");
    expect(darken("#123456", 1)).toBe("rgb(0, 0, 0)");
  });

  it("keep alpha", () => {
    expect(lighten("rgba(0, 0, 0, 0.3)", 0)).toBe("rgba(0, 0, 0, 0.3)");
    expect(darken("rgba(200, 100, 0, 0.5)", 0.5)).toBe("rgba(100, 50, 0, 0.5)");
  });
});

describe("hexToLuminance", () => {
  it("is 0 for black and 1 for white", () => {
    expect(hexToLuminance("#000000")).toBe(0);
    expect(hexToLuminance("#ffffff")).toBeCloseTo(1);
  });
});

describe("findDarkestInRange", () => {
  it("picks the darkest color inside the range", () => {
    expect(findDarkestInRange(["#cccccc", "#888888", "#444444"], "#333333", "#eeeeee")).toBe(
      "#444444",
    );
  });

  it("falls back to the color nearest the middle", () => {
    expect(findDarkestInRange(["#000000", "#ffffff", "#7f7f7f"], "#aaaaaa", "#bbbbbb")).toBe(
      "#7f7f7f",
    );
  });

  it("returns undefined for no colors", () => {
    expect(findDarkestInRange([])).toBeUndefined();
  });
});
