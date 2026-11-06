import { describe, expect, it } from "vitest";
import {
  DEFAULT_COLLECTIVE,
  sampleCollective,
  type CollectiveParameters,
} from "./collective";
import {
  collectiveAgentCosts,
  collectiveAgentCostAxisMax,
  collectivePlaybackTerrain,
} from "./collectivePlayback";
import {
  sharedTerrainProjection,
  T2_HEIGHT_REFERENCE_COEFFICIENT,
} from "./sharedTerrainProjection";

const parameters = (
  overrides: Partial<CollectiveParameters> = {},
): CollectiveParameters => ({ ...DEFAULT_COLLECTIVE, ...overrides });

describe("fixed collective playback terrain", () => {
  it("decomposes the default theorem 2 social cost, including its known initial heights", () => {
    const p = parameters();
    const terrain = collectivePlaybackTerrain(p);
    expect(terrain.exact).toBe(true);
    expect(terrain.hasValley).toBe(true);
    expect(terrain.center?.x).toBeCloseTo(0.45, 12);
    expect(terrain.center?.y).toBeCloseTo(0.45, 12);
    const initial = p.initial.map((q, i) => terrain.agentValue(i, q));
    expect(initial[0]).toBeCloseTo(0.444, 12);
    expect(initial[1]).toBeCloseTo(0.444, 12);
    expect(initial[2]).toBeCloseTo(0.048, 12);
    expect(initial.reduce((sum, value) => sum + value, 0)).toBeCloseTo(
      0.936,
      12,
    );
    for (const time of [0, 0.2, 1, 4]) {
      const current = sampleCollective(time, p);
      const displayed = current.positions.reduce(
        (sum, point, i) => sum + terrain.agentValue(i, point),
        0,
      );
      expect(displayed).toBeCloseTo(current.social, 12);
    }
  });

  it("keeps isolated agents at zero for each possible connected pair", () => {
    for (const gamma of [
      [0.8, 0, 0],
      [0, 0.8, 0],
      [0, 0, 0.8],
    ]) {
      const p = parameters({ gamma });
      const terrain = collectivePlaybackTerrain(p);
      const isolated = gamma[0] > 0 ? 2 : gamma[1] > 0 ? 1 : 0;
      expect(terrain.isolated(isolated)).toBe(true);
      for (const point of [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ])
        expect(terrain.agentValue(isolated, point)).toBe(0);
      for (const time of [0, 0.3, 2]) {
        const current = sampleCollective(time, p);
        expect(
          current.positions.reduce(
            (sum, point, i) => sum + terrain.agentValue(i, point),
            0,
          ),
        ).toBeCloseTo(current.social, 12);
      }
    }
    const flat = collectivePlaybackTerrain(parameters({ gamma: [0, 0, 0] }));
    expect(flat.hasValley).toBe(false);
    for (const index of [0, 1, 2]) {
      expect(flat.isolated(index)).toBe(true);
      expect(flat.agentValue(index, { x: 1, y: 1 })).toBe(0);
    }
  });

  it("displays eta times each abstraction cost in theorem 3 independently of coupling", () => {
    for (const gamma of [
      [0, 0, 0],
      [0.2, 0.8, 1.2],
    ]) {
      const p = parameters({ theorem: 3, gamma, eta: 1.3 });
      const terrain = collectivePlaybackTerrain(p);
      expect(terrain.exact).toBe(true);
      expect(terrain.center).toEqual({ x: 0.8, y: 0.8 });
      expect(terrain.valueAt({ x: 0.8, y: 0.8 })).toBe(0);
      for (const time of [0, 0.4, 2]) {
        const current = sampleCollective(time, p);
        const values = current.positions.map((point, i) =>
          terrain.agentValue(i, point),
        );
        values.forEach((value, i) =>
          expect(value).toBeCloseTo(p.eta * current.abstractionCosts[i], 12),
        );
        expect(values.reduce((sum, value) => sum + value, 0)).toBeCloseTo(
          current.abstraction,
          12,
        );
      }
    }
  });

  it("shares one fixed axis across theorems and contains both surfaces over the unit square", () => {
    for (const settings of [
      {},
      { gamma: [0, 0, 0], eta: 0 },
      { gamma: [0.1, 0.8, 1.2], eta: 2 },
      { gamma: [0.8, 0, 0], eta: 0.01 },
      {
        initial: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
          { x: 1, y: 0 },
        ],
        worlds: [
          { x: 0, y: 0 },
          { x: 0.1, y: 0 },
          { x: 0, y: 0.1 },
        ],
      },
    ]) {
      const p2 = parameters({ ...settings, theorem: 2 });
      const p3 = parameters({ ...settings, theorem: 3 });
      const terrains = [
        collectivePlaybackTerrain(p2),
        collectivePlaybackTerrain(p3),
      ];
      expect(terrains[0].axisMax).toBe(terrains[1].axisMax);
      expect(terrains[0].axisMax).toBeGreaterThan(0);
      for (const terrain of terrains) {
        for (let x = 0; x <= 8; x++)
          for (let y = 0; y <= 8; y++) {
            const point = { x: x / 8, y: y / 8 };
            expect(terrain.valueAt(point)).toBeGreaterThanOrEqual(0);
            expect(terrain.valueAt(point)).toBeLessThanOrEqual(terrain.axisMax);
            for (const index of [0, 1, 2])
              expect(terrain.agentValue(index, point)).toBeLessThanOrEqual(
                terrain.axisMax,
              );
          }
      }
    }
  });

  it("keeps theorem 3 flat without LUB attraction even while coupling moves the agents", () => {
    const p = parameters({ theorem: 3, eta: 0 });
    const terrain = collectivePlaybackTerrain(p);
    expect(terrain.hasValley).toBe(false);
    const current = sampleCollective(1, p);
    expect(current.positions[0]).not.toEqual(p.initial[0]);
    for (const point of [...p.initial, ...current.positions, { x: 1, y: 1 }]) {
      expect(terrain.valueAt(point)).toBe(0);
      for (const index of [0, 1, 2])
        expect(terrain.agentValue(index, point)).toBe(0);
    }
  });
});

describe("playback terrain style", () => {
  it("matches the original terrain projection even when theorem 3 weights its displayed values", () => {
    const camera = {
      yaw: -28,
      elevation: 28,
      center: { x: 0.5, y: 0.5 },
      radius: 1,
      flat: false,
    };
    for (const theorem of [2, 3] as const)
      for (const eta of [0.1, 0.8, 2]) {
        const p = parameters({ theorem, eta });
        const terrain = collectivePlaybackTerrain(p);
        const popup = sharedTerrainProjection({
          ...camera,
          coefficient: terrain.coefficient,
          heightReferenceCoefficient:
            theorem === 2 ? T2_HEIGHT_REFERENCE_COEFFICIENT : undefined,
        });
        const original = sharedTerrainProjection({
          ...camera,
          coefficient: theorem === 3 ? 0.5 : terrain.coefficient,
          heightReferenceCoefficient:
            theorem === 2 ? T2_HEIGHT_REFERENCE_COEFFICIENT : undefined,
        });
        expect(popup.displayHeight(0)).toBe(-210);
        expect(popup.displayHeight(popup.maxV)).toBeCloseTo(0, 12);
        for (const time of [0, 0.2, 1, 4]) {
          const sample = sampleCollective(time, p);
          sample.positions.forEach((point, i) => {
            const actual = popup.point(point, terrain.agentValue(i, point));
            const expected = original.point(
              point,
              theorem === 3
                ? sample.abstractionCosts[i]
                : terrain.agentValue(i, point),
            );
            expect(actual.x).toBeCloseTo(expected.x, 10);
            expect(actual.y).toBeCloseTo(expected.y, 10);
          });
        }
      }
  });
});

describe("theorem 2 agent cost breakdown", () => {
  it("adds each ordered pair cost to its own agent without lowering the personal cost", () => {
    for (const gamma of [
      [0, 0, 0],
      [0.8, 0, 0],
      [0, 0.8, 0],
      [0, 0, 0.8],
      [0.1, 0.8, 1.2],
    ]) {
      const p = parameters({
        theorem: 2,
        gamma,
        personalInitial: [2, -1.6, 0.5],
      });
      for (const time of [0, 0.1, 0.5, 2, 12]) {
        const sample = sampleCollective(time, p);
        const costs = collectiveAgentCosts(sample, p);
        expect(costs).toHaveLength(3);
        const [s12, s13, s23] = sample.pairCosts;
        const expectedSocial = [
          gamma[0] * s12 + gamma[1] * s13,
          gamma[0] * s12 + gamma[2] * s23,
          gamma[1] * s13 + gamma[2] * s23,
        ];
        costs.forEach((cost, i) => {
          expect(cost.personal).toBe(sample.personalCosts[i]);
          expect(cost.social).toBeCloseTo(expectedSocial[i], 12);
          expect(cost.social).toBeGreaterThanOrEqual(0);
          expect(cost.total).toBeCloseTo(cost.personal + cost.social, 12);
          expect(cost.total).toBeGreaterThanOrEqual(cost.personal);
        });
        expect(costs.reduce((sum, cost) => sum + cost.social, 0)).toBeCloseTo(
          sample.social,
          12,
        );
        expect(costs.reduce((sum, cost) => sum + cost.total, 0)).toBeCloseTo(
          sample.total,
          12,
        );
      }
    }
  });

  it("keeps one absolute chart axis large enough for every agent throughout playback", () => {
    for (const settings of [
      {},
      { gamma: [0, 0, 0], personalInitial: [0, 0, 0], theta: 0 },
      { gamma: [0.8, 0, 0], personalInitial: [4, -3, 1] },
      { gamma: [0.1, 0.8, 1.2] },
      { theta: 20 },
    ]) {
      const p = parameters({ ...settings, theorem: 2 });
      const axisMax = collectiveAgentCostAxisMax(p);
      expect(axisMax).toBeGreaterThan(0);
      expect(axisMax).toBeGreaterThanOrEqual(p.theta);
      for (const time of [0, 0.05, 0.2, 0.5, 1, 4, 12]) {
        const costs = collectiveAgentCosts(sampleCollective(time, p), p);
        costs.forEach((cost) =>
          expect(cost.total).toBeLessThanOrEqual(axisMax),
        );
        expect(collectiveAgentCostAxisMax(p)).toBe(axisMax);
      }
    }
  });

  it("keeps the T2 cost axis fixed across every combination of UI gamma values", () => {
    for (const personalInitial of [
      DEFAULT_COLLECTIVE.personalInitial,
      [4, -3, 1],
    ]) {
      const expectedAxis = collectiveAgentCostAxisMax(
        parameters({ personalInitial }),
      );
      for (const gamma12 of [0, 0.2, 0.8, 2])
        for (const gamma13 of [0, 0.2, 0.8, 2])
          for (const gamma23 of [0, 0.2, 0.8, 2]) {
            const p = parameters({
              personalInitial,
              gamma: [gamma12, gamma13, gamma23],
            });
            expect(collectiveAgentCostAxisMax(p)).toBe(expectedAxis);
            for (const time of [0, 0.1, 1, 12]) {
              const sample = sampleCollective(time, p);
              expect(sample.total).toBeLessThanOrEqual(expectedAxis);
              for (const cost of collectiveAgentCosts(sample, p))
                expect(cost.total).toBeLessThanOrEqual(expectedAxis);
            }
          }
    }
    // Programmatic parameters above the UI's maximum still fit the envelope.
    const p = parameters({ gamma: [5, 0.1, 3], personalInitial: [4, -3, 1] });
    const axisMax = collectiveAgentCostAxisMax(p);
    expect(axisMax).toBeGreaterThan(
      collectiveAgentCostAxisMax(
        parameters({ personalInitial: p.personalInitial }),
      ),
    );
    for (const time of [0, 0.1, 1, 12])
      expect(sampleCollective(time, p).total).toBeLessThanOrEqual(axisMax);
  });

  it("distinguishes Q terrain heights from each agent's personal plus social evaluation", () => {
    const p = parameters();
    const sample = sampleCollective(0, p);
    const terrain = collectivePlaybackTerrain(p);
    const costs = collectiveAgentCosts(sample, p);
    expect(costs[0].personal).toBe(0);
    expect(costs[0].social).toBeCloseTo(0.378, 12);
    expect(costs[0].total).toBeCloseTo(0.378, 12);
    const qHeight = terrain.agentValue(0, sample.positions[0]);
    expect(qHeight).toBeCloseTo(0.444, 12);
    expect(costs[0].social).not.toBeCloseTo(qHeight, 6);
    expect(costs[0].total).not.toBeCloseTo(qHeight, 6);
  });
});
