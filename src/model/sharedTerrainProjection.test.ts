import { describe, expect, it } from "vitest";
import {
  sharedTerrainProjection,
  T2_HEIGHT_REFERENCE_COEFFICIENT,
  type SharedTerrainCamera,
} from "./sharedTerrainProjection";

const camera: SharedTerrainCamera = {
  yaw: -28,
  elevation: 28,
  center: { x: 0.5, y: 0.5 },
  radius: 1,
  coefficient: 2.4,
  flat: false,
};

describe("fixed collective terrain frame", () => {
  it("keeps reference coordinates fixed for both potentials and the uncoupled plane", () => {
    const q = { x: 0.8, y: 0.2 };
    const expected = sharedTerrainProjection(camera).reference(q);
    for (const coefficient of [0, 0.001, 0.5, 6]) {
      for (const flat of [true, false]) {
        expect(
          sharedTerrainProjection({ ...camera, coefficient, flat }).reference(
            q,
          ),
        ).toEqual(expected);
      }
    }
  });

  it("uses a fixed T2 height reference so changing coupling cannot rescale the same cost", () => {
    const q = { x: 0.8, y: 0.2 };
    const views = [0, 0.6, 2.4, 6].map((coefficient) =>
      sharedTerrainProjection({
        ...camera,
        coefficient,
        heightReferenceCoefficient: T2_HEIGHT_REFERENCE_COEFFICIENT,
      }),
    );
    for (const view of views) {
      expect(view.maxV).toBeCloseTo(2.4 / 1.12 ** 2, 12);
      for (const cost of [0, 0.01, 0.111, 0.444, 1]) {
        expect(view.displayHeight(cost)).toBe(views[0].displayHeight(cost));
        expect(view.point(q, cost)).toEqual(views[0].point(q, cost));
      }
    }
    // Stronger equal couplings raise Q at the same coordinate instead of cancelling in maxV.
    expect(views[2].displayHeight(0.444)).toBeGreaterThan(
      views[1].displayHeight(0.111),
    );
    expect(
      sharedTerrainProjection({ ...camera, coefficient: 0.4 }).maxV,
    ).toBeCloseTo(0.4 / 1.12 ** 2, 12);
  });

  it("inverts drag displacement and fits the plane and full well depth at all camera extremes", () => {
    for (const yaw of [-80, -28, 0, 80]) {
      for (const elevation of [22, 28, 65]) {
        const view = sharedTerrainProjection({ ...camera, yaw, elevation });
        const a = { x: 0.2, y: 0.8 },
          b = { x: 0.7, y: 0.3 };
        const from = view.reference(a),
          to = view.reference(b);
        const delta = view.delta({ x: to.x - from.x, y: to.y - from.y });
        expect(delta.x).toBeCloseTo(b.x - a.x, 12);
        expect(delta.y).toBeCloseTo(b.y - a.y, 12);
        for (const x of [-0.5, 1.5]) {
          for (const y of [-0.5, 1.5]) {
            for (const value of [0, view.maxV]) {
              const p = view.point({ x, y }, value);
              expect(p.x).toBeGreaterThanOrEqual(43.99);
              expect(p.x).toBeLessThanOrEqual(556.01);
              expect(p.y).toBeGreaterThanOrEqual(66.99);
              expect(p.y).toBeLessThanOrEqual(371.01);
            }
          }
        }
      }
    }
  });
});
