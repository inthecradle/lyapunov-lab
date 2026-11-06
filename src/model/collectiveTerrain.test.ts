import { describe, expect, it } from "vitest";
import {
  DEFAULT_COLLECTIVE,
  sampleCollective,
  type CollectiveParameters,
  type CollectiveSample,
  type Point,
} from "./collective";
import { conditionalCollectiveCost } from "./collectiveTerrain";

/** Independent full evaluation, including all nine ordered social terms. */
function fullCost(
  p: CollectiveParameters,
  current: CollectiveSample,
  index: number,
  probe: Point,
) {
  const positions = current.positions.map((point, i) =>
    i === index ? probe : point,
  );
  const coefficients = [
    [0, p.gamma[0], p.gamma[1]],
    [p.gamma[0], 0, p.gamma[2]],
    [p.gamma[1], p.gamma[2], 0],
  ];
  let cost = current.personal.reduce(
    (sum, r) => sum + Math.max(0, Math.abs(r) - 1) ** 2 / 2,
    0,
  );
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const dx = positions[i].x - positions[j].x;
      const dy = positions[i].y - positions[j].y;
      cost += (coefficients[i][j] * (dx ** 2 + dy ** 2)) / 2;
    }
  }
  if (p.theorem === 3) {
    const targetX = Math.max(...p.worlds.map((point) => point.x));
    const targetY = Math.max(...p.worlds.map((point) => point.y));
    cost +=
      p.eta *
      positions.reduce(
        (sum, point) =>
          sum + ((point.x - targetX) ** 2 + (point.y - targetY) ** 2) / 2,
        0,
      );
  }
  return cost;
}

describe("conditional collective terrain", () => {
  it("matches the full original cost for each selected agent and theorem", () => {
    for (const theorem of [2, 3] as const) {
      const p = { ...DEFAULT_COLLECTIVE, theorem, gamma: [0.3, 0.8, 1.2] };
      for (const time of [0, 0.4, 3]) {
        const current = sampleCollective(time, p);
        for (const index of [0, 1, 2]) {
          for (const probe of [
            { x: 0, y: 0 },
            { x: 0.27, y: 0.83 },
            { x: 1, y: 1 },
          ]) {
            expect(
              conditionalCollectiveCost(p, current, index, probe),
            ).toBeCloseTo(fullCost(p, current, index, probe), 12);
          }
        }
      }
    }
  });

  it("passes through the current total without mutating the current state", () => {
    for (const theorem of [2, 3] as const) {
      const p = { ...DEFAULT_COLLECTIVE, theorem };
      const current = sampleCollective(0.8, p);
      const before = structuredClone(current);
      for (const index of [0, 1, 2]) {
        expect(
          conditionalCollectiveCost(
            p,
            current,
            index,
            current.positions[index],
          ),
        ).toBe(current.total);
        conditionalCollectiveCost(p, current, index, { x: 0, y: 1 });
      }
      expect(current).toEqual(before);
    }
  });

  it("uses eta only for theorem 3 and exactly preserves its abstraction cost", () => {
    const probe = { x: 0.1, y: 0.95 };
    const p2: CollectiveParameters = {
      ...DEFAULT_COLLECTIVE,
      theorem: 2,
      eta: 7,
    };
    const p3: CollectiveParameters = { ...p2, theorem: 3 };
    const current2 = sampleCollective(0, p2);
    const current3 = sampleCollective(0, p3);
    const zeroEta = { ...p3, eta: 0 };
    for (const index of [0, 1, 2]) {
      const cost2 = conditionalCollectiveCost(p2, current2, index, probe);
      expect(
        conditionalCollectiveCost(
          zeroEta,
          sampleCollective(0, zeroEta),
          index,
          probe,
        ),
      ).toBeCloseTo(cost2, 12);
      expect(
        conditionalCollectiveCost(p3, current3, index, probe) - cost2,
      ).toBeCloseTo(
        fullCost(p3, current3, index, probe) -
          fullCost(p2, current2, index, probe),
        12,
      );
    }
  });

  it("is flat for an isolated agent without LUB attraction, even if another edge is coupled", () => {
    for (const gamma of [
      [0, 0, 0],
      [0.8, 0, 0],
    ]) {
      for (const theorem of [2, 3] as const) {
        const p = { ...DEFAULT_COLLECTIVE, theorem, gamma, eta: 0 };
        const current = sampleCollective(0.6, p);
        const indices = gamma[0] > 0 ? [2] : [0, 1, 2];
        for (const index of indices) {
          for (const probe of [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ])
            expect(conditionalCollectiveCost(p, current, index, probe)).toBe(
              current.total,
            );
        }
      }
    }
  });

  it("rejects invalid selections and nonfinite probe coordinates", () => {
    const current = sampleCollective(0, DEFAULT_COLLECTIVE);
    for (const index of [-1, 3, 0.5, NaN])
      expect(() =>
        conditionalCollectiveCost(DEFAULT_COLLECTIVE, current, index, {
          x: 0,
          y: 0,
        }),
      ).toThrow(RangeError);
    for (const probe of [
      { x: NaN, y: 0 },
      { x: 0, y: Infinity },
    ])
      expect(() =>
        conditionalCollectiveCost(DEFAULT_COLLECTIVE, current, 0, probe),
      ).toThrow(RangeError);
  });
});
