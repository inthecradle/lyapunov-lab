import { COLLECTIVE_COLORS as COLORS } from "./collectivePresentation";
import { useMemo } from "react";
import {
  sampleCollective,
  type CollectiveParameters,
  type CollectiveSample,
  type Point,
} from "../model/collective";
import type { collectivePlaybackTerrain } from "../model/collectivePlayback";
import {
  sharedTerrainProjection,
  T2_HEIGHT_REFERENCE_COEFFICIENT,
} from "../model/sharedTerrainProjection";
import { terrainThreshold } from "../model/terrainThreshold";
import { terrainThresholdMesh } from "../model/terrainThresholdMesh";
import { introTerrainHeight, morphValleys } from "../model/collectiveIntro";
import { collectiveTerrainMesh } from "../model/collectiveTerrainMesh";
import CollectiveTerrainSurface from "./CollectiveTerrainSurface";

const path = (points: Point[], close = false) =>
  points
    .map((q, i) => `${i ? "L" : "M"}${q.x.toFixed(2)},${q.y.toFixed(2)}`)
    .join(" ") + (close ? " Z" : "");

export default function CollectivePlaybackTerrain({
  parameters,
  current,
  terrain,
  introProgress,
  yaw,
  elevation,
}: {
  parameters: CollectiveParameters;
  current: CollectiveSample;
  terrain: ReturnType<typeof collectivePlaybackTerrain>;
  introProgress: number;
  yaw: number;
  elevation: number;
}) {
  const view = useMemo(
    () =>
      sharedTerrainProjection({
        yaw,
        elevation,
        center: { x: 0.5, y: 0.5 },
        radius: 1,
        coefficient: terrain.coefficient,
        flat: !terrain.hasValley,
        heightReferenceCoefficient:
          parameters.theorem === 2
            ? T2_HEIGHT_REFERENCE_COEFFICIENT
            : undefined,
      }),
    [
      terrain.coefficient,
      terrain.hasValley,
      parameters.theorem,
      yaw,
      elevation,
    ],
  );
  const introActive = parameters.theorem === 3 && introProgress < 1;
  const introValleys = useMemo(
    () =>
      morphValleys(
        parameters.initial,
        terrain.hasValley && terrain.center
          ? {
              center: terrain.center,
              radius: Math.sqrt((0.85 * view.maxV) / terrain.coefficient),
              members: [0, 1, 2],
            }
          : null,
        introProgress,
      ),
    [parameters.initial, terrain, view, introProgress],
  );
  const displayedHeight = (q: Point) =>
    introActive
      ? introTerrainHeight(q, introValleys)
      : view.displayHeight(terrain.valueAt(q));
  const surface = useMemo(
    () =>
      collectiveTerrainMesh({
        center: { x: 0.5, y: 0.5 },
        radius: 1,
        view,
        valueAt: terrain.valueAt,
        flat: !terrain.hasValley,
        intro: introActive
          ? { progress: introProgress, valleys: introValleys }
          : undefined,
      }),
    [terrain, view, introActive, introProgress, introValleys],
  );
  const history = useMemo(
    () =>
      Array.from(
        { length: current.time === 0 ? 1 : 61 },
        (_, i) =>
          sampleCollective((current.time * i) / 60, parameters).positions,
      ),
    [current.time, parameters],
  );
  const axisPoint = { x: -0.5, y: -0.5 };
  const displayMax = 0.85 * view.maxV;
  const baseline = view.point(axisPoint, 0);
  const top = view.reference(axisPoint);
  const agentPoint = (index: number, q: Point) =>
    introActive
      ? view.atDisplayHeight(q, displayedHeight(q))
      : terrain.isolated(index)
        ? view.reference(q)
        : view.point(q, terrain.agentValue(index, q));
  const agentDisplayHeight = (index: number, q: Point) =>
    terrain.isolated(index) ? 0 : displayedHeight(q);
  const thresholdIndex = Math.max(
    0,
    parameters.initial.findIndex((_, i) => !terrain.isolated(i)),
  );
  const threshold = useMemo(
    () => terrainThreshold(parameters, thresholdIndex),
    [parameters, thresholdIndex],
  );
  const thresholdMesh = useMemo(
    () =>
      terrainThresholdMesh(threshold, (point) =>
        terrain.isolated(thresholdIndex)
          ? view.reference(point)
          : view.point(point, terrain.agentValue(thresholdIndex, point)),
      ),
    [threshold, terrain, view, thresholdIndex],
  );
  return (
    <svg
      viewBox="0 0 600 420"
      className="cl-convergence-terrain"
      data-testid="convergence-terrain"
      data-axis-max={terrain.axisMax}
      data-display-max={displayMax}
      data-intro-progress={introProgress}
      data-yaw={yaw}
      data-elevation={elevation}
      role="img"
      aria-label={
        introActive
          ? "定理3の地形の変形。3つの個人の谷から共通の地形へ変化する概念図"
          : `定理${parameters.theorem}の収束地形。元の画面と同じ平面と谷の表示で初期位置と現在位置を比較`
      }
    >
      {parameters.theorem === 2 && (
        <text x="300" y="25" textAnchor="middle">
          不一致費用Qの地形（個人評価Vᵢを含みません）
        </text>
      )}
      <path
        d={path(
          [
            { x: -0.5, y: -0.5 },
            { x: 1.5, y: -0.5 },
            { x: 1.5, y: 1.5 },
            { x: -0.5, y: 1.5 },
          ].map(view.reference),
          true,
        )}
        fill="#0c151e"
        stroke="#405364"
        strokeWidth="1"
      />
      <CollectiveTerrainSurface
        testId="convergence-surface"
        mesh={surface}
        introProgress={introProgress}
        introActive={introActive}
        flat={!terrain.hasValley}
      />
      {!introActive && thresholdMesh && (
        <g
          data-testid="convergence-threshold-area"
          data-kind={threshold.kind}
          pointerEvents="none"
        >
          <g fill="#65e6a4" fillOpacity=".22">
            {thresholdMesh.patches.map((patch) => (
              <path key={patch.key} d={patch.d} />
            ))}
          </g>
          <g
            data-testid="convergence-threshold-boundary"
            data-radius={threshold.radius ?? undefined}
            data-center-x={threshold.center?.x}
            data-center-y={threshold.center?.y}
            fill="none"
            stroke="#83ffb8"
            strokeWidth="1.6"
          >
            {thresholdMesh.point ? (
              <circle
                cx={thresholdMesh.point.x}
                cy={thresholdMesh.point.y}
                r="3"
              />
            ) : (
              <path d={thresholdMesh.boundary} />
            )}
          </g>
        </g>
      )}
      <g
        data-testid="convergence-axis"
        visibility={!introActive && terrain.hasValley ? undefined : "hidden"}
      >
        <path d={path([baseline, top])} stroke="#bdcbd5" fill="none" />
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
          const value = displayMax * (1 - Math.cbrt(1 - fraction));
          const q = view.point(axisPoint, value);
          return (
            <g key={fraction}>
              <line x1={q.x - 5} x2={q.x} y1={q.y} y2={q.y} stroke="#bdcbd5" />
              <text x={q.x - 9} y={q.y + 4} textAnchor="end">
                {value.toFixed(3)}
                {fraction === 1 ? "+" : ""}
              </text>
            </g>
          );
        })}
        <text x={top.x} y={top.y - 16} textAnchor="middle">
          {terrain.label}
        </text>
      </g>
      {!introActive && terrain.center && terrain.hasValley && (
        <g>
          <line
            x1={view.reference(terrain.center).x}
            y1={view.reference(terrain.center).y}
            x2={view.point(terrain.center, 0).x}
            y2={view.point(terrain.center, 0).y}
            stroke={parameters.theorem === 3 ? "#d5b4ff" : "#65e6d0"}
            strokeOpacity=".5"
            strokeDasharray="3 5"
          />
          <circle
            cx={view.reference(terrain.center).x}
            cy={view.reference(terrain.center).y}
            r="4"
            fill="none"
            stroke={parameters.theorem === 3 ? "#d5b4ff" : "#65e6d0"}
          />
          <circle
            cx={view.point(terrain.center, 0).x}
            cy={view.point(terrain.center, 0).y}
            r="8"
            fill="#0d2729"
            stroke={parameters.theorem === 3 ? "#d5b4ff" : "#65e6d0"}
            strokeWidth="1.5"
          />
          <text
            x={view.point(terrain.center, 0).x}
            y={view.point(terrain.center, 0).y + 23}
            textAnchor="middle"
            fill="#9ef2d0"
          >
            {parameters.theorem === 3 ? "LUB" : "共有状態"} · 谷底 = 0
          </text>
        </g>
      )}
      {parameters.initial.map((initial, index) => {
        const startValue = terrain.agentValue(index, initial);
        const start = agentPoint(index, initial);
        const value = terrain.agentValue(index, current.positions[index]);
        const point = agentPoint(index, current.positions[index]);
        return (
          <g key={index}>
            <path
              d={path([start, view.point(initial, 0)])}
              visibility={
                introActive || terrain.isolated(index) ? "hidden" : undefined
              }
              stroke={COLORS[index]}
              strokeDasharray="3 4"
              opacity=".4"
              fill="none"
            />
            <path
              d={path(
                history.map((positions) => agentPoint(index, positions[index])),
              )}
              stroke={COLORS[index]}
              strokeWidth="2.5"
              fill="none"
            />
            <g
              data-testid={`convergence-initial-${index}`}
              data-height={introActive ? undefined : startValue}
              data-display-height={agentDisplayHeight(index, initial)}
              data-screen-y={start.y}
              visibility={introActive ? "hidden" : undefined}
            >
              <circle
                cx={start.x}
                cy={start.y}
                r="8"
                fill="none"
                stroke={COLORS[index]}
                strokeWidth="2"
                strokeDasharray="3 2"
              />
              <text x={start.x + 12} y={start.y - 10} fill={COLORS[index]}>
                初期{index + 1}
              </text>
            </g>
            <g
              data-testid={`convergence-agent-${index}`}
              data-height={introActive ? undefined : value}
              data-display-height={agentDisplayHeight(
                index,
                current.positions[index],
              )}
              data-x={current.positions[index].x}
              data-y={current.positions[index].y}
              data-screen-y={point.y}
            >
              <circle
                cx={point.x}
                cy={point.y}
                r="6"
                fill={COLORS[index]}
                stroke="#e8fff7"
                strokeWidth="1.5"
              />
              {introActive && (
                <text x={point.x + 12} y={point.y - 10} fill={COLORS[index]}>
                  主体{index + 1}
                </text>
              )}
            </g>
          </g>
        );
      })}
      <text x="300" y="399" textAnchor="middle">
        {introActive
          ? "概念図：個人の谷から共通の地形へ（モデル t = 0）"
          : "○ 初期位置　● 現在位置　点線：初期位置から評価0まで"}
      </text>
    </svg>
  );
}
