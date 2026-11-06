import { describe, expect, it } from "vitest";
import {
  DEFAULT_COLLECTIVE,
  EDGE_PAIRS,
  lubOf,
  sampleCollective,
  type CollectiveParameters,
  type CollectiveSample,
  type Point,
} from "./collective";
import { collectiveThreshold } from "./collectiveThreshold";

const parameters = (
  overrides: Partial<CollectiveParameters> = {},
): CollectiveParameters => ({ ...DEFAULT_COLLECTIVE, ...overrides });

/** Independent direct evaluation, without using the conditional-cost helper. */
function evaluate(
  p: CollectiveParameters,
  current: CollectiveSample,
  index: number,
  probe: Point,
) {
  const positions = current.positions.map((point, i) =>
    i === index ? probe : point,
  );
  const squaredDistance = (a: Point, b: Point) =>
    (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  const personal = current.personal.reduce(
    (sum, r) => sum + Math.max(0, Math.abs(r) - 1) ** 2 / 2,
    0,
  );
  const social = EDGE_PAIRS.reduce(
    (sum, [i, j], edge) =>
      sum + p.gamma[edge] * squaredDistance(positions[i], positions[j]),
    0,
  );
  const abstraction =
    p.theorem === 3
      ? positions.reduce(
          (sum, point) =>
            sum + (p.eta * squaredDistance(point, lubOf(p.worlds))) / 2,
          0,
        )
      : 0;
  return personal + social + abstraction;
}

describe("exact conditional threshold region", () => {
  it("has no region when fixed personal costs exceed theta", () => {
    const p = parameters({ personalInitial: [2, -1.6, 0.5] });
    const current = sampleCollective(0, p);
    for (const index of [0, 1, 2]) {
      const region = collectiveThreshold(p, current, index);
      expect(region.kind).toBe("none");
      expect(region.minimum).toBeGreaterThanOrEqual(0.68);
      expect(region.minimum).toBeGreaterThan(p.theta);
    }
  });

  it("matches independent full-cost evaluation at the center and disk boundary", () => {
    for (const theorem of [2, 3] as const)
      for (const eta of [0, 0.8]) {
        const p = parameters({
          theorem,
          gamma: [0.2, 0.8, 1.1],
          eta,
          theta: 2,
        });
        const current = sampleCollective(0.2, p);
        for (const index of [0, 1, 2]) {
          const region = collectiveThreshold(p, current, index);
          expect(region.kind).toBe("disk");
          if (region.kind !== "disk") throw new Error("Expected disk");
          expect(evaluate(p, current, index, region.center)).toBeCloseTo(
            region.minimum,
            12,
          );
          for (const angle of [0, Math.PI / 3, Math.PI, (4 * Math.PI) / 3]) {
            const at = (factor: number) => ({
              x: region.center.x + factor * region.radius * Math.cos(angle),
              y: region.center.y + factor * region.radius * Math.sin(angle),
            });
            expect(evaluate(p, current, index, at(1))).toBeCloseTo(p.theta, 12);
            expect(evaluate(p, current, index, at(0.99))).toBeLessThan(p.theta);
            expect(evaluate(p, current, index, at(1.01))).toBeGreaterThan(
              p.theta,
            );
          }
          for (const probe of [
            { x: 0, y: 0 },
            { x: 0.2, y: 0.9 },
            { x: 1, y: 1 },
          ]) {
            const diskValue =
              region.minimum +
              region.coefficient *
                ((probe.x - region.center.x) ** 2 +
                  (probe.y - region.center.y) ** 2);
            expect(diskValue).toBeCloseTo(
              evaluate(p, current, index, probe),
              12,
            );
          }
        }
      }
  });

  it("has a radius-zero disk when theta is the minimum and none below it", () => {
    const p = parameters();
    const current = sampleCollective(0.3, p);
    const minimum = collectiveThreshold(p, current, 0).minimum;
    const onMinimum = collectiveThreshold({ ...p, theta: minimum }, current, 0);
    expect(onMinimum.kind).toBe("disk");
    expect(onMinimum.radius).toBe(0);
    expect(
      collectiveThreshold({ ...p, theta: minimum - 1e-8 }, current, 0).kind,
    ).toBe("none");
  });

  it("uses the LUB as the center with abstraction alone", () => {
    const p = parameters({ theorem: 3, gamma: [0, 0, 0], theta: 2, eta: 0.8 });
    const region = collectiveThreshold(p, sampleCollective(0, p), 1);
    expect(region.kind).toBe("disk");
    expect(region.center?.x).toBeCloseTo(lubOf(p.worlds).x, 14);
    expect(region.center?.y).toBeCloseTo(lubOf(p.worlds).y, 14);
    expect(region.coefficient).toBe(0.4);
  });

  it("classifies a constant slice as all or none without inventing a disk", () => {
    for (const theorem of [2, 3] as const)
      for (const gamma of [
        [0, 0, 0],
        [0.8, 0, 0],
      ]) {
        const p = parameters({
          theorem,
          gamma,
          eta: 0,
          personalInitial: [2, -1.6, 0.5],
        });
        const current = sampleCollective(0, p);
        const below = collectiveThreshold(p, current, 2);
        expect(below.kind).toBe("none");
        expect(below.center).toBeNull();
        expect(below.coefficient).toBe(0);
        const all = collectiveThreshold(
          { ...p, theta: current.total },
          current,
          2,
        );
        expect(all.kind).toBe("all");
        expect(all.radius).toBeNull();
        expect(all.minimum).toBe(current.total);
        expect(evaluate(p, current, 2, { x: 3, y: -4 })).toBeCloseTo(
          current.total,
          12,
        );
      }
  });

  it("rejects unknown agent indices", () => {
    const p = parameters();
    const current = sampleCollective(0, p);
    for (const index of [-1, 3, 0.5])
      expect(() => collectiveThreshold(p, current, index)).toThrow(RangeError);
  });
});
