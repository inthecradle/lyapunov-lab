import type { Point } from "./collective";
import { introTerrainHeight, type IntroValley } from "./collectiveIntro";
import type { sharedTerrainProjection } from "./sharedTerrainProjection";

type Projection = ReturnType<typeof sharedTerrainProjection>;
type Intro = { progress: number; valleys: IntroValley[] };

const STEPS = 40;
const polygon = (points: Point[]) =>
  points
    .map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ") + " Z";

/** One display-only mesh for both collective views; never used by the dynamics. */
export function collectiveTerrainMesh({
  center,
  radius,
  view,
  valueAt,
  flat,
  intro,
}: {
  center: Point;
  radius: number;
  view: Projection;
  valueAt: (point: Point) => number;
  flat: boolean;
  intro?: Intro;
}) {
  const blend = intro
    ? intro.progress * intro.progress * (3 - 2 * intro.progress)
    : 1;
  // Adjacent patches share vertices. Evaluate and project each vertex once.
  const vertices = Array.from({ length: (STEPS + 1) ** 2 }, (_, index) => {
    const column = index % (STEPS + 1);
    const row = Math.floor(index / (STEPS + 1));
    const q = {
      x: center.x + radius * ((2 * column) / STEPS - 1),
      y: center.y + radius * ((2 * row) / STEPS - 1),
    };
    const value = valueAt(q);
    const height = intro
      ? introTerrainHeight(q, intro.valleys)
      : view.displayHeight(value);
    return { ...view.atDisplayHeight(q, height), q, value, height };
  });
  const patches = [];
  for (let row = 0; row < STEPS; row++) {
    for (let column = 0; column < STEPS; column++) {
      const index = row * (STEPS + 1) + column;
      const points = [
        vertices[index],
        vertices[index + 1],
        vertices[index + STEPS + 2],
        vertices[index + STEPS + 1],
      ];
      const value = points.reduce((sum, p) => sum + p.value, 0) / 4;
      const height = points.reduce((sum, p) => sum + p.height, 0) / 4;
      const well = intro
        ? Math.cbrt(Math.max(0, -height / 210))
        : flat
          ? 0
          : Math.max(0, 1 - value / (0.85 * view.maxV));
      let hue = 211 - 42 * well;
      let floorStrength = 0;
      if (intro && intro.valleys.length > 0) {
        const midpoint = {
          x: points.reduce((sum, p) => sum + p.q.x, 0) / 4,
          y: points.reduce((sum, p) => sum + p.q.y, 0) / 4,
        };
        const distances = intro.valleys.map((valley) =>
          Math.hypot(
            valley.center.x - midpoint.x,
            valley.center.y - midpoint.y,
          ),
        );
        const nearest = distances.indexOf(Math.min(...distances));
        const valley = intro.valleys[nearest];
        hue =
          211 +
          well * ((1 - blend) * ([169, 229, 33][nearest] - 211) - 42 * blend);
        if (distances[nearest] < (0.13 * valley.radius) / 0.55)
          floorStrength = (1 - blend) * Math.min(1, valley.depth / 120);
      }
      const saturation = 28 + 15 * well;
      const lightness = 12 + 14 * well;
      patches.push({
        key: `${row}-${column}`,
        d: polygon(points),
        depth: points.reduce((sum, p) => sum + p.depth, 0) / 4,
        fill: `hsl(${hue + floorStrength * (150 - hue)} ${saturation + floorStrength * (35 - saturation)}% ${lightness + floorStrength * (27 - lightness)}%)`,
      });
    }
  }
  return patches.sort((a, b) => a.depth - b.depth);
}
