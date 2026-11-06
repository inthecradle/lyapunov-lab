import type { Point } from "./collective";

/** Clip the threshold section in model coordinates, before 3D projection. */
export function clipUnitSquare(polygon: Point[]): Point[] {
  let points = polygon;
  for (const [axis, boundary, greater] of [
    ["x", 0, true],
    ["x", 1, false],
    ["y", 0, true],
    ["y", 1, false],
  ] as const) {
    const input = points;
    points = [];
    if (!input.length) break;
    const inside = (p: Point) =>
      greater ? p[axis] >= boundary : p[axis] <= boundary;
    for (let i = 0; i < input.length; i++) {
      const start = input[i],
        end = input[(i + 1) % input.length];
      const startInside = inside(start),
        endInside = inside(end);
      if (startInside !== endInside) {
        const t = (boundary - start[axis]) / (end[axis] - start[axis]);
        // Clip only this half-plane; the other coordinate is clipped later.
        points.push({
          x: start.x + t * (end.x - start.x),
          y: start.y + t * (end.y - start.y),
          [axis]: boundary,
        });
      }
      if (endInside) points.push(end);
    }
  }
  return points;
}
