import { describe, expect, it } from "vitest";
import {
  collectiveGuarantees,
  DEFAULT_COLLECTIVE,
  EDGE_PAIRS,
  lubOf,
  sampleCollective,
  type CollectiveParameters,
} from "./collective";

const parameters = (
  overrides: Partial<CollectiveParameters> = {},
): CollectiveParameters => ({ ...DEFAULT_COLLECTIVE, ...overrides });

describe("collective gradient flow", () => {
  it("starts every default agent at zero personal cost while representations still disagree", () => {
    for (const theorem of [2, 3] as const) {
      const p = parameters({ theorem });
      for (const time of [0, 0.3, 4, 12]) {
        const sample = sampleCollective(time, p);
        expect(sample.personalCosts).toEqual([0, 0, 0]);
        expect(sample.personal).toEqual([0.8, -0.6, 0.5]);
      }
      const initial = sampleCollective(0, p);
      expect(initial.individual).toBe(0);
      expect(initial.social).toBeCloseTo(0.936, 12);
      expect(initial.pairCosts.every((cost) => cost > 0)).toBe(true);
      expect(initial.thresholdReached).toBe(false);
    }
  });
  it("matches the paper's ordered sum over all nine (i,j) terms", () => {
    const gamma = [0.3, 0.8, 1.2];
    const coefficients = [
      [0, gamma[0], gamma[1]],
      [gamma[0], 0, gamma[2]],
      [gamma[1], gamma[2], 0],
    ];
    for (const theorem of [2, 3] as const) {
      const p = parameters({ theorem, gamma });
      const target = lubOf(p.worlds);
      for (const time of [0, 0.4, 3]) {
        const s = sampleCollective(time, p);
        let orderedSocial = 0;
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 3; j++) {
            const dx = s.positions[i].x - s.positions[j].x;
            const dy = s.positions[i].y - s.positions[j].y;
            orderedSocial += (coefficients[i][j] * (dx * dx + dy * dy)) / 2;
          }
        }
        const individual = s.personal.reduce(
          (sum, r) => sum + Math.max(0, Math.abs(r) - 1) ** 2 / 2,
          0,
        );
        const abstraction = s.positions.reduce(
          (sum, z) => sum + ((z.x - target.x) ** 2 + (z.y - target.y) ** 2) / 2,
          0,
        );
        expect(s.social).toBeCloseTo(orderedSocial, 12);
        expect(s.individual).toBeCloseTo(individual, 12);
        expect(s.total).toBeCloseTo(
          individual +
            orderedSocial +
            (theorem === 3 ? p.eta * abstraction : 0),
          12,
        );
      }
    }
  });

  it("matches the independent vector field and energy derivative", () => {
    const h = 1e-6;
    for (const theorem of [2, 3] as const) {
      for (const gamma of [
        [1, 1, 1],
        [0.3, 0.8, 1.2],
        [1, 0, 0],
        [0, 0, 0],
      ]) {
        const p = parameters({
          theorem,
          gamma,
          personalInitial: [2, -1.6, 0.5],
        });
        const eta = theorem === 3 ? p.eta : 0;
        const target = lubOf(p.worlds);
        for (const time of [0.1, 1, 4]) {
          const before = sampleCollective(time - h, p);
          const current = sampleCollective(time, p);
          const after = sampleCollective(time + h, p);
          const velocities = current.positions.map((z) => ({
            x: -eta * (z.x - target.x),
            y: -eta * (z.y - target.y),
          }));
          EDGE_PAIRS.forEach(([i, j], edge) => {
            for (const axis of ["x", "y"] as const) {
              const force =
                2 *
                gamma[edge] *
                (current.positions[j][axis] - current.positions[i][axis]);
              velocities[i][axis] += force;
              velocities[j][axis] -= force;
            }
          });
          current.positions.forEach((_, i) => {
            for (const axis of ["x", "y"] as const)
              expect(
                (after.positions[i][axis] - before.positions[i][axis]) /
                  (2 * h),
              ).toBeCloseTo(velocities[i][axis], 8);
            const r = current.personal[i];
            const dr = -(r - Math.max(-1, Math.min(1, r)));
            expect(
              (after.personal[i] - before.personal[i]) / (2 * h),
            ).toBeCloseTo(dr, 8);
          });
          expect((after.total - before.total) / (2 * h)).toBeCloseTo(
            current.derivative,
            8,
          );
          expect(current.derivative).toBeLessThanOrEqual(0);
          expect(current.total).toBeCloseTo(
            current.individual + current.social + current.abstraction,
            12,
          );
        }
      }
    }
  });

  it("bounds the total for connected, disconnected, absent and weak interactions", () => {
    for (const theorem of [2, 3] as const) {
      for (const eta of [0, 0.01, 0.8, 2]) {
        for (const scale of [0, 0.01, 0.8, 3]) {
          for (const gamma of [
            [1, 1, 1],
            [1, 0, 0],
            [0, 0, 0],
            [1, 1e-9, 0],
          ]) {
            const p = parameters({
              theorem,
              eta,
              gamma: gamma.map((value) => value * scale),
            });
            const rate = collectiveGuarantees(p).decayRate;
            for (const time of [0, 0.3, 2, 12, 100]) {
              const s = sampleCollective(time, p);
              expect(s.total).toBeLessThanOrEqual(s.bound + 1e-12);
              expect(s.residual).toBeLessThanOrEqual(s.residualBound + 1e-12);
              expect(s.derivative).toBeLessThanOrEqual(-rate * s.total + 1e-12);
              for (const z of s.positions) {
                expect(z.x).toBeGreaterThanOrEqual(-1e-12);
                expect(z.y).toBeGreaterThanOrEqual(-1e-12);
                expect(z.x).toBeLessThanOrEqual(1 + 1e-12);
                expect(z.y).toBeLessThanOrEqual(1 + 1e-12);
              }
            }
          }
        }
      }
    }
  });

  it("uses the paper's threshold comparison inside and outside the stable sublevel set", () => {
    for (const theorem of [2, 3] as const) {
      const base = parameters({ theorem });
      const initialTotal = sampleCollective(0, base).total;
      for (const theta of [0, 0.1, initialTotal, initialTotal + 0.2]) {
        const p = { ...base, theta };
        const alpha = collectiveGuarantees(p).decayRate;
        for (const time of [0, 0.2, 2, 12]) {
          const s = sampleCollective(time, p);
          const expectedResidualBound =
            Math.max(initialTotal - theta, 0) * Math.exp(-alpha * time);
          expect(s.residualBound).toBeCloseTo(expectedResidualBound, 12);
          expect(s.bound).toBeCloseTo(theta + expectedResidualBound, 12);
          expect(s.residual).toBe(Math.max(s.total - theta, 0));
          expect(s.residual).toBeLessThanOrEqual(s.residualBound + 1e-12);
          expect(s.thresholdReached).toBe(s.total <= theta);
          if (s.total > theta)
            expect(s.derivative).toBeLessThanOrEqual(
              -alpha * (s.total - theta) + 1e-12,
            );
          if (theta >= initialTotal) expect(s.thresholdReached).toBe(true);
        }
      }
    }
    // Do not turn a small positive residual into finite-time arrival by tolerance.
    const p = parameters({
      gamma: [0, 0, 0],
      theta: 0,
      personalInitial: [2, -1.6, 0.5],
    });
    const nearBoundary = sampleCollective(12, p);
    expect(nearBoundary.total).toBeGreaterThan(0);
    expect(nearBoundary.thresholdReached).toBe(false);
    expect(sampleCollective(12, { ...p, theta: 0.1 }).thresholdReached).toBe(
      true,
    );
  });

  it("changing the threshold changes comparison quantities but not the dynamics", () => {
    for (const theorem of [2, 3] as const) {
      const p = parameters({ theorem, gamma: [0.2, 0.7, 0], theta: 0 });
      for (const time of [0, 0.5, 12]) {
        const zero = sampleCollective(time, p);
        const raised = sampleCollective(time, { ...p, theta: 2 });
        expect(raised.positions).toEqual(zero.positions);
        expect(raised.personal).toEqual(zero.personal);
        expect(raised.total).toBe(zero.total);
        expect(raised.derivative).toBe(zero.derivative);
        expect(raised.bound).not.toBe(zero.bound);
      }
    }
  });

  it("converges to the conserved mean with connected coupling, preserving personal differences", () => {
    const p = parameters();
    const s = sampleCollective(100, p);
    const mean = { x: 0.45, y: 0.45 };
    for (const z of s.positions) {
      expect(z.x).toBeCloseTo(mean.x, 12);
      expect(z.y).toBeCloseTo(mean.y, 12);
    }
    expect(s.personal).toEqual(p.personalInitial);
    expect(s.targetDistance).toBeGreaterThan(0.4);
    expect(collectiveGuarantees(p)).toMatchObject({
      connected: true,
      alignment: true,
      lub: false,
    });
  });

  it("allows zero energy with disagreement between disconnected components", () => {
    const p = parameters({ gamma: [1, 0, 0] });
    const s = sampleCollective(100, p);
    expect(s.total).toBeLessThan(1e-20);
    expect(s.positions[0].x).toBeCloseTo(0.5, 12);
    expect(s.positions[1].x).toBeCloseTo(0.5, 12);
    expect(s.positions[2].x).toBeCloseTo(0.35, 12);
    expect(s.disagreement).toBeGreaterThan(0.2);
    expect(collectiveGuarantees(p)).toMatchObject({
      connected: false,
      alignment: false,
      lub: false,
    });
    const uncoupled = parameters({ gamma: [0, 0, 0] });
    expect(collectiveGuarantees(uncoupled).alignment).toBe(false);
    sampleCollective(10, uncoupled).positions.forEach((z, i) => {
      expect(z.x).toBeCloseTo(uncoupled.initial[i].x, 12);
      expect(z.y).toBeCloseTo(uncoupled.initial[i].y, 12);
    });
  });

  it("adds LUB convergence with eta > 0, including disconnected agents", () => {
    const p = parameters({ theorem: 3, gamma: [0, 0, 0] });
    const s = sampleCollective(100, p);
    expect(s.targetDistance).toBeLessThan(1e-12);
    expect(collectiveGuarantees(p)).toMatchObject({
      connected: false,
      alignment: true,
      lub: true,
    });
    for (const time of [0, 1, 5, 100])
      expect(
        sampleCollective(time, parameters({ theorem: 3, eta: 0 })),
      ).toEqual(sampleCollective(time, parameters({ theorem: 2 })));
  });

  it("defines the LUB as the least upper bound, not the average", () => {
    const worlds = [
      { x: 0.8, y: 0.2 },
      { x: 0.2, y: 0.8 },
    ];
    expect(lubOf(worlds)).toEqual({ x: 0.8, y: 0.8 });
    const le = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      a.x <= b.x && a.y <= b.y;
    expect(worlds.every((w) => le(w, { x: 0.5, y: 0.5 }))).toBe(false);
    for (const candidate of [
      { x: 0.8, y: 0.8 },
      { x: 0.9, y: 1 },
      { x: 1, y: 1 },
    ]) {
      expect(worlds.every((w) => le(w, candidate))).toBe(true);
      expect(le(lubOf(worlds), candidate)).toBe(true);
    }
  });

  it("replays arbitrary times without history or parameter mutation", () => {
    const p = parameters({ theorem: 3, gamma: [0.2, 1, 0] });
    const snapshot = JSON.stringify(p);
    const first = sampleCollective(1.2345, p);
    for (const time of [12, 0, 3, 100, 0.4]) sampleCollective(time, p);
    expect(sampleCollective(1.2345, p)).toEqual(first);
    expect(sampleCollective(0, p).positions).toEqual(p.initial);
    expect(JSON.stringify(p)).toBe(snapshot);
    expect(() => sampleCollective(NaN, p)).toThrow(RangeError);
    expect(() =>
      sampleCollective(1, parameters({ gamma: [-1, 0, 0] })),
    ).toThrow(RangeError);
    expect(() => sampleCollective(1, parameters({ gamma: [1] }))).toThrow(
      RangeError,
    );
    expect(() => sampleCollective(1, parameters({ theta: -0.1 }))).toThrow(
      RangeError,
    );
  });
});
