import { useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, ReactNode } from "react";
import { lubOf, sampleCollective } from "../model/collective";
import type {
  CollectiveParameters,
  CollectiveSample,
  Point,
} from "../model/collective";
import { componentValleys, sharedValley } from "../model/sharedValley";
import { terrainThresholdMesh } from "../model/terrainThresholdMesh";
import { collectiveTerrainMesh } from "../model/collectiveTerrainMesh";
import CollectiveTerrainSurface from "./CollectiveTerrainSurface";
import {
  COLLECTIVE_INTRO_DURATION,
  introTerrainHeight,
  morphValleys,
} from "../model/collectiveIntro";
import { terrainThreshold } from "../model/terrainThreshold";
import {
  sharedTerrainProjection,
  T2_HEIGHT_REFERENCE_COEFFICIENT,
} from "../model/sharedTerrainProjection";
import type { SharedTerrainCamera } from "../model/sharedTerrainProjection";
import "./collective-terrain-3d.css";

type Props = {
  parameters: CollectiveParameters;
  current: CollectiveSample;
  selected: number;
  onSelect: (index: number) => void;
  onMove: (index: number, point: Point) => void;
  onEditStart: () => void;
  playbackControls?: ReactNode;
  introProgress: number;
  onSkipIntro: () => void;
  onIntroChange: (progress: number) => void;
  onReplayIntro: () => void;
};
const COLORS = ["#65e6d0", "#91a6ff", "#f6ba77"];
const meanPoint = (points: Point[]): Point => ({
  x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
  y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
});
const FRAME_CENTER = { x: 0.5, y: 0.5 };
const FRAME_RADIUS = 1;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const path = (points: Point[], close = false) =>
  points
    .map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ") + (close ? " Z" : "");

export default function CollectiveTerrain3D({
  parameters,
  current,
  selected,
  onSelect,
  onMove,
  onEditStart,
  playbackControls,
  introProgress,
  onSkipIntro,
  onIntroChange,
  onReplayIntro,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [yaw, setYaw] = useState(-28);
  const [elevation, setElevation] = useState(28);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{
    pointer: number;
    start: Point;
    origin: Point;
    camera: SharedTerrainCamera;
    selected: number;
  } | null>(null);
  const isAbstraction = parameters.theorem === 3;
  const introActive = isAbstraction && introProgress < 1;
  const globalValley = sharedValley(parameters);
  const activeValley = componentValleys(parameters).find(
    (group) => group.members.length > 1,
  );
  const valley = activeValley ?? { ...globalValley, members: [] as number[] };
  const isIsolated = (index: number) =>
    !isAbstraction && !valley.members.includes(index);
  const center = isAbstraction ? lubOf(parameters.worlds) : valley.center;
  const flat = !isAbstraction && !activeValley;
  const coefficient = isAbstraction ? 0.5 : valley.coefficient;
  const camera: SharedTerrainCamera =
    dragging && drag.current
      ? drag.current.camera
      : {
          yaw,
          elevation,
          center: FRAME_CENTER,
          radius: FRAME_RADIUS,
          coefficient,
          flat,
          heightReferenceCoefficient: isAbstraction
            ? undefined
            : T2_HEIGHT_REFERENCE_COEFFICIENT,
        };
  const view = useMemo(
    () => sharedTerrainProjection(camera),
    [
      camera.yaw,
      camera.elevation,
      camera.center.x,
      camera.center.y,
      camera.radius,
      camera.coefficient,
      camera.flat,
      camera.heightReferenceCoefficient,
    ],
  );
  const valueAt = (q: Point) =>
    isAbstraction
      ? ((q.x - center.x) ** 2 + (q.y - center.y) ** 2) / 2
      : valley.value(q);
  const introValleys = useMemo(
    () =>
      morphValleys(
        parameters.initial,
        flat
          ? null
          : {
              center,
              radius: Math.sqrt((0.85 * view.maxV) / coefficient),
              members: isAbstraction ? [0, 1, 2] : valley.members,
            },
        introProgress,
      ),
    [parameters, introProgress, view],
  );
  const displayedHeight = (q: Point) =>
    introActive
      ? introTerrainHeight(q, introValleys)
      : view.displayHeight(valueAt(q));
  const displayedPoint = (q: Point) =>
    view.atDisplayHeight(q, displayedHeight(q));
  const label = isAbstraction ? "Aᵢ" : "Q";
  const lower = {
    x: camera.center.x - camera.radius,
    y: camera.center.y - camera.radius,
  };
  const upper = {
    x: camera.center.x + camera.radius,
    y: camera.center.y + camera.radius,
  };
  const corners = [
    lower,
    { x: upper.x, y: lower.y },
    upper,
    { x: lower.x, y: upper.y },
  ];
  const mesh = useMemo(
    () =>
      collectiveTerrainMesh({
        center: camera.center,
        radius: camera.radius,
        view,
        valueAt,
        flat,
        intro: introActive
          ? { progress: introProgress, valleys: introValleys }
          : undefined,
      }),
    [parameters, view, introActive, introProgress, introValleys],
  );
  const historySamples = useMemo(
    () =>
      Array.from({ length: current.time === 0 ? 1 : 61 }, (_, i) =>
        sampleCollective((current.time * i) / 60, parameters),
      ),
    [parameters, current.time],
  );
  const history = useMemo(
    () =>
      parameters.initial.map((_, index) =>
        historySamples.map((sample) => {
          const q = sample.positions[index];
          return isIsolated(index)
            ? view.reference(q)
            : view.point(q, valueAt(q));
        }),
      ),
    [parameters, historySamples, view],
  );
  const centroid = meanPoint(current.positions);
  const centroidScreen = view.reference(centroid);
  const centroidStart = view.reference(meanPoint(parameters.initial));
  const centroidHistory = historySamples.map((sample) =>
    view.reference(meanPoint(sample.positions)),
  );
  const threshold = terrainThreshold(parameters, selected);
  const thresholdLabel = isAbstraction ? "θ_A" : "θ";
  const thresholdMesh = useMemo(() => {
    const project = (point: Point) =>
      isIsolated(selected)
        ? view.reference(point)
        : view.point(point, valueAt(point));
    return terrainThresholdMesh(threshold, project);
  }, [parameters, selected, view]);
  const svgPosition = (event: PointerEvent<SVGElement>): Point | null => {
    const svg = svgRef.current,
      matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return null;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(matrix.inverse());
  };
  const beginDrag = (index: number, event: PointerEvent<SVGCircleElement>) => {
    const start = svgPosition(event);
    if (!start) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const origin = current.positions[index];
    drag.current = {
      pointer: event.pointerId,
      start,
      origin: { ...origin },
      camera: { ...camera, center: { ...camera.center } },
      selected: index,
    };
    setDragging(true);
    onSelect(index);
    onEditStart();
    onMove(index, origin);
  };
  const moveDrag = (event: PointerEvent<SVGCircleElement>) => {
    const active = drag.current,
      cursor = svgPosition(event);
    if (!active || active.pointer !== event.pointerId || !cursor) return;
    const delta = sharedTerrainProjection(active.camera).delta({
      x: cursor.x - active.start.x,
      y: cursor.y - active.start.y,
    });
    onMove(active.selected, {
      x: clamp(active.origin.x + delta.x),
      y: clamp(active.origin.y + delta.y),
    });
  };
  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };
  const keyboardMove = (
    index: number,
    event: KeyboardEvent<SVGCircleElement>,
  ) => {
    const step = event.shiftKey ? 0.1 : 0.02;
    const moves: Record<string, Point> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: step },
      ArrowDown: { x: 0, y: -step },
    };
    const delta = moves[event.key];
    if (!delta) return;
    event.preventDefault();
    onSelect(index);
    onEditStart();
    const point = current.positions[index];
    onMove(index, { x: clamp(point.x + delta.x), y: clamp(point.y + delta.y) });
  };
  const centerScreen = view.point(center, 0);
  const centerReference = view.reference(center);
  const origin = view.reference({ x: 0, y: 0 });
  const xAxis = view.reference({ x: 1, y: 0 });
  const yAxis = view.reference({ x: 0, y: 1 });

  return (
    <div className="cl-terrain">
      <div className="cl-terrain-agent-select" aria-label="地形で注目する主体">
        <span>注目する主体</span>
        {current.positions.map((_, index) => (
          <button
            type="button"
            key={index}
            aria-label={`地形の主体${index + 1}`}
            aria-pressed={selected === index}
            onClick={() => onSelect(index)}
            style={{ color: COLORS[index] }}
          >
            主体 {index + 1}
          </button>
        ))}
      </div>
      <svg
        ref={svgRef}
        className="cl-terrain-svg"
        viewBox="0 0 600 450"
        data-testid="collective-terrain-svg"
        role="group"
        aria-label={
          introActive
            ? "3人の個人の谷から共通の谷への概念図"
            : isAbstraction
              ? "全主体が共有するLUBの谷"
              : "不一致費用Qの地形"
        }
      >
        <title>
          {introActive
            ? "3つの浅い個人の谷から共通の地形への導入。評価関数の時間変化ではありません。"
            : flat
              ? "連結していないため、全主体に共通する谷を表示しません。"
              : "定理1と同じ表示圧縮で、共通の評価地形を周囲の平面と谷として表示。"}
        </title>
        {introActive && (
          <text x="300" y="32" textAnchor="middle" fill="#c6d3e7">
            {introProgress === 0
              ? "3つの個人の谷（概念図）"
              : "共通の地形へ（概念図）"}
          </text>
        )}
        <path
          data-testid="collective-terrain-frame"
          d={path(
            corners.map((q) => view.reference(q)),
            true,
          )}
          fill="#0c151e"
          stroke="#405364"
          strokeWidth="1"
        />
        <CollectiveTerrainSurface
          testId="collective-terrain-surface"
          mesh={mesh}
          introProgress={introProgress}
          introActive={introActive}
          flat={flat}
        />
        {!introActive && thresholdMesh && (
          <g
            data-testid="collective-terrain-threshold-area"
            data-kind={threshold.kind}
            pointerEvents="none"
          >
            <g fill="#65e6a4" fillOpacity=".22">
              {thresholdMesh.patches.map((patch) => (
                <path key={patch.key} d={patch.d} />
              ))}
            </g>
            <g
              data-testid="collective-terrain-threshold-boundary"
              data-center-x={threshold.center?.x}
              data-center-y={threshold.center?.y}
              data-radius={threshold.radius ?? undefined}
              data-min-x={thresholdMesh.minX}
              data-max-x={thresholdMesh.maxX}
              data-min-y={thresholdMesh.minY}
              data-max-y={thresholdMesh.maxY}
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
        <g className="cl-terrain-axes" opacity="0.65">
          <path
            data-testid="collective-terrain-coordinate-frame"
            d={path(
              [origin, xAxis, view.reference({ x: 1, y: 1 }), yAxis],
              true,
            )}
            stroke="#8197a8"
            strokeDasharray="3 4"
            fill="none"
          />
          <text x={origin.x - 8} y={origin.y + 14}>
            0
          </text>
          <text x={xAxis.x + 8} y={xAxis.y + 13}>
            1
          </text>
          <text x={yAxis.x - 14} y={yAxis.y + 13}>
            1
          </text>
        </g>
        {!introActive &&
          isAbstraction &&
          parameters.worlds.map((world, index) => {
            const p = view.reference(world);
            const onSurface = view.point(world, valueAt(world));
            return (
              <g
                key={index}
                data-testid={`collective-terrain-world-${index}`}
                data-x={world.x}
                data-y={world.y}
              >
                <line
                  x1={p.x}
                  y1={p.y}
                  x2={onSurface.x}
                  y2={onSurface.y}
                  stroke={COLORS[index]}
                  strokeOpacity=".22"
                  strokeDasharray="2 4"
                />
                <path
                  d={`M${p.x - 5},${p.y - 5}h10v10h-10Z`}
                  fill="#101923"
                  stroke={COLORS[index]}
                  strokeOpacity=".6"
                />
                <text x={p.x + 9} y={p.y - 7} fill={COLORS[index]}>
                  W{index + 1}
                </text>
              </g>
            );
          })}
        {!introActive && !flat && (
          <g
            data-testid={
              isAbstraction
                ? "collective-terrain-lub"
                : "collective-terrain-center"
            }
            data-members={isAbstraction ? "0,1,2" : valley.members.join(",")}
            data-x={center.x}
            data-y={center.y}
            data-height="0"
            data-screen-x={centerScreen.x}
            data-screen-y={centerScreen.y}
            data-display-height={view.displayHeight(0)}
          >
            <line
              x1={centerReference.x}
              y1={centerReference.y}
              x2={centerScreen.x}
              y2={centerScreen.y}
              stroke={isAbstraction ? "#d5b4ff" : "#65e6d0"}
              strokeOpacity=".5"
              strokeDasharray="3 5"
              pointerEvents="none"
            />
            <circle
              cx={centerReference.x}
              cy={centerReference.y}
              r="4"
              fill="none"
              stroke={isAbstraction ? "#d5b4ff" : "#65e6d0"}
            />
            <circle
              cx={centerScreen.x}
              cy={centerScreen.y}
              r="8"
              fill="#0d2729"
              stroke={isAbstraction ? "#d5b4ff" : "#65e6d0"}
              strokeWidth="1.5"
            />
            <path
              d={`M${centerScreen.x - 4},${centerScreen.y}h8M${centerScreen.x},${centerScreen.y - 4}v8`}
              stroke={isAbstraction ? "#d5b4ff" : "#65e6d0"}
            />
            <text
              x={centerScreen.x + 12}
              y={centerScreen.y + 22}
              fill={isAbstraction ? "#d5b4ff" : "#65e6d0"}
            >
              {isAbstraction ? "LUB" : "共有状態"}
            </text>
          </g>
        )}
        {!introActive &&
          history.map((points, index) => (
            <g key={index}>
              <path
                data-testid={`collective-terrain-history-${index}`}
                d={path(points)}
                fill="none"
                stroke={COLORS[index]}
                strokeWidth="1.8"
                strokeOpacity=".7"
              />
              <circle
                cx={points[0].x}
                cy={points[0].y}
                r="5"
                fill="none"
                stroke={COLORS[index]}
                strokeOpacity=".5"
              />
            </g>
          ))}
        {introActive &&
          introValleys.map((well, index) => {
            const point = well.center;
            const markerRadius = (0.13 * well.radius) / 0.55;
            const ring = Array.from({ length: 48 }, (_, n) => {
              const angle = (n * 2 * Math.PI) / 48;
              return displayedPoint({
                x: point.x + markerRadius * Math.cos(angle),
                y: point.y + markerRadius * Math.sin(angle),
              });
            });
            return (
              <g
                key={index}
                data-testid={`collective-intro-valley-${index}`}
                data-x={point.x}
                data-y={point.y}
                data-radius={well.radius}
                data-depth={well.depth}
                opacity={
                  Math.min(1, well.depth / 120) *
                  Math.min(1, (1 - introProgress) / 0.2)
                }
                pointerEvents="none"
              >
                <path
                  d={path(ring, true)}
                  fill="none"
                  stroke="#83ffb8"
                  strokeWidth="1.3"
                />
              </g>
            );
          })}
        {current.positions.map((point, index) => {
          const isolated = isIsolated(index);
          const height = isolated ? 0 : valueAt(point),
            state = introActive
              ? displayedPoint(point)
              : isolated
                ? view.reference(point)
                : view.point(point, height);
          return (
            <g
              key={index}
              data-testid={
                index === selected
                  ? "collective-terrain-point"
                  : `collective-terrain-agent-${index}`
              }
              data-agent-index={index}
              data-isolated={isolated}
              data-x={point.x}
              data-y={point.y}
              data-height={introActive ? undefined : height}
              data-display-height={
                introActive
                  ? displayedHeight(point)
                  : isolated
                    ? 0
                    : view.displayHeight(height)
              }
              data-screen-x={state.x}
              data-screen-y={state.y}
            >
              <circle
                cx={state.x}
                cy={state.y}
                r={index === selected ? 18 : 14}
                fill={COLORS[index]}
                fillOpacity=".12"
                pointerEvents="none"
              />
              <circle
                className="cl-terrain-current"
                cx={state.x}
                cy={state.y}
                r={index === selected ? 8 : 6}
                fill={COLORS[index]}
                stroke="#f0fffc"
                strokeWidth={index === selected ? 2 : 1}
                role="button"
                tabIndex={0}
                aria-label={`3D地形の主体${index + 1}。ドラッグまたは矢印キーで初期位置を変更`}
                onPointerDown={(event) => beginDrag(index, event)}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onLostPointerCapture={endDrag}
                onKeyDown={(event) => keyboardMove(index, event)}
              />
              {(introActive || index === selected || isolated) && (
                <text
                  className="cl-terrain-current-label"
                  x={state.x + 14}
                  y={state.y - 15}
                  fill={COLORS[index]}
                >
                  {introActive
                    ? `主体${index + 1}`
                    : isolated
                      ? `主体${index + 1}：結合なし`
                      : `主体${index + 1} · ${label} = ${height.toFixed(3)}`}
                </text>
              )}
            </g>
          );
        })}
        <g
          className="cl-terrain-centroid"
          pointerEvents="none"
          visibility={introActive ? "hidden" : undefined}
        >
          <path
            data-testid="collective-terrain-centroid-history"
            d={path(centroidHistory)}
            fill="none"
            stroke="#ffe08a"
            strokeWidth="2.5"
            strokeDasharray="5 3"
          />
          <circle
            cx={centroidStart.x}
            cy={centroidStart.y}
            r="5"
            fill="none"
            stroke="#ffe08a"
            strokeOpacity=".65"
          />
          <g
            data-testid="collective-terrain-centroid"
            data-x={centroid.x}
            data-y={centroid.y}
            data-screen-x={centroidScreen.x}
            data-screen-y={centroidScreen.y}
          >
            <path
              d={`M${centroidScreen.x},${centroidScreen.y - 7}l7,7l-7,7l-7,-7Z`}
              fill="#ffe08a"
              stroke="#332c18"
              strokeWidth="1.5"
            />
            <text
              x={centroidScreen.x - 12}
              y={centroidScreen.y - 12}
              textAnchor="end"
              fill="#ffe08a"
              className="cl-terrain-current-label"
            >
              重心
            </text>
          </g>
        </g>
        <text
          x="300"
          y="407"
          textAnchor="middle"
          className="cl-terrain-floor-label"
        >
          {introActive
            ? "概念図：個人の谷から共通の谷へ"
            : "横方向：共有表象の成分1・2 ／ 縦方向：評価値を表示圧縮"}
        </text>
        <text
          x="300"
          y="425"
          textAnchor="middle"
          className="cl-terrain-floor-label"
        >
          {introActive
            ? "緑は谷底の目印（θの判定ではありません）"
            : flat
              ? "共通の谷なし ／ 描画評価は0"
              : "周囲は高い評価値の基準面、谷底は0"}
        </text>
      </svg>
      {playbackControls}
      {isAbstraction && (
        <div
          className="cl-terrain-intro"
          data-testid="collective-morph-controls"
        >
          <div
            data-testid={introActive ? "collective-intro-status" : undefined}
          >
            <strong>
              {introProgress === 0
                ? "3人の個人の谷"
                : introActive
                  ? "共通の地形へ変化"
                  : "共通の地形"}
            </strong>
            <span>
              {introActive ? "概念図" : "変形完了"} ·{" "}
              {(introProgress * COLLECTIVE_INTRO_DURATION).toFixed(1)} /{" "}
              {COLLECTIVE_INTRO_DURATION}秒
            </span>
          </div>
          <p>
            {flat
              ? "結合なし：個人の谷から、互いに引き合わない配置へ。"
              : !isAbstraction && !globalValley.connected
                ? "結合した2人の谷だけを共有。孤立した主体は別に残ります。"
                : isAbstraction
                  ? "3つの個人の谷から、LUBを底に持つ共通の谷へ。"
                  : "3つの個人の谷から、共有状態を底に持つ共通の谷へ。"}
          </p>
          <label className="cl-morph-slider">
            <span>変形の進み具合</span>
            <output>{Math.round(introProgress * 100)}%</output>
            <input
              type="range"
              aria-label="モーフィングの進み具合"
              min="0"
              max="100"
              step="1"
              value={introProgress * 100}
              onChange={(event) =>
                onIntroChange(Number(event.target.value) / 100)
              }
            />
          </label>
          <div className="cl-terrain-intro-actions">
            <button type="button" onClick={onReplayIntro}>
              変形を最初から再生
            </button>
            {introActive && (
              <button type="button" onClick={onSkipIntro}>
                導入をスキップ
              </button>
            )}
          </div>
          <small>
            スライダーで途中の形を確認できます。操作すると収束の時刻を0に戻します。
          </small>
        </div>
      )}
      <div
        className="cl-terrain-comparison"
        hidden={introActive}
        data-testid="collective-terrain-comparison"
      >
        <p>
          <span aria-hidden="true">◆</span> 重心（3主体の平均）
          <b>
            ({centroid.x.toFixed(3)}, {centroid.y.toFixed(3)})
          </b>
        </p>
        <p>
          {isAbstraction
            ? parameters.eta > 0
              ? "定理3：重心はLUBへ近づきます。黄色の破線が重心の軌跡です。"
              : "定理3：η = 0のため重心は動きません。"
            : "定理2：重心を保ちながら、結合された主体が近づきます。"}
        </p>
        <p>
          重心と軌跡は基準面に投影。谷底から上への点線は、同じ座標を示します。
        </p>
      </div>
      <div className="cl-terrain-camera">
        <label>
          回転
          <input
            aria-label="共有3D視点の回転"
            type="range"
            min="-80"
            max="80"
            step="1"
            value={yaw}
            onChange={(event) => setYaw(Number(event.target.value))}
          />
          <output>{yaw}°</output>
        </label>
        <label>
          仰角
          <input
            aria-label="共有3D視点の仰角"
            type="range"
            min="22"
            max="65"
            step="1"
            value={elevation}
            onChange={(event) => setElevation(Number(event.target.value))}
          />
          <output>{elevation}°</output>
        </label>
      </div>
      <div className="cl-terrain-threshold-legend" hidden={introActive}>
        <p>
          <span aria-hidden="true" />
          緑：{isAbstraction ? "ηAᵢ" : "Q"} ≤ {thresholdLabel}（地形上の範囲）
        </p>
        <p
          data-testid="collective-terrain-threshold-status"
          data-kind={threshold.kind}
          data-threshold-reached={current.thresholdReached}
        >
          {threshold.kind === "all"
            ? "この項による位置の制約がないため、座標0〜1の全域を緑色で表示します。"
            : "谷底の評価は0なので、緑の領域は初期状態から存在します。"}
          集団全体が閾値以下になるための必要条件です。合成評価の判定は時間グラフで確認できます。
        </p>
      </div>
      {introActive && (
        <p className="cl-terrain-description">
          個人の谷は説明用の配置です。個人評価Vᵢと共有表象の変数は別であり、この変形は論文の評価関数の時間変化を表しません。
        </p>
      )}
      <p className="cl-terrain-description" hidden={introActive}>
        {isAbstraction
          ? "全主体を同じLUBの谷に表示します。地形は共通の抽象ポテンシャルAᵢ、合成評価ℒ_Aは時間グラフに表示します。"
          : flat
            ? "主体間の結合がないため、谷は表示しません。"
            : valley.exact
              ? "結合された主体を同じ共有状態の谷に表示します。各主体の表示値の和は不一致費用に一致します。合成評価ℒは時間グラフに表示します。"
              : "結合された主体を同じ共有状態の谷に表示します。結合強度が異なるため、地形は不一致費用の下界です。実際の費用は時間グラフで確認できます。"}
        {!isAbstraction &&
          !globalValley.connected &&
          !flat &&
          "孤立した主体は谷に引かれず、基準面にとどまります。"}
        点のドラッグ・矢印キーで初期位置を変更できます。
      </p>
      {!isAbstraction && (
        <p
          className="cl-terrain-description"
          data-testid="collective-t2-terrain-explanation"
        >
          不一致費用Qの地形です。個人評価Vᵢを含まないため、個人の谷との深さ比較には使いません。
          ポップアップの「高さの比較」で、各主体の個人評価Vᵢと相互の不整合ΣⱼγᵢⱼSᵢⱼを、同じゼロ基準の積み上げで確認できます。
        </p>
      )}
      <details className="cl-terrain-details">
        <summary>地形と評価値の対応</summary>
        <p>
          {isAbstraction
            ? "Aᵢ(q)=½‖q−LUB‖²。谷底は全主体に共通です。Wは周囲の基準面への投影で、初期位置を編集したときだけ更新します。"
            : valley.exact
              ? "Q(q)=λ₂‖q−連結成分の平均初期位置‖²。結合係数が等しいこの設定では、連結成分内の主体のQの和が社会的費用と一致します。"
              : "Q(q)=λ₂‖q−連結成分の平均初期位置‖²。λ₂は結合ラプラシアンの第2固有値です。結合係数が異なるとき、連結成分内の主体のQの和は社会的費用の下界を示します。"}{" "}
          定理1と同じ表示圧縮を使い、高い値を平面に、低い値をくぼみに描いています。数字は圧縮前の評価値です。重心の動きはこの具体モデルの対称結合によるものです。定理2・3は同じ座標枠・視点で比較できます。地形の広さ・深さは描画設定で、運動方程式や評価項は追加していません。主体の編集範囲は0〜1です。
        </p>
      </details>
    </div>
  );
}
