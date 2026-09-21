import { expect, it } from "vitest";
import { invariantParameters } from "./invariance";
import {
  DEFAULT_PARAMETERS,
  guarantees,
  potential,
  sampleAt,
  type Dynamics,
} from "./lyapunov";

it("keeps every editable initial state and subsequent trajectory in the invariant region", () => {
  for (const theta of [0.25, 1, 3]) {
    for (const stretch of [0.5, 2]) {
      for (const initial of [
        { x: 0, y: 0 },
        { x: 0.1, y: -0.1 },
        { x: 3, y: -3 },
      ]) {
        for (const dynamics of [
          "normal",
          "inward",
          "contained",
          "outward",
        ] as Dynamics[]) {
          const params = invariantParameters({
            ...DEFAULT_PARAMETERS,
            theta,
            stretch,
            initial,
            dynamics,
          });
          expect(guarantees(params).forwardInvariant).toBe(true);
          expect(potential(params.initial, params)).toBeLessThanOrEqual(
            theta + 1e-12,
          );
          for (const time of [0, 1, 12, 100]) {
            expect(sampleAt(time, params).value).toBeLessThanOrEqual(
              theta + 1e-12,
            );
          }
          if (potential(initial, params) <= theta)
            expect(params.initial).toEqual(initial);
        }
      }
    }
  }
});
