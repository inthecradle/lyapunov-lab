import {
  EDGE_PAIRS,
  lubOf,
  sampleCollective,
  type CollectiveParameters,
  type CollectiveSample,
  type Point,
} from "./collective";
import { componentValleys } from "./sharedValley";

const corners: Point[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

/** T2 running costs: each ordered interaction belongs to its own subject. */
export function collectiveAgentCosts(
  sample: CollectiveSample,
  p: CollectiveParameters,
) {
  const social = sample.positions.map(() => 0);
  EDGE_PAIRS.forEach(([i, j], edge) => {
    const cost = p.gamma[edge] * sample.pairCosts[edge];
    social[i] += cost;
    social[j] += cost;
  });
  return sample.personalCosts.map((personal, index) => ({
    personal,
    social: social[index],
    total: personal + social[index],
  }));
}

/** One envelope across gamma slider settings, not a rescale of each run's costs. */
export function collectiveAgentCostAxisMax(p: CollectiveParameters) {
  const gammaEnvelope = Math.max(2, ...p.gamma);
  const initial = sampleCollective(0, {
    ...p,
    gamma: p.gamma.map(() => gammaEnvelope),
  });
  return (
    Math.ceil(
      Math.max(0.1, p.theta, initial.individual + initial.social) * 1.12 * 100,
    ) / 100
  );
}

/** A fixed surface from the configured initial state, never from the moving agents. */
export function collectivePlaybackTerrain(p: CollectiveParameters) {
  const valleys = componentValleys(p).filter((v) => v.connected);
  const lub = lubOf(p.worlds);
  const abstraction = (q: Point) =>
    (p.eta * ((q.x - lub.x) ** 2 + (q.y - lub.y) ** 2)) / 2;
  const social = (q: Point) => valleys[0]?.value(q) ?? 0;
  // Use the same units and envelope for T2 and T3 with the same settings.
  const extent = Math.max(
    0.01,
    ...corners.flatMap((q) => [social(q), abstraction(q)]),
  );
  const axisMax = Math.ceil(extent * 1.05 * 100) / 100;
  const valueAt = p.theorem === 3 ? abstraction : social;
  const hasValley = p.theorem === 3 ? p.eta > 0 : valleys.length > 0;
  const isolated = (index: number) =>
    p.theorem === 2 && !valleys.some((v) => v.members.includes(index));
  return {
    axisMax,
    coefficient: p.theorem === 3 ? p.eta / 2 : (valleys[0]?.coefficient ?? 0),
    valueAt,
    hasValley,
    center: p.theorem === 3 ? lub : valleys[0]?.center,
    agentValue: (index: number, q: Point) => (isolated(index) ? 0 : valueAt(q)),
    isolated,
    exact: p.theorem === 3 || valleys.every((v) => v.exact),
    label: p.theorem === 3 ? "ηAᵢ" : "Q",
  };
}
