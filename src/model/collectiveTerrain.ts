import {
  EDGE_PAIRS,
  lubOf,
  type CollectiveParameters,
  type CollectiveSample,
  type Point,
} from "./collective";

const pairCost = (a: Point, b: Point) =>
  ((a.x - b.x) ** 2 + (a.y - b.y) ** 2) / 2;

/**
 * A two-coordinate slice of the existing collective cost: move one agent's
 * representation to probe while fixing the others and all personal states.
 * This introduces no extra state coordinate or cost term.
 */
export function conditionalCollectiveCost(
  p: CollectiveParameters,
  current: CollectiveSample,
  index: number,
  probe: Point,
): number {
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= current.positions.length
  )
    throw new RangeError("Unknown collective agent");
  if (!Number.isFinite(probe.x) || !Number.isFinite(probe.y))
    throw new RangeError("Terrain coordinates must be finite");

  let total = current.total;
  EDGE_PAIRS.forEach(([i, j], edge) => {
    if (index !== i && index !== j) return;
    const other = current.positions[index === i ? j : i];
    // Both ordered terms gamma_ij S_ij and gamma_ji S_ji change.
    total +=
      2 * p.gamma[edge] * (pairCost(probe, other) - current.pairCosts[edge]);
  });
  if (p.theorem === 3)
    total +=
      p.eta *
      (pairCost(probe, lubOf(p.worlds)) - current.abstractionCosts[index]);

  // Subtraction of the old costs may leave roundoff just below zero.
  return Math.max(0, total);
}
