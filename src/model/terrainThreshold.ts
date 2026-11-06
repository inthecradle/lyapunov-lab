import { lubOf, type CollectiveParameters, type Point } from "./collective";
import { componentValleys } from "./sharedValley";

type TerrainThreshold =
  | { kind: "all"; center: null; radius: null }
  | { kind: "disk"; center: Point; radius: number };

/** Static per-field necessary bound, not a slice of the full composite cost. */
export function terrainThreshold(
  p: CollectiveParameters,
  index: number,
): TerrainThreshold {
  const group = componentValleys(p).find((v) => v.members.includes(index));
  if (!group) throw new RangeError("Unknown collective agent");
  const center = p.theorem === 3 ? lubOf(p.worlds) : group.center;
  const coefficient = p.theorem === 3 ? p.eta / 2 : group.coefficient;
  if (coefficient === 0) return { kind: "all", center: null, radius: null };
  return { kind: "disk", center, radius: Math.sqrt(p.theta / coefficient) };
}
