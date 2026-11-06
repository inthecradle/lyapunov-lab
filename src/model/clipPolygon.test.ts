import { expect, it } from "vitest";
import { clipUnitSquare } from "./clipPolygon";

it("clips circles at corners without adding points outside the threshold disk", () => {
  for (const center of [
    { x: 0.8, y: 0.8 },
    { x: 0.1, y: 0.5 },
  ]) {
    for (const radius of [0.1, 0.3, 0.8, 2]) {
      const circle = Array.from({ length: 128 }, (_, i) => ({
        x: center.x + radius * Math.cos((2 * Math.PI * i) / 128),
        y: center.y + radius * Math.sin((2 * Math.PI * i) / 128),
      }));
      const clipped = clipUnitSquare(circle);
      expect(clipped.length).toBeGreaterThan(2);
      for (const point of clipped) {
        expect(point.x).toBeGreaterThanOrEqual(-1e-12);
        expect(point.y).toBeGreaterThanOrEqual(-1e-12);
        expect(point.x).toBeLessThanOrEqual(1 + 1e-12);
        expect(point.y).toBeLessThanOrEqual(1 + 1e-12);
        expect(
          Math.hypot(point.x - center.x, point.y - center.y),
        ).toBeLessThanOrEqual(radius + 1e-12);
      }
      if (radius === 2) expect(clipped).toHaveLength(4);
    }
  }
});

it("preserves the intersection of an oblique polygon with the square", () => {
  const clipped = clipUnitSquare([
    { x: -1, y: 0.5 },
    { x: 0.5, y: 2 },
    { x: 2, y: 0.5 },
  ]);
  // The triangle occupies the upper half of the square; no corner below y=.5 belongs.
  expect(clipped).toHaveLength(4);
  expect(Math.min(...clipped.map((p) => p.y))).toBe(0.5);
  expect(Math.max(...clipped.map((p) => p.y))).toBe(1);
  expect(
    clipUnitSquare([
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 3, y: 3 },
    ]),
  ).toEqual([]);
});
