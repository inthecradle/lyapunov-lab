import type { Point } from "./collective";

export const COLLECTIVE_INTRO_DURATION = 4;

const PERSONAL_VALLEY_RADIUS = 0.55;
const PERSONAL_VALLEY_DEPTH = 120;

export type IntroValley = { center: Point; radius: number; depth: number };

/** Move and widen the explanatory wells until they meet at the common valley. */
export function morphValleys(
  initial: Point[],
  target: {
    center: Point;
    radius: number;
    members: readonly number[];
  } | null,
  progress: number,
): IntroValley[] {
  const t = Math.max(0, Math.min(1, progress));
  const blend = t * t * (3 - 2 * t);
  const interpolate = (from: number, to: number) =>
    from * (1 - blend) + to * blend;
  return initial.map((center, index) => {
    if (!target?.members.includes(index)) {
      return {
        center: { ...center },
        radius: PERSONAL_VALLEY_RADIUS,
        depth: PERSONAL_VALLEY_DEPTH * (1 - blend),
      };
    }
    return {
      center: {
        x: interpolate(center.x, target.center.x),
        y: interpolate(center.y, target.center.y),
      },
      radius: interpolate(PERSONAL_VALLEY_RADIUS, target.radius),
      depth: interpolate(PERSONAL_VALLEY_DEPTH, 210),
    };
  });
}

/** Conceptual display surface only; these heights are not model costs or forces. */
export function introTerrainHeight(
  point: Point,
  valleys: IntroValley[],
): number {
  let height = 0;
  for (const { center, radius, depth } of valleys) {
    const distanceSquared =
      (point.x - center.x) ** 2 + (point.y - center.y) ** 2;
    const well = Math.max(0, 1 - distanceSquared / radius ** 2);
    // The lower envelope keeps overlapping wells on one surface without
    // introducing extra depth when multiple subjects have the same position.
    if (well > 0 && depth > 0) height = Math.min(height, -depth * well ** 3);
  }
  return height;
}

export function personalValleyHeight(point: Point, centers: Point[]): number {
  return introTerrainHeight(point, morphValleys(centers, null, 0));
}
