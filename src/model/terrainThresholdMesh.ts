import type { Point } from "./collective";
import { clipUnitSquare } from "./clipPolygon";
import type { terrainThreshold } from "./terrainThreshold";

const path = (points: Point[], close = false) =>
  points
    .map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ") + (close ? " Z" : "");

const UNIT_CORNERS: Point[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

/** Subdivide long straight clipped edges so their 3D paths follow the surface. */
function subdivideBoundary(polygon: Point[]): Point[] {
  return polygon.flatMap((start, index) => {
    const end = polygon[(index + 1) % polygon.length];
    const steps = Math.max(
      1,
      Math.ceil(Math.hypot(end.x - start.x, end.y - start.y) / 0.035),
    );
    return Array.from({ length: steps }, (_, i) => ({
      x: start.x + ((end.x - start.x) * i) / steps,
      y: start.y + ((end.y - start.y) * i) / steps,
    }));
  });
}

/** Shared sublevel mesh for the inline and popup terrain, in model coordinates. */
export function terrainThresholdMesh(
  threshold: ReturnType<typeof terrainThreshold>,
  project: (point: Point) => Point & { depth: number },
) {
  if (threshold.kind === "disk" && threshold.radius === 0 && threshold.center) {
    return {
      patches: [],
      boundary: "",
      point: project(threshold.center),
      minX: threshold.center.x,
      maxX: threshold.center.x,
      minY: threshold.center.y,
      maxY: threshold.center.y,
    };
  }
  let polygon = UNIT_CORNERS;
  if (
    threshold.kind === "disk" &&
    threshold.center &&
    threshold.radius !== null
  ) {
    const center = threshold.center,
      radius = threshold.radius;
    const containsUnitSquare = UNIT_CORNERS.every(
      (q) => Math.hypot(q.x - center.x, q.y - center.y) <= radius,
    );
    if (!containsUnitSquare)
      polygon = clipUnitSquare(
        Array.from({ length: 128 }, (_, i) => {
          const angle = (2 * Math.PI * i) / 128;
          return {
            x: center.x + radius * Math.cos(angle),
            y: center.y + radius * Math.sin(angle),
          };
        }),
      );
  }
  if (!polygon.length) return null;
  const boundary = subdivideBoundary(polygon);
  const center = {
    x: polygon.reduce((sum, p) => sum + p.x, 0) / polygon.length,
    y: polygon.reduce((sum, p) => sum + p.y, 0) / polygon.length,
  };
  const radial = (edge: Point, fraction: number) => ({
    x: center.x + fraction * (edge.x - center.x),
    y: center.y + fraction * (edge.y - center.y),
  });
  const patches = [];
  for (let i = 0; i < boundary.length; i++) {
    const a = boundary[i],
      b = boundary[(i + 1) % boundary.length];
    for (let ring = 0; ring < 8; ring++) {
      const vertices = [
        radial(a, ring / 8),
        radial(a, (ring + 1) / 8),
        radial(b, (ring + 1) / 8),
        radial(b, ring / 8),
      ].map(project);
      patches.push({
        key: `${i}-${ring}`,
        d: path(vertices, true),
        depth: vertices.reduce((sum, p) => sum + p.depth, 0) / 4,
      });
    }
  }
  return {
    patches: patches.sort((a, b) => a.depth - b.depth),
    boundary: path(boundary.map(project), true),
    point: null,
    minX: Math.min(...boundary.map((p) => p.x)),
    maxX: Math.max(...boundary.map((p) => p.x)),
    minY: Math.min(...boundary.map((p) => p.y)),
    maxY: Math.max(...boundary.map((p) => p.y)),
  };
}
