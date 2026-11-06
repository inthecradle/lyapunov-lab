import { memo } from "react";
import type { collectiveTerrainMesh } from "../model/collectiveTerrainMesh";

/** Keep the fixed grid out of React's per-frame agent/trajectory updates. */
export default memo(function CollectiveTerrainSurface({
  mesh,
  introProgress,
  introActive,
  flat,
  testId,
}: {
  mesh: ReturnType<typeof collectiveTerrainMesh>;
  introProgress: number;
  introActive: boolean;
  flat: boolean;
  testId: string;
}) {
  return (
    <g
      data-testid={testId}
      data-intro-progress={introProgress}
      data-shape={
        introActive
          ? introProgress === 0
            ? "individual-wells"
            : "merging-wells"
          : flat
            ? "flat"
            : "plane-with-well"
      }
    >
      {mesh.map((patch) => (
        <path
          key={patch.key}
          d={patch.d}
          fill={patch.fill}
          stroke="#81aeba"
          strokeOpacity=".21"
          strokeWidth=".65"
        />
      ))}
    </g>
  );
});
