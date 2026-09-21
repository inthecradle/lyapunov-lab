/** An explicit educational flow, not a simulation of human cognition. */
export type Vec2 = { x: number; y: number };
export type Dynamics =
  | "normal"
  | "slow"
  | "orbit"
  | "outward"
  | "contained"
  | "inward"
  | "lasalle"
  | "drift";

export type Parameters = {
  theta: number;
  alpha: number;
  extraDecay: number;
  rotation: number;
  stretch: number;
  initial: Vec2;
  dynamics?: Dynamics;
};

export type Sample = {
  time: number;
  point: Vec2;
  value: number;
  /** Signed height V - theta; negative inside the target set. */
  residual: number;
  positiveResidual: number;
  /** Reference envelope; a guaranteed bound only when guarantees().comparison. */
  bound: number;
  derivative: number;
  /** Upper bound on Euclidean distance to the ellipse, not exact distance. */
  distanceBound: number;
};

export const DURATION = 12;

export const DEFAULT_PARAMETERS: Parameters = {
  dynamics: "drift",
  theta: 1,
  alpha: 0.55,
  extraDecay: 0.35,
  rotation: 0.55,
  stretch: 1.5,
  initial: { x: 2.35, y: 1.25 },
};

function assertParameters(params: Parameters): void {
  const { theta, alpha, extraDecay, rotation, stretch, initial } = params;
  if (
    ![theta, alpha, extraDecay, rotation, stretch, initial.x, initial.y].every(
      Number.isFinite,
    ) ||
    theta < 0.25 ||
    alpha <= 0 ||
    extraDecay < 0 ||
    stretch <= 0
  ) {
    throw new RangeError(
      "Use finite parameters with theta >= 0.25, alpha > 0, extraDecay >= 0 and stretch > 0.",
    );
  }
}

export function potential(point: Vec2, params: Parameters): number {
  return point.x * point.x + params.stretch * point.y * point.y;
}

export function dynamicsOf(params: Parameters): Dynamics {
  return params.dynamics ?? "normal";
}

/** Guarantees for every permitted initial state, not inferences from sampled frames.
 * Drift includes prescribed velocity/memory initialization, not arbitrary velocities.
 */
export function guarantees(params: Parameters): {
  comparison: boolean;
  forwardInvariant: boolean;
  convergesToTCZ: boolean;
  lasalle: boolean;
  zeroSet:
    | "tcz"
    | "line"
    | "origin"
    | "all"
    | "none"
    | "origin-and-ellipse"
    | "phase-dependent";
} {
  const dynamics = dynamicsOf(params);
  return {
    comparison: ["normal", "inward", "contained", "drift"].includes(dynamics),
    forwardInvariant: dynamics !== "outward",
    convergesToTCZ:
      ["normal", "slow", "inward", "contained", "drift"].includes(dynamics) ||
      (dynamics === "lasalle" && params.rotation !== 0),
    lasalle: dynamics === "lasalle",
    zeroSet:
      dynamics === "drift"
        ? "phase-dependent"
        : dynamics === "lasalle"
          ? "line"
          : dynamics === "orbit"
            ? "all"
            : dynamics === "inward"
              ? "origin"
              : dynamics === "outward" || dynamics === "contained"
                ? "origin-and-ellipse"
                : "tcz",
  };
}

/** A potential bound for every future frame, including the outward equilibrium. */
export function viewportPotential(params: Parameters): number {
  return Math.max(
    potential(params.initial, params),
    params.theta * (dynamicsOf(params) === "outward" ? 1.6 : 1),
  );
}

/** Timing of the initialized hybrid trajectory: entry into TCZ, then drift. */
export function driftTiming(params: Parameters): {
  entryTime: number;
  driftTime: number;
} {
  assertParameters(params);
  const value = potential(params.initial, params);
  const beta = params.alpha * (1 + params.extraDecay);
  return {
    entryTime: value > params.theta ? Math.log(value / params.theta) / beta : 0,
    driftTime:
      value > 0.36 * params.theta
        ? Math.log(value / (0.36 * params.theta)) / beta
        : 0,
  };
}

/** Position and velocity in a trajectory with remembered drift centre and axes. */
function driftingState(
  time: number,
  params: Parameters,
): { point: Vec2; velocity: Vec2; value: number } {
  const initialValue = potential(params.initial, params);
  if (initialValue === 0)
    return { point: { ...params.initial }, velocity: { x: 0, y: 0 }, value: 0 };
  const beta = params.alpha * (1 + params.extraDecay);
  const w = params.rotation;
  const sqrtStretch = Math.sqrt(params.stretch);
  const initialQ = { x: params.initial.x, y: sqrtStretch * params.initial.y };
  const { entryTime, driftTime } = driftTiming(params);
  const inwardAt = (t: number): Vec2 => {
    const scale = Math.exp((-beta * t) / 2);
    const cos = Math.cos(w * t);
    const sin = Math.sin(w * t);
    return {
      x: scale * (initialQ.x * cos - initialQ.y * sin),
      y: scale * (initialQ.x * sin + initialQ.y * cos),
    };
  };
  const inwardVelocity = (q: Vec2): Vec2 => ({
    x: (-beta * q.x) / 2 - w * q.y,
    y: (-beta * q.y) / 2 + w * q.x,
  });
  let q: Vec2;
  let v: Vec2;
  let value: number;
  if (time < driftTime) {
    q = inwardAt(time);
    v = inwardVelocity(q);
    // Using entryTime as reference makes the represented crossing exact.
    value =
      initialValue > params.theta
        ? params.theta * Math.exp(-beta * (time - entryTime))
        : initialValue * Math.exp(-beta * time);
  } else {
    const q0 = inwardAt(driftTime);
    const v0 = inwardVelocity(q0);
    const frequency = Math.max(
      Math.hypot(v0.x, v0.y) / (0.3 * Math.sqrt(params.theta)),
      0.7,
    );
    const angle = frequency * (time - driftTime);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    q = {
      x: (q0.x * (1 + cos)) / 2 + (v0.x * sin) / frequency,
      y: (q0.y * (1 + cos)) / 2 + (v0.y * sin) / frequency,
    };
    v = {
      x: (-q0.x * frequency * sin) / 2 + v0.x * cos,
      y: (-q0.y * frequency * sin) / 2 + v0.y * cos,
    };
    value = q.x * q.x + q.y * q.y;
  }
  return {
    point:
      time === 0 ? { ...params.initial } : { x: q.x, y: q.y / sqrtStretch },
    velocity: { x: v.x, y: v.y / sqrtStretch },
    value: time === 0 ? initialValue : value,
  };
}

/** Drift velocity depends on elapsed time and remembered initialization. */
export function velocityAt(time: number, params: Parameters): Vec2 {
  assertParameters(params);
  if (!Number.isFinite(time) || time < 0)
    throw new RangeError("Time must be finite and nonnegative.");
  return dynamicsOf(params) === "drift"
    ? driftingState(time, params).velocity
    : field(sampleAt(time, params).point, params);
}

/** Stable matrix exponential for q1'=w*q2, q2'=-w*q1-d*q2. */
function dampedPoint(time: number, params: Parameters): Vec2 {
  const d = params.alpha * (1 + params.extraDecay);
  const w = params.rotation;
  const a = d / 2;
  const q1 = params.initial.x;
  const q2 = Math.sqrt(params.stretch) * params.initial.y;
  if (w === 0) return { x: q1, y: params.initial.y * Math.exp(-d * time) };
  const discriminant = a * a - w * w;
  let c: number;
  let s: number;
  if (discriminant > 0) {
    const frequency = Math.sqrt(discriminant);
    // Evaluate decaying exponentials directly, avoiding exp(-a*t)*cosh(f*t).
    const slow = Math.exp(((-w * w) / (a + frequency)) * time);
    const fast = Math.exp(-(a + frequency) * time);
    c = (slow + fast) / 2;
    s = (slow * -Math.expm1(-2 * frequency * time)) / (2 * frequency);
  } else if (discriminant < 0) {
    const frequency = Math.sqrt(-discriminant);
    const envelope = Math.exp(-a * time);
    c = envelope * Math.cos(frequency * time);
    s = (envelope * Math.sin(frequency * time)) / frequency;
  } else {
    c = Math.exp(-a * time);
    s = time * c;
  }
  return {
    x: c * q1 + s * (a * q1 + w * q2),
    y: (c * q2 + s * (-w * q1 - a * q2)) / Math.sqrt(params.stretch),
  };
}

/**
 * The exact solution in q = (x, sqrt(stretch) y) coordinates.
 * Analytic evaluation avoids time-step drift across the TCZ boundary.
 */
export function sampleAt(time: number, params: Parameters): Sample {
  assertParameters(params);
  if (!Number.isFinite(time) || time < 0)
    throw new RangeError("Time must be finite and nonnegative.");

  const initialValue = potential(params.initial, params);
  const initialResidual = initialValue - params.theta;
  const initialPositive = Math.max(0, initialResidual);
  const beta = params.alpha * (1 + params.extraDecay);
  const dynamics = dynamicsOf(params);
  const decay = dynamics === "slow" ? params.alpha * 0.35 : beta;
  let positiveResidual = initialPositive * Math.exp(-decay * time);
  // Keep the signed residual distinct from its positive part.
  let residual = initialResidual > 0 ? positiveResidual : initialResidual;
  let value = initialResidual > 0 ? params.theta + residual : initialValue;
  let derivative = -decay * positiveResidual;
  let specialPoint: Vec2 | undefined;
  if (dynamics === "drift") {
    const state = driftingState(time, params);
    specialPoint = state.point;
    value = state.value;
    derivative =
      2 *
      (state.point.x * state.velocity.x +
        params.stretch * state.point.y * state.velocity.y);
  } else if (dynamics === "lasalle") {
    specialPoint = dampedPoint(time, params);
    value = potential(specialPoint, params);
    derivative = -2 * beta * params.stretch * specialPoint.y * specialPoint.y;
  } else if (dynamics === "inward") {
    value = initialValue * Math.exp(-beta * time);
    derivative = -beta * value;
  } else if (dynamics === "orbit") {
    value = initialValue;
    derivative = 0;
  } else if (dynamics === "outward" || dynamics === "contained") {
    const capacity = (dynamics === "contained" ? 1 : 1.6) * params.theta;
    const exponential = Math.exp(-beta * time);
    const denominator =
      initialValue * -Math.expm1(-beta * time) + capacity * exponential;
    value = initialValue === 0 ? 0 : (capacity * initialValue) / denominator;
    derivative = beta * value * (1 - value / capacity);
    if (dynamics === "contained") {
      // Preserve the side of the boundary even when V rounds to theta.
      residual =
        initialValue === 0
          ? -params.theta
          : (capacity * initialResidual * exponential) / denominator;
      positiveResidual = Math.max(0, residual);
      value =
        initialResidual < 0
          ? Math.min(params.theta, value)
          : initialResidual > 0
            ? Math.max(params.theta, value)
            : params.theta;
      derivative = (-beta * value * residual) / params.theta;
    }
  }
  if (
    dynamics !== "normal" &&
    dynamics !== "slow" &&
    dynamics !== "contained"
  ) {
    residual = value - params.theta;
    positiveResidual = Math.max(0, residual);
  }
  const scale = initialValue > 0 ? Math.sqrt(value / initialValue) : 0;
  const cos = Math.cos(params.rotation * time);
  const sin = Math.sin(params.rotation * time);
  const sqrtStretch = Math.sqrt(params.stretch);
  const point =
    time === 0 || initialValue === 0
      ? { ...params.initial }
      : (specialPoint ?? {
          x:
            scale *
            (params.initial.x * cos - sqrtStretch * params.initial.y * sin),
          y:
            scale *
            ((params.initial.x * sin) / sqrtStretch + params.initial.y * cos),
        });

  return {
    time,
    point,
    value,
    residual,
    positiveResidual,
    bound: initialPositive * Math.exp(-params.alpha * time),
    derivative,
    distanceBound:
      positiveResidual /
      ((Math.sqrt(value) + Math.sqrt(params.theta)) *
        Math.sqrt(Math.min(1, params.stretch))),
  };
}

/** Locally Lipschitz field: radial decay outside, level-set rotation everywhere. */
export function field(point: Vec2, params: Parameters): Vec2 {
  assertParameters(params);
  if (dynamicsOf(params) === "drift") {
    throw new RangeError(
      "Drift has velocity and memory; use velocityAt(time, params), not a position-only field.",
    );
  }
  const value = potential(point, params);
  const beta = params.alpha * (1 + params.extraDecay);
  const dynamics = dynamicsOf(params);
  const decay = dynamics === "slow" ? params.alpha * 0.35 : beta;
  let radial =
    value > params.theta ? (-decay * (value - params.theta)) / (2 * value) : 0;
  const sqrtStretch = Math.sqrt(params.stretch);
  if (dynamics === "lasalle")
    return {
      x: params.rotation * sqrtStretch * point.y,
      y: (-params.rotation * point.x) / sqrtStretch - beta * point.y,
    };
  if (dynamics === "inward") radial = -beta / 2;
  if (dynamics === "orbit") radial = 0;
  if (dynamics === "outward")
    radial = (beta * (1 - value / (1.6 * params.theta))) / 2;
  if (dynamics === "contained")
    radial = (beta * (1 - value / params.theta)) / 2;
  return {
    x: radial * point.x - params.rotation * sqrtStretch * point.y,
    y: radial * point.y + (params.rotation * point.x) / sqrtStretch,
  };
}

export function potentialDerivative(point: Vec2, params: Parameters): number {
  const velocity = field(point, params);
  return 2 * point.x * velocity.x + 2 * params.stretch * point.y * velocity.y;
}

/** Derivative at (sqrt(theta),0); for LaSalle other boundary points differ. */
export function boundaryDerivative(params: Parameters): number {
  return potentialDerivative({ x: Math.sqrt(params.theta), y: 0 }, params);
}

/** Includes both t=0 and t=DURATION; steps is the number of intervals. */
export function trajectory(params: Parameters, steps = 240): Sample[] {
  if (!Number.isInteger(steps) || steps < 1)
    throw new RangeError("Steps must be a positive integer.");
  return Array.from({ length: steps + 1 }, (_, index) =>
    sampleAt((DURATION * index) / steps, params),
  );
}
