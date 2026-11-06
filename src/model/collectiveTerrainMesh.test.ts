import { describe, expect, it, vi } from "vitest";
import { collectiveTerrainMesh } from "./collectiveTerrainMesh";
import { morphValleys } from "./collectiveIntro";
import { sharedTerrainProjection } from "./sharedTerrainProjection";

const center = { x: 0.5, y: 0.5 };
const coefficient = 0.5;
const camera = {
  center,
  radius: 1,
  coefficient,
  flat: false,
  yaw: -28,
  elevation: 28,
};
const view = sharedTerrainProjection(camera);
const valueAt = (q: typeof center) =>
  coefficient * ((q.x - center.x) ** 2 + (q.y - center.y) ** 2);
const options = { center, radius: 1, view, valueAt, flat: false };
const initial = [
  { x: 0.8, y: 0.2 },
  { x: 0.2, y: 0.8 },
  { x: 0.35, y: 0.35 },
];
const target = {
  center,
  radius: Math.sqrt((0.85 * view.maxV) / coefficient),
  members: [0, 1, 2],
};

describe("shared collective display mesh", () => {
  it("evaluates shared vertices once and sorts all patches by depth", () => {
    const cost = vi.fn(valueAt);
    const mesh = collectiveTerrainMesh({ ...options, valueAt: cost });
    expect(mesh).toHaveLength(1600);
    expect(cost).toHaveBeenCalledTimes(1681);
    expect(new Set(mesh.map((patch) => patch.key)).size).toBe(mesh.length);
    for (let i = 1; i < mesh.length; i++)
      expect(mesh[i].depth).toBeGreaterThanOrEqual(mesh[i - 1].depth);
  });

  it("joins the conceptual morph to the cost surface without a geometry jump", () => {
    const end = collectiveTerrainMesh({
      ...options,
      intro: { progress: 1, valleys: morphValleys(initial, target, 1) },
    });
    const actual = collectiveTerrainMesh(options);
    const byKey = new Map(actual.map((patch) => [patch.key, patch]));
    for (const patch of end) {
      const expected = byKey.get(patch.key)!;
      expect(patch.d).toBe(expected.d);
      expect(patch.depth).toBeCloseTo(expected.depth, 10);
      // Intro colors interpolate heights; cost colors interpolate raw values.
      // Both must remain in the common blue/green palette at the join.
      const hue = Number(patch.fill.match(/hsl\(([^ ]+)/)![1]);
      expect(hue).toBeGreaterThanOrEqual(169);
      expect(hue).toBeLessThanOrEqual(211);
    }
  });

  it.each([0, 0.5, 0.999, 1])(
    "keeps the morph finite at progress %s",
    (progress) => {
      const mesh = collectiveTerrainMesh({
        ...options,
        intro: { progress, valleys: morphValleys(initial, target, progress) },
      });
      for (const patch of mesh) {
        expect(Number.isFinite(patch.depth)).toBe(true);
        expect(patch.d + patch.fill).not.toMatch(/NaN|Infinity|undefined/);
      }
    },
  );

  it("fades individual wells to a flat surface when there is no target", () => {
    const flatOptions = {
      ...options,
      flat: true,
      valueAt: () => 0,
      view: sharedTerrainProjection({ ...camera, flat: true }),
    };
    const faded = collectiveTerrainMesh({
      ...flatOptions,
      intro: { progress: 1, valleys: morphValleys(initial, null, 1) },
    });
    expect(faded).toEqual(collectiveTerrainMesh(flatOptions));
  });
});
