import { describe, expect, it } from "vitest";
import {
  introTerrainHeight,
  morphValleys,
  personalValleyHeight,
} from "./collectiveIntro";
import { compressedHeight } from "./terrain";

const centers = [
  { x: 0.8, y: 0.2 },
  { x: 0.2, y: 0.8 },
  { x: 0.35, y: 0.35 },
];
const target = {
  center: { x: 0.45, y: 0.45 },
  radius: 0.8,
  members: [0, 1, 2],
};

describe("conceptual collective terrain morph", () => {
  it("starts with three wells of equal depth and a flat surrounding plane", () => {
    for (const center of centers) {
      expect(personalValleyHeight(center, centers)).toBe(-120);
    }
    expect(personalValleyHeight({ x: -0.5, y: -0.5 }, centers)).toBe(0);
    expect(personalValleyHeight({ x: 0.5, y: 0.5 }, [])).toBe(0);
  });

  it("combines overlapping wells without adding their depths", () => {
    const point = { x: 0.4, y: 0.45 };
    expect(personalValleyHeight(point, centers)).toBe(
      Math.min(
        ...centers.map((center) => personalValleyHeight(point, [center])),
      ),
    );
    expect(personalValleyHeight(point, [point, point, point])).toBe(-120);
    expect(
      introTerrainHeight(target.center, morphValleys(centers, target, 1)),
    ).toBe(-210);
  });

  it("reaches exact geometry endpoints and clamps progress", () => {
    for (const progress of [-1, 0]) {
      expect(morphValleys(centers, target, progress)).toEqual(
        centers.map((center) => ({ center, radius: 0.55, depth: 120 })),
      );
    }
    for (const progress of [1, 2]) {
      expect(morphValleys(centers, target, progress)).toEqual(
        centers.map(() => ({ center: target.center, radius: 0.8, depth: 210 })),
      );
    }
  });

  it("moves each center while changing the radius and depth with smoothstep timing", () => {
    const progress = 0.25;
    const blend = 0.15625;
    for (const [index, valley] of morphValleys(
      centers,
      target,
      progress,
    ).entries()) {
      expect(valley.center.x).toBeCloseTo(
        centers[index].x * (1 - blend) + target.center.x * blend,
      );
      expect(valley.center.y).toBeCloseTo(
        centers[index].y * (1 - blend) + target.center.y * blend,
      );
      expect(valley.radius).toBeCloseTo(0.55 * (1 - blend) + 0.8 * blend);
      expect(valley.depth).toBeCloseTo(120 * (1 - blend) + 210 * blend);
    }
  });

  it("keeps an isolated valley in place and fades it to the plane", () => {
    const pairTarget = { ...target, members: [0, 1] };
    const halfway = morphValleys(centers, pairTarget, 0.5);
    expect(halfway[2]).toEqual({ center: centers[2], radius: 0.55, depth: 60 });
    expect(halfway[0].center).not.toEqual(centers[0]);
    expect(morphValleys(centers, pairTarget, 1)[2]).toEqual({
      center: centers[2],
      radius: 0.55,
      depth: 0,
    });
    const faded = morphValleys(centers, null, 1);
    expect(faded.map((valley) => valley.center)).toEqual(centers);
    for (const center of centers)
      expect(introTerrainHeight(center, faded)).toBe(0);
  });

  it.each([2.4, 0.5])(
    "matches the existing compressed terrain at completion for coefficient %s",
    (coefficient) => {
      const maxV = coefficient / 1.12 ** 2;
      const common = {
        ...target,
        radius: Math.sqrt((0.85 * maxV) / coefficient),
      };
      const valleys = morphValleys(centers, common, 1);
      for (let ix = -5; ix <= 15; ix++) {
        for (let iy = -5; iy <= 15; iy++) {
          const point = { x: ix / 10, y: iy / 10 };
          const cost =
            coefficient *
            ((point.x - common.center.x) ** 2 +
              (point.y - common.center.y) ** 2);
          expect(introTerrainHeight(point, valleys)).toBeCloseTo(
            compressedHeight(cost, maxV),
            10,
          );
        }
      }
    },
  );

  it("keeps intermediate geometry finite and surface heights within the display range", () => {
    for (const destination of [target, { ...target, members: [0, 1] }, null]) {
      for (const progress of [0, 0.1, 0.5, 0.9, 1]) {
        const valleys = morphValleys(centers, destination, progress);
        for (const valley of valleys) {
          expect(Number.isFinite(valley.center.x)).toBe(true);
          expect(Number.isFinite(valley.center.y)).toBe(true);
          expect(valley.radius).toBeGreaterThan(0);
          expect(valley.radius).toBeLessThanOrEqual(0.8);
          expect(valley.depth).toBeGreaterThanOrEqual(0);
          expect(valley.depth).toBeLessThanOrEqual(210);
        }
        for (let ix = -5; ix <= 15; ix++) {
          for (let iy = -5; iy <= 15; iy++) {
            const height = introTerrainHeight(
              { x: ix / 10, y: iy / 10 },
              valleys,
            );
            expect(Number.isFinite(height)).toBe(true);
            expect(height).toBeGreaterThanOrEqual(-210);
            expect(height).toBeLessThanOrEqual(0);
          }
        }
      }
    }
  });
});
