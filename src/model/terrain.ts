import type { Vec2 } from "./lyapunov";

export type TerrainVertex = Vec2 & { z: number };
export type TerrainCamera = {
  yaw: number;
  elevation: number;
  maxV: number;
  stretch: number;
};

/** A C² display transform: the true potential V stays unchanged in the model. */
export function compressedHeight(value: number, maxV: number): number {
  return -210 * Math.max(0, 1 - value / (0.85 * maxV)) ** 3;
}

export function terrainDomain(camera: TerrainCamera) {
  return {
    x: 1.12 * Math.sqrt(camera.maxV),
    y: 1.12 * Math.sqrt(camera.maxV / camera.stretch),
  };
}

/** Fit the rectangular sheet and its depression, with room for point markers. */
export function terrainProjection(camera: TerrainCamera) {
  const yaw = (camera.yaw * Math.PI) / 180;
  const elevation = (camera.elevation * Math.PI) / 180;
  const c = Math.cos(yaw),
    s = Math.sin(yaw);
  const se = Math.sin(elevation),
    ce = Math.cos(elevation);
  const domain = terrainDomain(camera);
  const baseScale = 190 / Math.max(domain.x, domain.y);
  const rawPoint = ({ x, y, z }: TerrainVertex) => ({
    x: baseScale * (c * x - s * y),
    y: se * baseScale * (s * x + c * y) - ce * compressedHeight(z, camera.maxV),
    depth:
      ce * baseScale * (s * x + c * y) + se * compressedHeight(z, camera.maxV),
  });
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  // Includes the exact four corners and dense samples of the smooth well.
  for (let row = 0; row <= 48; row++) {
    for (let col = 0; col <= 48; col++) {
      const x = domain.x * (col / 24 - 1);
      const y = domain.y * (row / 24 - 1);
      const point = rawPoint({ x, y, z: x * x + camera.stretch * y * y });
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }
  }
  const fit = Math.min(1, 512 / (maxX - minX), 304 / (maxY - minY));
  const centerX = 300 - (fit * (minX + maxX)) / 2;
  const centerY = 219 - (fit * (minY + maxY)) / 2;
  return {
    scale: baseScale * fit,
    c,
    s,
    se,
    point: (vertex: TerrainVertex) => {
      const point = rawPoint(vertex);
      return {
        x: centerX + fit * point.x,
        y: centerY + fit * point.y,
        depth: fit * point.depth,
      };
    },
  };
}
