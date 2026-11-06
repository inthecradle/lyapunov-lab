import {
  EDGE_PAIRS,
  lubOf,
  type CollectiveParameters,
  type CollectiveSample,
  type Point,
} from "./collective";
import { conditionalCollectiveCost } from "./collectiveTerrain";

export type CollectiveThreshold =
  | {
      kind: "none";
      center: Point | null;
      radius: null;
      minimum: number;
      coefficient: number;
    }
  | { kind: "all"; center: null; radius: null; minimum: number; coefficient: 0 }
  | {
      kind: "disk";
      center: Point;
      radius: number;
      minimum: number;
      coefficient: number;
    };

/** Exact sublevel set in q with all other positions, personal states and W fixed. */
export function collectiveThreshold(
  p: CollectiveParameters,
  current: CollectiveSample,
  index: number,
): CollectiveThreshold {
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= current.positions.length
  )
    throw new RangeError("Unknown collective agent");
  const abstractionWeight = p.theorem === 3 ? p.eta / 2 : 0;
  const target = lubOf(p.worlds);
  let coefficient = abstractionWeight;
  const numerator = {
    x: abstractionWeight * target.x,
    y: abstractionWeight * target.y,
  };
  EDGE_PAIRS.forEach(([i, j], edge) => {
    if (index !== i && index !== j) return;
    const other = current.positions[index === i ? j : i];
    coefficient += p.gamma[edge];
    numerator.x += p.gamma[edge] * other.x;
    numerator.y += p.gamma[edge] * other.y;
  });
  if (coefficient === 0) {
    return {
      kind: current.total <= p.theta ? "all" : "none",
      center: null,
      radius: null,
      minimum: current.total,
      coefficient: 0,
    };
  }
  const center = { x: numerator.x / coefficient, y: numerator.y / coefficient };
  const minimum = conditionalCollectiveCost(p, current, index, center);
  const excess = p.theta - minimum;
  if (excess < 0)
    return { kind: "none", center, radius: null, minimum, coefficient };
  return {
    kind: "disk",
    center,
    radius: Math.sqrt(excess / coefficient),
    minimum,
    coefficient,
  };
}
