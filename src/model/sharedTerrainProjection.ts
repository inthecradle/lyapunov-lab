import { compressedHeight } from "./terrain";
import type { Point } from "./collective";

// The default complete graph has lambda_2 = 3 * .8. Keep this reference
// unchanged when gamma changes, so cost differences remain visible.
export const T2_HEIGHT_REFERENCE_COEFFICIENT = 2.4;

export type SharedTerrainCamera = {
  yaw: number;
  elevation: number;
  center: Point;
  radius: number;
  coefficient: number;
  flat: boolean;
  heightReferenceCoefficient?: number;
};

/** Reuse theorem 1's display transform; neither coordinates nor model costs change. */
export function sharedTerrainProjection(camera: SharedTerrainCamera) {
  const maxV =
    ((Math.sqrt(
      camera.heightReferenceCoefficient ?? (camera.coefficient || 1),
    ) *
      camera.radius) /
      1.12) **
    2;
  const yaw = (camera.yaw * Math.PI) / 180;
  const elevation = (camera.elevation * Math.PI) / 180;
  const c = Math.cos(yaw),
    s = Math.sin(yaw);
  const se = Math.sin(elevation),
    ce = Math.cos(elevation);
  const baseScale = 190 / camera.radius;
  // Fit a fixed envelope, including the full well depth. It must not depend
  // on which theorem is shown, its valley location, or coupling coefficients.
  const across = 190 * (Math.abs(c) + Math.abs(s));
  const vertical = 2 * se * across + ce * 210;
  const fit = Math.min(1, 512 / (2 * across), 304 / vertical);
  const scale = baseScale * fit;
  const originY = 219 - (fit * ce * 210) / 2;
  const project = (point: Point, height: number) => {
    const x = point.x - camera.center.x,
      y = point.y - camera.center.y;
    return {
      x: 300 + scale * (c * x - s * y),
      y: originY + se * scale * (s * x + c * y) - fit * ce * height,
      depth: ce * scale * (s * x + c * y) + fit * se * height,
    };
  };
  const displayHeight = (value: number) =>
    camera.flat ? 0 : compressedHeight(value, maxV);
  return {
    maxV,
    displayHeight,
    point: (point: Point, value: number) =>
      project(point, displayHeight(value)),
    reference: (point: Point) => project(point, 0),
    // For the explicitly labeled introductory illustration, never for model costs.
    atDisplayHeight: project,
    delta: (screen: Point): Point => {
      const across = screen.x / scale;
      const depth = screen.y / (se * scale);
      return {
        x: c * across + s * depth,
        y: -s * across + c * depth,
      };
    },
  };
}
