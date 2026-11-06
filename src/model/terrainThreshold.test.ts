import { describe, expect, it } from "vitest";
import { DEFAULT_COLLECTIVE, sampleCollective } from "./collective";
import { terrainThreshold } from "./terrainThreshold";

describe("terrain threshold bounds", () => {
  it("has a green valley even while the initial composite cost exceeds theta", () => {
    const p = DEFAULT_COLLECTIVE;
    expect(sampleCollective(0, p).thresholdReached).toBe(false);
    const region = terrainThreshold(p, 0);
    expect(region.kind).toBe("disk");
    if (region.kind !== "disk") throw new Error("Expected disk");
    expect(region.radius).toBeCloseTo(Math.sqrt(p.theta / 2.4), 12);
    expect(region.center.x).toBeCloseTo(0.45, 12);
    expect(region.center.y).toBeCloseTo(0.45, 12);
  });

  it("includes eta when bounding the abstraction term and handles eta zero", () => {
    const p = { ...DEFAULT_COLLECTIVE, theorem: 3 as const, eta: 0.2 };
    const region = terrainThreshold(p, 0);
    expect(region.kind).toBe("disk");
    if (region.kind !== "disk") throw new Error("Expected disk");
    expect(region.radius).toBeCloseTo(1, 12);
    expect(region.center).toEqual({ x: 0.8, y: 0.8 });
    expect(terrainThreshold({ ...p, eta: 0 }, 0).kind).toBe("all");
  });

  it("bounds the connected pair while leaving the isolated agent unconstrained", () => {
    const p = { ...DEFAULT_COLLECTIVE, gamma: [0.8, 0, 0] };
    const pair = terrainThreshold(p, 0);
    expect(pair.kind).toBe("disk");
    if (pair.kind !== "disk") throw new Error("Expected disk");
    expect(pair.center).toEqual({ x: 0.5, y: 0.5 });
    expect(pair.radius).toBeCloseTo(Math.sqrt(p.theta / 1.6), 12);
    expect(terrainThreshold(p, 2).kind).toBe("all");
  });

  it("reduces the positive-coefficient bound to the valley bottom for theta zero", () => {
    expect(
      terrainThreshold({ ...DEFAULT_COLLECTIVE, theta: 0 }, 0).radius,
    ).toBe(0);
  });
});
