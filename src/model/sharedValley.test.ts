import { describe, expect, it } from "vitest";
import {
  DEFAULT_COLLECTIVE,
  sampleCollective,
  type CollectiveParameters,
} from "./collective";
import { componentValleys, sharedValley } from "./sharedValley";

const parameters = (
  overrides: Partial<CollectiveParameters> = {},
): CollectiveParameters => ({ ...DEFAULT_COLLECTIVE, ...overrides });

describe("shared social-cost valley", () => {
  it("exactly decomposes the original ordered social cost for equal weights", () => {
    const p = parameters();
    const valley = sharedValley(p);
    expect(valley.exact).toBe(true);
    expect(valley.connected).toBe(true);
    expect(valley.coefficient).toBeCloseTo(2.4, 14);
    for (const time of [0, 0.1, 0.7, 2]) {
      const current = sampleCollective(time, p);
      const displayed = current.positions.reduce(
        (sum, point) => sum + valley.value(point),
        0,
      );
      expect(displayed).toBeCloseTo(current.social, 12);
    }
  });

  it("bounds the social cost for unequal connected weights", () => {
    for (const gamma of [
      [0.1, 0.8, 1.2],
      [0, 0.8, 0.2],
      [1e-10, 1, 0],
    ]) {
      const p = parameters({ gamma });
      const valley = sharedValley(p);
      expect(valley.exact).toBe(false);
      expect(valley.connected).toBe(true);
      for (const time of [0, 0.1, 0.7, 2]) {
        const current = sampleCollective(time, p);
        const displayed = current.positions.reduce(
          (sum, point) => sum + valley.value(point),
          0,
        );
        expect(displayed).toBeGreaterThanOrEqual(0);
        expect(displayed).toBeLessThanOrEqual(current.social + 1e-12);
      }
    }
  });

  it("can preserve Q's spectral lower bound while a single stronger edge raises actual cost and speeds alignment", () => {
    const base = parameters({ gamma: [0.8, 0.8, 0.8] });
    const stronger = parameters({ gamma: [2, 0.8, 0.8] });
    const baseValley = sharedValley(base);
    const strongerValley = sharedValley(stronger);
    expect(baseValley.coefficient).toBeCloseTo(2.4, 12);
    expect(strongerValley.coefficient).toBeCloseTo(2.4, 12);
    expect(strongerValley.exact).toBe(false);
    expect(sampleCollective(0, base).social).toBeCloseTo(0.936, 12);
    expect(sampleCollective(0, stronger).social).toBeCloseTo(1.8, 12);
    for (const point of base.initial)
      expect(strongerValley.value(point)).toBeCloseTo(
        baseValley.value(point),
        12,
      );
    const distance = (p: CollectiveParameters) => {
      const point = sampleCollective(0.1, p).positions[0];
      return Math.hypot(point.x - 0.45, point.y - 0.45);
    };
    expect(distance(stronger)).toBeLessThan(distance(base));
  });

  it("places the minimum at the conserved mean of the actual trajectory", () => {
    const p = parameters({ gamma: [0.2, 0.5, 1.3] });
    const valley = sharedValley(p);
    expect(valley.center.x).toBeCloseTo(0.45, 14);
    expect(valley.center.y).toBeCloseTo(0.45, 14);
    expect(valley.value(valley.center)).toBe(0);
    expect(valley.value({ x: 0, y: 0 })).toBeGreaterThan(0);
    for (const time of [0, 0.4, 3, 12]) {
      const current = sampleCollective(time, p);
      for (const axis of ["x", "y"] as const) {
        expect(
          current.positions.reduce((sum, point) => sum + point[axis], 0) / 3,
        ).toBeCloseTo(valley.center[axis], 12);
      }
    }
  });

  it("shows a flat surface when the full graph is disconnected", () => {
    for (const gamma of [
      [0, 0, 0],
      [0.8, 0, 0],
      [0, 0.8, 0],
      [0, 0, 0.8],
    ]) {
      const valley = sharedValley(parameters({ gamma }));
      expect(valley.connected).toBe(false);
      expect(valley.exact).toBe(gamma.every((weight) => weight === 0));
      expect(valley.coefficient).toBe(0);
      for (const point of [{ x: 0, y: 0 }, { x: 1, y: 1 }, valley.center])
        expect(valley.value(point)).toBe(0);
    }
  });

  it("retains finite positive curvature for very weak coupling", () => {
    const tiny = sharedValley(parameters({ gamma: [1e-200, 1e-200, 1e-200] }));
    expect(tiny.coefficient / 1e-200).toBeCloseTo(3, 12);
    const weak = sharedValley(parameters({ gamma: [1, 1e-200, 0] }));
    expect(Number.isFinite(weak.coefficient)).toBe(true);
    expect(weak.coefficient / 1e-200).toBeCloseTo(1.5, 12);
  });
});

describe("component social-cost valleys", () => {
  it("retains a pair valley and a flat isolated component after disconnection", () => {
    const valleys = componentValleys(parameters({ gamma: [0.8, 0, 0] }));
    expect(valleys.map((valley) => valley.members)).toEqual([[0, 1], [2]]);
    expect(valleys[0].center).toEqual({ x: 0.5, y: 0.5 });
    expect(valleys[0].coefficient).toBe(1.6);
    expect(valleys[0].connected).toBe(true);
    expect(valleys[1].center).toEqual(DEFAULT_COLLECTIVE.initial[2]);
    expect(valleys[1].coefficient).toBe(0);
    expect(valleys[1].connected).toBe(false);
  });

  it("decomposes the actual social energy for every single-edge graph", () => {
    for (const gamma of [
      [0.8, 0, 0],
      [0, 0.8, 0],
      [0, 0, 0.8],
      [0, 0, 0],
    ]) {
      const p = parameters({ gamma });
      const valleys = componentValleys(p);
      for (const time of [0, 0.2, 1, 12]) {
        const current = sampleCollective(time, p);
        const displayed = valleys.reduce(
          (sum, valley) =>
            sum +
            valley.members.reduce(
              (subtotal, index) =>
                subtotal + valley.value(current.positions[index]),
              0,
            ),
          0,
        );
        expect(displayed).toBeCloseTo(current.social, 12);
        expect(valleys.every((valley) => valley.exact)).toBe(true);
      }
      const final = sampleCollective(12, p);
      for (const valley of valleys)
        for (const index of valley.members) {
          expect(final.positions[index].x).toBeCloseTo(valley.center.x, 10);
          expect(final.positions[index].y).toBeCloseTo(valley.center.y, 10);
        }
    }
  });

  it("keeps the connected graph's shared valley and isolates all three zero-edge agents", () => {
    for (const gamma of [
      [0.8, 0.8, 0.8],
      [0.2, 1, 0],
    ]) {
      const p = parameters({ gamma });
      const [valley] = componentValleys(p);
      const shared = sharedValley(p);
      expect(componentValleys(p)).toHaveLength(1);
      expect(valley.members).toEqual([0, 1, 2]);
      expect(valley.coefficient).toBe(shared.coefficient);
      expect(valley.exact).toBe(shared.exact);
      expect(valley.center).toEqual(shared.center);
    }
    const isolated = componentValleys(parameters({ gamma: [0, 0, 0] }));
    expect(isolated.map((valley) => valley.members)).toEqual([[0], [1], [2]]);
    expect(isolated.every((valley) => valley.coefficient === 0)).toBe(true);
  });
});
