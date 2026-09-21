import { potential, type Parameters } from "./lyapunov";

/** Keep the invariant-region experiment on an invariant field and in its TCZ. */
export function invariantParameters(params: Parameters): Parameters {
  const value = potential(params.initial, params);
  const scale = value > params.theta ? Math.sqrt(params.theta / value) : 1;
  return {
    ...params,
    dynamics:
      params.dynamics === "inward" || params.dynamics === "contained"
        ? params.dynamics
        : "normal",
    initial: {
      x: params.initial.x * scale,
      y: params.initial.y * scale,
    },
  };
}
