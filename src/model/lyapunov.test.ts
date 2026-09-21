import { describe, expect, it } from "vitest";
import {
  DEFAULT_PARAMETERS,
  boundaryDerivative,
  guarantees,
  dynamicsOf,
  driftTiming,
  velocityAt,
  viewportPotential,
  DURATION,
  field,
  potential,
  sampleAt,
  trajectory,
  type Parameters,
  type Dynamics,
} from "./lyapunov";

const parameters = (overrides: Partial<Parameters> = {}): Parameters => ({
  ...DEFAULT_PARAMETERS,
  dynamics: "normal",
  ...overrides,
});

describe("finite entry and internal drift", () => {
  const driftParams = (overrides: Partial<Parameters> = {}) =>
    parameters({ dynamics: "drift", ...overrides });

  it("defaults the application to drift while preserving the unspecified-dynamics contract", () => {
    expect(DEFAULT_PARAMETERS.dynamics).toBe("drift");
    expect(dynamicsOf(parameters({ dynamics: undefined }))).toBe("normal");
    expect(guarantees(DEFAULT_PARAMETERS)).toMatchObject({
      comparison: true,
      forwardInvariant: true,
      convergesToTCZ: true,
      zeroSet: "phase-dependent",
    });
  });

  it("reaches the TCZ boundary in finite time and starts internal drift later", () => {
    const params = driftParams();
    const { entryTime, driftTime } = driftTiming(params);
    expect(entryTime).toBeGreaterThan(0);
    expect(driftTime).toBeGreaterThan(entryTime);
    expect(sampleAt(entryTime, params).value).toBe(params.theta);
    expect(sampleAt(entryTime, params).positiveResidual).toBe(0);
    expect(sampleAt(entryTime - 1e-5, params).residual).toBeGreaterThan(0);
    expect(sampleAt(entryTime + 1e-5, params).residual).toBeLessThan(0);
    expect(sampleAt(driftTime, params).value).toBeCloseTo(
      0.36 * params.theta,
      12,
    );
  });

  it("preserves position and velocity across boundary entry and the drift switch", () => {
    const h = 1e-6;
    for (const rotation of [0, 0.55, -1.2]) {
      const params = driftParams({ rotation, stretch: 0.4 });
      const timing = driftTiming(params);
      for (const eventTime of [timing.entryTime, timing.driftTime]) {
        const before = sampleAt(eventTime - h, params).point;
        const current = sampleAt(eventTime, params).point;
        const after = sampleAt(eventTime + h, params).point;
        const velocity = velocityAt(eventTime, params);
        expect((current.x - before.x) / h).toBeCloseTo(velocity.x, 4);
        expect((current.y - before.y) / h).toBeCloseTo(velocity.y, 4);
        expect((after.x - current.x) / h).toBeCloseTo(velocity.x, 4);
        expect((after.y - current.y) / h).toBeCloseTo(velocity.y, 4);
        expect(velocityAt(eventTime - h, params).x).toBeCloseTo(velocity.x, 4);
        expect(velocityAt(eventTime + h, params).y).toBeCloseTo(velocity.y, 4);
      }
    }
  });

  it("keeps initialized inside states in the TCZ and all drifting phases inside a smaller ellipse", () => {
    for (const theta of [0.25, 1, 3]) {
      for (const stretch of [0.4, 3]) {
        for (const rotation of [0, 1.3]) {
          for (const alpha of [0.2, 2]) {
            for (const radius of [0.2, 0.6, 0.9, 1, 2.5]) {
              const params = driftParams({
                theta,
                stretch,
                rotation,
                alpha,
                initial: { x: radius * Math.sqrt(theta), y: 0 },
              });
              const { entryTime, driftTime } = driftTiming(params);
              if (radius <= 1) expect(entryTime).toBe(0);
              if (radius <= 0.6) expect(driftTime).toBeCloseTo(0, 12);
              for (let i = 0; i <= 80; i++) {
                const time = driftTime + i * 0.417;
                const sample = sampleAt(time, params);
                expect(sample.value).toBeLessThanOrEqual(
                  0.725 ** 2 * theta + 1e-12,
                );
                expect(sample.positiveResidual).toBe(0);
                expect(sample.distanceBound).toBe(0);
              }
              for (const time of [
                entryTime,
                (entryTime + driftTime) / 2,
                10000,
              ]) {
                expect(sampleAt(time, params).value).toBeLessThanOrEqual(
                  theta + 1e-12,
                );
              }
            }
          }
        }
      }
    }
  });

  it("has increasing and decreasing potential during drift, including zero rotation", () => {
    for (const rotation of [0, 0.55]) {
      const params = driftParams({ rotation });
      const { driftTime } = driftTiming(params);
      const slopes = Array.from(
        { length: 240 },
        (_, i) => sampleAt(driftTime + i * 0.05, params).derivative,
      );
      expect(Math.max(...slopes)).toBeGreaterThan(0.01);
      expect(Math.min(...slopes)).toBeLessThan(-0.01);
    }
  });

  it("matches timed velocity and potential derivatives with finite differences", () => {
    const h = 1e-5;
    for (const initial of [
      { x: 2.35, y: 1.25 },
      { x: 0.2, y: -0.1 },
      { x: 0.8, y: 0 },
    ]) {
      const params = driftParams({ initial });
      const { driftTime } = driftTiming(params);
      for (const time of [0.1, 1, driftTime + 0.1, driftTime + 2]) {
        const before = sampleAt(time - h, params);
        const current = sampleAt(time, params);
        const after = sampleAt(time + h, params);
        const velocity = velocityAt(time, params);
        expect((after.point.x - before.point.x) / (2 * h)).toBeCloseTo(
          velocity.x,
          7,
        );
        expect((after.point.y - before.point.y) / (2 * h)).toBeCloseTo(
          velocity.y,
          7,
        );
        expect((after.value - before.value) / (2 * h)).toBeCloseTo(
          current.derivative,
          7,
        );
        expect(potential(current.point, params)).toBeCloseTo(current.value, 11);
      }
      expect(sampleAt(0, params).point).toEqual(initial);
    }
  });

  it("satisfies the exterior comparison condition and the global positive-part envelope", () => {
    for (const theta of [0.25, 3]) {
      for (const alpha of [0.2, 2]) {
        for (const extraDecay of [0, 1]) {
          const params = driftParams({ theta, alpha, extraDecay });
          for (const sample of trajectory(params)) {
            expect(sample.positiveResidual).toBeLessThanOrEqual(
              sample.bound + 1e-12,
            );
            if (sample.residual > 0)
              expect(sample.derivative).toBeLessThanOrEqual(
                -alpha * sample.residual + 1e-12,
              );
          }
        }
      }
    }
  });

  it("keeps an origin initialization stationary and rejects a position-only field", () => {
    const params = driftParams({ initial: { x: 0, y: 0 } });
    expect(driftTiming(params)).toEqual({ entryTime: 0, driftTime: 0 });
    for (const time of [0, 1, 10000]) {
      expect(sampleAt(time, params).point).toEqual(params.initial);
      expect(sampleAt(time, params).value).toBe(0);
      expect(velocityAt(time, params)).toEqual({ x: 0, y: 0 });
    }
    expect(() => field({ x: 1, y: 0 }, params)).toThrow(/velocityAt/);
  });
});

describe("alternative stability fields", () => {
  const alternatives: Dynamics[] = [
    "normal",
    "slow",
    "orbit",
    "inward",
    "outward",
    "contained",
    "lasalle",
  ];

  it("matches independent finite differences for every field and bounds future potential", () => {
    const h = 1e-5;
    for (const dynamics of alternatives) {
      for (const stretch of [0.4, 2.5]) {
        for (const initial of [
          { x: 0.2, y: 0.15 },
          { x: 2.2, y: -1.1 },
        ]) {
          const params = parameters({ dynamics, stretch, initial });
          expect(sampleAt(0, params).point).toEqual(initial);
          for (const time of [0.1, 2, 8]) {
            const before = sampleAt(time - h, params);
            const current = sampleAt(time, params);
            const after = sampleAt(time + h, params);
            const velocity = field(current.point, params);
            expect((after.point.x - before.point.x) / (2 * h)).toBeCloseTo(
              velocity.x,
              7,
            );
            expect((after.point.y - before.point.y) / (2 * h)).toBeCloseTo(
              velocity.y,
              7,
            );
            expect(
              (potential(after.point, params) -
                potential(before.point, params)) /
                (2 * h),
            ).toBeCloseTo(current.derivative, 7);
            expect(potential(current.point, params)).toBeCloseTo(
              current.value,
              10,
            );
            expect(current.value).toBeLessThanOrEqual(
              viewportPotential(params) + 1e-10,
            );
          }
        }
      }
    }
  });

  it("demonstrates failed alpha-comparison without falsely ruling out convergence", () => {
    const params = parameters({ dynamics: "slow" });
    const sample = sampleAt(2, params);
    expect(sample.positiveResidual).toBeGreaterThan(sample.bound);
    expect(sample.derivative).toBeGreaterThan(-params.alpha * sample.residual);
    expect(sampleAt(1000, params).distanceBound).toBeLessThan(1e-50);
    expect(guarantees(params)).toMatchObject({
      comparison: false,
      convergesToTCZ: true,
    });
  });

  it("keeps a pure orbit outside without approaching the TCZ", () => {
    const params = parameters({ dynamics: "orbit" });
    expect(sampleAt(100, params).value).toBeCloseTo(
      potential(params.initial, params),
      12,
    );
    expect(sampleAt(100, params).positiveResidual).toBeGreaterThan(0);
    expect(guarantees(params)).toMatchObject({
      comparison: false,
      convergesToTCZ: false,
      forwardInvariant: true,
      zeroSet: "all",
    });
  });

  it("crosses into the TCZ in finite time under inward contraction while satisfying comparison", () => {
    const params = parameters({ dynamics: "inward" });
    const entry =
      Math.log(potential(params.initial, params) / params.theta) /
      (params.alpha * (1 + params.extraDecay));
    expect(sampleAt(entry - 0.01, params).residual).toBeGreaterThan(0);
    expect(sampleAt(entry + 0.01, params).residual).toBeLessThan(0);
    for (const sample of trajectory(params))
      expect(sample.positiveResidual).toBeLessThanOrEqual(sample.bound + 1e-12);
    expect(boundaryDerivative(params)).toBeLessThan(0);
  });

  it("breaks boundary invariance and sends nonzero inside states toward an outside equilibrium", () => {
    const params = parameters({
      dynamics: "outward",
      initial: { x: 0.5, y: 0 },
    });
    expect(boundaryDerivative(params)).toBeGreaterThan(0);
    expect(sampleAt(12, params).residual).toBeGreaterThan(0);
    expect(sampleAt(100, params).value).toBeCloseTo(params.theta * 1.6, 12);
    expect(guarantees(params)).toMatchObject({
      forwardInvariant: false,
      convergesToTCZ: false,
      zeroSet: "origin-and-ellipse",
    });
    const atOrigin = parameters({
      dynamics: "outward",
      initial: { x: 0, y: 0 },
    });
    expect(sampleAt(100, atOrigin).point).toEqual({ x: 0, y: 0 });
  });

  it("preserves the TCZ for all fields with the forward-invariance guarantee", () => {
    for (const dynamics of alternatives.filter((item) => item !== "outward")) {
      const params = parameters({
        dynamics,
        initial: { x: 1, y: 0 },
        theta: 1,
      });
      expect(guarantees(params).forwardInvariant).toBe(true);
      for (const sample of trajectory(params))
        expect(sample.value).toBeLessThanOrEqual(1 + 1e-12);
    }
  });

  it("evaluates damped matrix exponentials in underdamped, critical, overdamped and zero-coupling regimes", () => {
    const h = 1e-5;
    // d=2: critical at omega=1, overdamped below, underdamped above.
    for (const rotation of [0, 0.1, 0.99999999, 1, 1.00000001, 3, -3]) {
      const params = parameters({
        dynamics: "lasalle",
        alpha: 2,
        extraDecay: 0,
        rotation,
      });
      for (const time of [0.1, 1, 10]) {
        const before = sampleAt(time - h, params);
        const current = sampleAt(time, params);
        const after = sampleAt(time + h, params);
        const velocity = field(current.point, params);
        expect((after.point.x - before.point.x) / (2 * h)).toBeCloseTo(
          velocity.x,
          7,
        );
        expect((after.point.y - before.point.y) / (2 * h)).toBeCloseTo(
          velocity.y,
          7,
        );
        expect(current.derivative).toBeLessThanOrEqual(0);
      }
      const distant = sampleAt(10000, params);
      expect(Number.isFinite(distant.value)).toBe(true);
      if (rotation !== 0) expect(distant.value).toBeLessThan(1e-30);
    }
  });

  it("distinguishes the zero-derivative line from its largest invariant subset", () => {
    const coupled = parameters({
      dynamics: "lasalle",
      initial: { x: 2, y: 0 },
      rotation: 0.8,
    });
    expect(Math.abs(sampleAt(0, coupled).derivative)).toBe(0);
    expect(field(coupled.initial, coupled).y).not.toBe(0);
    expect(sampleAt(0.5, coupled).derivative).toBeLessThan(0);
    expect(sampleAt(100, coupled).value).toBeLessThan(1e-20);
    expect(guarantees(coupled)).toMatchObject({
      lasalle: true,
      zeroSet: "line",
      convergesToTCZ: true,
      comparison: false,
    });
    const uncoupled = { ...coupled, rotation: 0 };
    expect(sampleAt(100, uncoupled).point).toEqual(uncoupled.initial);
    expect(guarantees(uncoupled).convergesToTCZ).toBe(false);
  });
});

describe("contained outward flow", () => {
  it("increases positive inside potential without ever exceeding theta", () => {
    for (const theta of [0.25, 1, 3]) {
      for (const alpha of [0.2, 2]) {
        for (const extraDecay of [0, 1]) {
          for (const stretch of [0.4, 1, 3]) {
            const params = parameters({
              dynamics: "contained",
              theta,
              alpha,
              extraDecay,
              stretch,
              initial: {
                x: 0.4 * Math.sqrt(theta),
                y: 0.3 * Math.sqrt(theta / stretch),
              },
            });
            let previous = potential(params.initial, params);
            for (const time of [0, 0.1, 2, 12, 100, 10000]) {
              const sample = sampleAt(time, params);
              expect(sample.value).toBeGreaterThanOrEqual(previous - 1e-12);
              expect(sample.value).toBeLessThanOrEqual(theta);
              expect(sample.residual).toBeLessThanOrEqual(0);
              expect(sample.positiveResidual).toBe(0);
              expect(sample.derivative).toBeGreaterThanOrEqual(0);
              expect(sample.distanceBound).toBe(0);
              previous = sample.value;
            }
            expect(sampleAt(10000, params).value).toBe(theta);
          }
        }
      }
    }
  });

  it("preserves boundary trajectories and the origin", () => {
    for (const stretch of [0.4, 1, 3]) {
      const params = parameters({
        dynamics: "contained",
        stretch,
        initial: { x: 1, y: 0 },
        theta: 1,
      });
      for (const time of [0, 1, 12, 10000]) {
        const sample = sampleAt(time, params);
        expect(sample.value).toBe(1);
        expect(potential(sample.point, params)).toBeCloseTo(1, 12);
        expect(Math.abs(sample.derivative)).toBe(0);
      }
      expect(Math.abs(boundaryDerivative(params))).toBe(0);
      const origin = { ...params, initial: { x: 0, y: 0 } };
      expect(field(origin.initial, origin)).toEqual({ x: 0, y: 0 });
      expect(sampleAt(10000, origin).value).toBe(0);
      expect(sampleAt(10000, origin).point).toEqual({ x: 0, y: 0 });
    }
  });

  it("satisfies the outside exponential bound and remains outside at finite times", () => {
    for (const theta of [0.25, 3]) {
      for (const alpha of [0.2, 2]) {
        for (const extraDecay of [0, 1]) {
          const params = parameters({
            dynamics: "contained",
            theta,
            alpha,
            extraDecay,
          });
          for (const sample of trajectory(params)) {
            expect(sample.residual).toBeGreaterThan(0);
            expect(sample.derivative).toBeLessThanOrEqual(
              -alpha * sample.residual + 1e-12,
            );
            expect(sample.positiveResidual).toBeLessThanOrEqual(
              sample.bound + 1e-12,
            );
          }
          expect(guarantees(params)).toMatchObject({
            comparison: true,
            forwardInvariant: true,
            convergesToTCZ: true,
            zeroSet: "origin-and-ellipse",
          });
        }
      }
    }
  });

  it("retains tiny positive interior potential instead of cancelling it against theta", () => {
    const params = parameters({
      dynamics: "contained",
      initial: { x: 1e-10, y: 0 },
    });
    expect(sampleAt(0, params).value).toBeGreaterThan(0);
    expect(sampleAt(1, params).value).toBeGreaterThan(
      sampleAt(0, params).value,
    );
  });
});

describe("educational Lyapunov flow", () => {
  it("preserves the requested initial position and produces both timeline endpoints", () => {
    const params = parameters({ initial: { x: -1.7, y: 2.6 } });
    expect(sampleAt(0, params).point).toEqual(params.initial);
    const samples = trajectory(params, 40);
    expect(samples).toHaveLength(41);
    expect(samples[0].time).toBe(0);
    expect(samples[40].time).toBe(DURATION);
  });

  it("matches the velocity field and potential derivative with independent finite differences", () => {
    const h = 1e-5;
    for (const stretch of [0.4, 1, 3]) {
      for (const rotation of [-0.8, 0, 1.2]) {
        const params = parameters({ stretch, rotation });
        for (const time of [0.1, 1, 5]) {
          const before = sampleAt(time - h, params);
          const current = sampleAt(time, params);
          const after = sampleAt(time + h, params);
          const velocity = field(current.point, params);
          expect((after.point.x - before.point.x) / (2 * h)).toBeCloseTo(
            velocity.x,
            7,
          );
          expect((after.point.y - before.point.y) / (2 * h)).toBeCloseTo(
            velocity.y,
            7,
          );
          const derivative =
            (potential(after.point, params) - potential(before.point, params)) /
            (2 * h);
          expect(derivative).toBeCloseTo(current.derivative, 7);
          expect(potential(current.point, params)).toBeCloseTo(
            current.value,
            11,
          );
        }
      }
    }
  });

  it("satisfies the advertised decay inequality and exponential bound across parameter combinations", () => {
    for (const theta of [0.25, 1, 3]) {
      for (const alpha of [0.2, 0.8, 2]) {
        for (const extraDecay of [0, 0.4, 1]) {
          for (const stretch of [0.5, 1, 2.5]) {
            const params = parameters({ theta, alpha, extraDecay, stretch });
            for (const sample of trajectory(params, 24)) {
              expect(sample.positiveResidual).toBeGreaterThanOrEqual(0);
              expect(sample.positiveResidual).toBeLessThanOrEqual(
                sample.bound + 1e-12,
              );
              expect(sample.derivative).toBeLessThanOrEqual(
                -alpha * sample.positiveResidual + 1e-12,
              );
            }
          }
        }
      }
    }
  });

  it("allows actual decay to coincide with, or be faster than, the comparison envelope", () => {
    const exact = sampleAt(2, parameters({ extraDecay: 0 }));
    expect(exact.positiveResidual).toBeCloseTo(exact.bound, 12);
    const faster = sampleAt(2, parameters({ extraDecay: 0.5 }));
    expect(faster.positiveResidual).toBeLessThan(faster.bound);
  });

  it("keeps inside and boundary initial states in the ellipse without replacing negative residuals by zero", () => {
    for (const initial of [
      { x: 0, y: 0 },
      { x: 0.3, y: 0.2 },
      { x: 1, y: 0 },
    ]) {
      const params = parameters({ theta: 1, stretch: 2, initial });
      const initialValue = potential(initial, params);
      for (const time of [0, 0.5, 4, 100]) {
        const sample = sampleAt(time, params);
        expect(potential(sample.point, params)).toBeCloseTo(initialValue, 12);
        expect(sample.residual).toBeCloseTo(initialValue - params.theta, 12);
        expect(sample.positiveResidual).toBe(0);
        expect(sample.bound).toBe(0);
        expect(sample.distanceBound).toBe(0);
        expect(Math.abs(sample.derivative)).toBe(0);
      }
    }
    expect(field({ x: 0, y: 0 }, parameters())).toEqual({ x: 0, y: 0 });
  });

  it("rotates along a noncircular level set, rather than treating the TCZ as a circle", () => {
    const params = parameters({
      theta: 1,
      stretch: 4,
      initial: { x: 1, y: 0 },
      rotation: 1,
    });
    const sample = sampleAt(Math.PI / 2, params);
    expect(sample.point.x).toBeCloseTo(0, 12);
    expect(sample.point.y).toBeCloseTo(0.5, 12);
    expect(sample.value).toBeCloseTo(1, 12);
  });

  it("bounds the distance to an explicit boundary point and converges without finite-time entry", () => {
    for (const stretch of [0.4, 1, 3]) {
      const params = parameters({ stretch });
      for (const time of [0, 2, 12]) {
        const sample = sampleAt(time, params);
        const factor = Math.sqrt(params.theta / sample.value);
        const boundary = {
          x: factor * sample.point.x,
          y: factor * sample.point.y,
        };
        expect(potential(boundary, params)).toBeCloseTo(params.theta, 12);
        const distanceToBoundaryPoint = Math.hypot(
          sample.point.x - boundary.x,
          sample.point.y - boundary.y,
        );
        expect(distanceToBoundaryPoint).toBeLessThanOrEqual(
          sample.distanceBound + 1e-12,
        );
        expect(sample.residual).toBeGreaterThan(0);
      }
      expect(sampleAt(100, params).distanceBound).toBeLessThan(1e-25);
    }
  });

  it("rejects parameters that invalidate the stated mathematical guarantees", () => {
    for (const override of [
      { theta: 0 },
      { alpha: 0 },
      { stretch: 0 },
      { extraDecay: -1 },
      { rotation: NaN },
    ]) {
      expect(() => sampleAt(1, parameters(override))).toThrow(RangeError);
    }
    expect(() => sampleAt(-1, DEFAULT_PARAMETERS)).toThrow(RangeError);
    expect(() => trajectory(DEFAULT_PARAMETERS, 0)).toThrow(RangeError);
  });
});
