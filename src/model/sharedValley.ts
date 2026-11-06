import {
  EDGE_PAIRS,
  type CollectiveParameters,
  type Point,
} from "./collective";

/**
 * A display of the social cost on theorem 2's conserved-mean subspace.
 *
 * With L_gamma the weighted graph Laplacian and m the initial mean,
 * social = sum_ij gamma_ij S_ij >= lambda_2(L_gamma) sum_i |z_i - m|².
 * Equality holds for the complete three-agent graph with equal weights.
 * This display does not add a cost or change the simulated vector field.
 */
export function sharedValley(p: CollectiveParameters): {
  center: Point;
  coefficient: number;
  exact: boolean;
  connected: boolean;
  value: (point: Point) => number;
} {
  const center = {
    x: p.initial.reduce((sum, point) => sum + point.x, 0) / 3,
    y: p.initial.reduce((sum, point) => sum + point.y, 0) / 3,
  };
  const connected = p.gamma.filter((weight) => weight > 0).length >= 2;
  const exact = p.gamma.every((weight) => weight === p.gamma[0]);
  const scale = Math.max(...p.gamma);
  let coefficient = 0;
  if (connected) {
    // Normalize first so uniformly tiny weights do not underflow when squared.
    const [a, b, c] = p.gamma.map((weight) => weight / scale);
    const largest = a + b + c + Math.hypot(a - b, a - c, b - c) / Math.SQRT2;
    // lambda_2 * lambda_max = 3(ab + ac + bc); no subtraction of near equals.
    coefficient = scale * ((3 * (a * b + a * c + b * c)) / largest);
  }
  return {
    center,
    coefficient,
    exact,
    connected,
    value: (point) =>
      coefficient * ((point.x - center.x) ** 2 + (point.y - center.y) ** 2),
  };
}

/** Each coupled component has its own conserved mean; isolated agents stay flat. */
export function componentValleys(
  p: CollectiveParameters,
): (ReturnType<typeof sharedValley> & { members: number[] })[] {
  const remaining = new Set([0, 1, 2]);
  const groups: number[][] = [];
  while (remaining.size) {
    const first = remaining.values().next().value!;
    const members = [first];
    remaining.delete(first);
    for (let at = 0; at < members.length; at++) {
      EDGE_PAIRS.forEach(([i, j], edge) => {
        if (p.gamma[edge] <= 0) return;
        const other = members[at] === i ? j : members[at] === j ? i : -1;
        if (remaining.delete(other)) members.push(other);
      });
    }
    groups.push(members.sort((a, b) => a - b));
  }
  return groups.map((members) => {
    if (members.length === 3) return { ...sharedValley(p), members };
    const center = {
      x:
        members.reduce((sum, index) => sum + p.initial[index].x, 0) /
        members.length,
      y:
        members.reduce((sum, index) => sum + p.initial[index].y, 0) /
        members.length,
    };
    const edge = EDGE_PAIRS.findIndex(
      ([i, j]) => members.includes(i) && members.includes(j),
    );
    const coefficient = edge === -1 ? 0 : 2 * p.gamma[edge];
    return {
      members,
      center,
      coefficient,
      exact: true,
      connected: members.length > 1,
      value: (point: Point) =>
        coefficient * ((point.x - center.x) ** 2 + (point.y - center.y) ** 2),
    };
  });
}
