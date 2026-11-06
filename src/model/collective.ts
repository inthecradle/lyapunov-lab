/** Concrete deterministic gradient flow for the paper's cost functions.
 * This is not a computed solution of its argmin optimal-control problem.
 * See docs/collective-mathematics.md.
 */
export type Point = { x: number; y: number };

export type CollectiveParameters = {
  theorem: 2 | 3;
  initial: Point[];
  personalInitial: number[];
  worlds: Point[];
  /** Symmetric coefficients [gamma12=gamma21, gamma13=gamma31, gamma23=gamma32]. */
  gamma: number[];
  /** Cost threshold: theta for theorem 2, theta_A for theorem 3. */
  theta: number;
  eta: number;
};

export type CollectiveSample = {
  time: number;
  positions: Point[];
  personal: number[];
  individual: number;
  social: number;
  abstraction: number;
  total: number;
  derivative: number;
  pairCosts: number[];
  abstractionCosts: number[];
  personalCosts: number[];
  disagreement: number;
  targetDistance: number;
  bound: number;
  residual: number;
  residualBound: number;
  thresholdReached: boolean;
};

export const EDGE_PAIRS: readonly (readonly [number, number])[] = [
  [0, 1],
  [0, 2],
  [1, 2],
];
export const COLLECTIVE_DURATION = 12;
export const DEFAULT_COLLECTIVE: CollectiveParameters = {
  theorem: 2,
  initial: [
    { x: 0.8, y: 0.2 },
    { x: 0.2, y: 0.8 },
    { x: 0.35, y: 0.35 },
  ],
  // Each subject starts inside their personal zero-cost region [-1, 1].
  personalInitial: [0.8, -0.6, 0.5],
  worlds: [
    { x: 0.8, y: 0.2 },
    { x: 0.2, y: 0.8 },
    { x: 0.35, y: 0.35 },
  ],
  gamma: [0.8, 0.8, 0.8],
  theta: 0.1,
  eta: 0.8,
};

const clip = (value: number) => Math.max(-1, Math.min(1, value));
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const squaredDistance = (a: Point, b: Point) =>
  (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const etaOf = (p: CollectiveParameters) => (p.theorem === 3 ? p.eta : 0);

/** Product order: a <= b iff a.x <= b.x and a.y <= b.y. */
export function lubOf(worlds: Point[]): Point {
  if (
    !worlds.length ||
    worlds.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))
  )
    throw new RangeError("LUB requires nonempty finite worlds");
  return {
    x: Math.max(...worlds.map((p) => p.x)),
    y: Math.max(...worlds.map((p) => p.y)),
  };
}

function validate(p: CollectiveParameters) {
  if (p.theorem !== 2 && p.theorem !== 3)
    throw new RangeError("Unknown theorem");
  if (
    [p.initial, p.worlds, p.personalInitial, p.gamma].some(
      (a) => a.length !== 3,
    )
  )
    throw new RangeError(
      "The collective model requires three agents and three edge weights",
    );
  if (
    [...p.initial, ...p.worlds].some((z) =>
      [z.x, z.y].some((v) => !Number.isFinite(v) || v < 0 || v > 1),
    )
  )
    throw new RangeError("Representation coordinates must lie in [0, 1]");
  if (
    p.personalInitial.some((v) => !Number.isFinite(v)) ||
    [...p.gamma, p.theta, p.eta].some((v) => !Number.isFinite(v) || v < 0)
  )
    throw new RangeError("Parameters must be finite and weights nonnegative");
}

/** Exact mean mode plus a symmetric 2x2 eigendecomposition on its orthogonal complement. */
function modes(p: CollectiveParameters) {
  const [w01, w02, w12] = p.gamma;
  const a = 2 * w01 + (w02 + w12) / 2;
  const d = 1.5 * (w02 + w12);
  const b = (Math.sqrt(3) * (w02 - w12)) / 2;
  const angle = Math.atan2(2 * b, a - d) / 2;
  const c = Math.cos(angle),
    s = Math.sin(angle);
  const u = [1 / Math.sqrt(2), -1 / Math.sqrt(2), 0];
  const v = [1 / Math.sqrt(6), 1 / Math.sqrt(6), -2 / Math.sqrt(6)];
  const largest = (a + d + Math.hypot(a - d, 2 * b)) / 2;
  // Product of the two nontrivial eigenvalues; avoids subtractive cancellation.
  const smallest =
    largest === 0 ? 0 : (3 * (w01 * w02 + w01 * w12 + w02 * w12)) / largest;
  const shift = etaOf(p);
  return [
    { vector: [1, 1, 1].map(() => 1 / Math.sqrt(3)), rate: shift },
    {
      vector: u.map((x, i) => c * x + s * v[i]),
      rate: 2 * largest + shift,
    },
    {
      vector: u.map((x, i) => -s * x + c * v[i]),
      rate: 2 * smallest + shift,
    },
  ];
}

export function collectiveGuarantees(p: CollectiveParameters): {
  connected: boolean;
  alignment: boolean;
  lub: boolean;
  decayRate: number;
  reason: string;
} {
  validate(p);
  // With three vertices, any two distinct positive edges connect the graph.
  const connected = p.gamma.filter((w) => w > 0).length >= 2;
  const lub = etaOf(p) > 0;
  const alignment = lub || connected;
  const rates = modes(p)
    .map((m) => m.rate)
    .filter((rate) => rate > 0);
  const decayRate = 2 * Math.min(1, ...rates);
  const result = lub
    ? "この具体モデルでは、全員に同じ既知LUBへの正の引力が働くためLUBへ収束します。"
    : alignment
      ? "この具体モデルでは、正の結合が全員をつなぐため共有表象は一致します。到達先がLUBとは限りません。"
      : "この具体モデルでは、分断された主体・集団の間に不一致が残り得ます。評価の減少だけでは全員の一致を保証しません。";
  const reason =
    result +
    (connected
      ? "原典の最適方策や他の仮定を数値的に解いた結果ではありません。"
      : "この設定は原典の連結性仮定を外す比較実験です。");
  return { connected, alignment, lub, decayRate, reason };
}

function costs(
  positions: Point[],
  personal: number[],
  p: CollectiveParameters,
) {
  const target = lubOf(p.worlds);
  // V_i = 1/2 dist(r_i, [-1,1])² in this concrete realization.
  const personalCosts = personal.map((r) => (r - clip(r)) ** 2 / 2);
  const pairCosts = EDGE_PAIRS.map(
    ([i, j]) => squaredDistance(positions[i], positions[j]) / 2,
  );
  const abstractionCosts = positions.map((z) => squaredDistance(z, target) / 2);
  const individual = sum(personalCosts);
  // The paper sums over ordered (i,j): both gamma_ij S_ij and gamma_ji S_ji.
  const social = 2 * sum(pairCosts.map((s, i) => s * p.gamma[i]));
  const abstraction = etaOf(p) * sum(abstractionCosts);
  return {
    personalCosts,
    pairCosts,
    abstractionCosts,
    individual,
    social,
    abstraction,
    total: individual + social + abstraction,
  };
}

/** Direct evaluation from initial conditions: seeking never accumulates integration error. */
export function sampleCollective(
  time: number,
  p: CollectiveParameters,
): CollectiveSample {
  validate(p);
  if (!Number.isFinite(time)) throw new RangeError("Time must be finite");
  const t = Math.max(0, time);
  const target = lubOf(p.worlds);
  const personal = p.personalInitial.map(
    (r) => clip(r) + (r - clip(r)) * Math.exp(-t),
  );
  const positions = p.initial.map((z) => ({ ...z }));
  if (t > 0) {
    const spectrum = modes(p);
    for (const axis of ["x", "y"] as const) {
      const values = spectrum.map(({ vector, rate }) => {
        const initial = sum(vector.map((q, i) => q * p.initial[i][axis]));
        const forcing = sum(vector.map((q) => q * etaOf(p) * target[axis]));
        return rate === 0
          ? initial
          : Math.exp(-rate * t) * initial +
              (-Math.expm1(-rate * t) / rate) * forcing;
      });
      positions.forEach((z, i) => {
        z[axis] = sum(spectrum.map((m, j) => m.vector[i] * values[j]));
      });
    }
  }
  const values = costs(positions, personal, p);
  const gradients = positions.map((z) => ({
    x: etaOf(p) * (z.x - target.x),
    y: etaOf(p) * (z.y - target.y),
  }));
  EDGE_PAIRS.forEach(([i, j], edge) => {
    for (const axis of ["x", "y"] as const) {
      const force =
        2 * p.gamma[edge] * (positions[i][axis] - positions[j][axis]);
      gradients[i][axis] += force;
      gradients[j][axis] -= force;
    }
  });
  const derivative =
    -sum(personal.map((r) => (r - clip(r)) ** 2)) -
    sum(gradients.map((g) => g.x ** 2 + g.y ** 2));
  const { decayRate } = collectiveGuarantees(p);
  const initialResidual = Math.max(
    costs(p.initial, p.personalInitial, p).total - p.theta,
    0,
  );
  const residualBound = initialResidual * Math.exp(-decayRate * t);
  return {
    time: t,
    positions,
    personal,
    ...values,
    derivative,
    disagreement: Math.sqrt(2 * Math.max(...values.pairCosts)),
    targetDistance: Math.sqrt(2 * Math.max(...values.abstractionCosts)),
    bound: p.theta + residualBound,
    residual: Math.max(values.total - p.theta, 0),
    residualBound,
    thresholdReached: values.total <= p.theta,
  };
}
