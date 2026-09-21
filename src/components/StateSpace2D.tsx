import { useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import {
  potential,
  sampleAt,
  trajectory,
  field,
  potentialDerivative,
  viewportPotential,
  dynamicsOf,
  velocityAt,
} from "../model/lyapunov";
import type { Parameters, Vec2 } from "../model/lyapunov";
import type { MathId } from "../interaction";

type Props = {
  params: Parameters;
  time: number;
  active: MathId | null;
  onSelect: (id: MathId) => void;
  onInitialChange: (point: Vec2) => void;
};

const CX = 300;
const CY = 210;
const clamp = (n: number) => Math.max(-3, Math.min(3, n));

export default function StateSpace({
  params,
  time,
  active,
  onSelect,
  onInitialChange,
}: Props) {
  const uid = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{
    startX: number;
    startY: number;
    moved: boolean;
    scale: number;
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  const current = sampleAt(time, params);
  const initialV = viewportPotential(params);
  const dynamics = dynamicsOf(params);
  const boundaryColor = dynamics === "outward" ? "#ff8a8a" : "#65e6d0";
  const boundaryDirection =
    dynamics === "outward"
      ? "outward"
      : dynamics === "inward"
        ? "inward"
        : "tangent";
  const extent = Math.sqrt(Math.max(initialV, params.theta, 0.25));
  const autoScale = Math.min(
    244 / Math.max(3.2, extent * 1.15),
    163 / Math.max(2.6, (extent / Math.sqrt(params.stretch)) * 1.15),
  );
  const scale = dragging && drag.current ? drag.current.scale : autoScale;
  const project = (p: Vec2) => ({ x: CX + p.x * scale, y: CY - p.y * scale });
  const state = project(current.point);
  const initial = project(params.initial);
  const boundaryX = Math.sqrt(params.theta) * scale;
  const boundaryY = boundaryX / Math.sqrt(params.stretch);
  const samples = useMemo(() => trajectory(params, 420), [params]);
  const path = (points: Vec2[]) =>
    points
      .map((p, i) => {
        const q = project(p);
        return `${i ? "L" : "M"}${q.x.toFixed(2)},${q.y.toFixed(2)}`;
      })
      .join(" ");
  const historyPath = path([
    ...samples.filter((s) => s.time < time).map((s) => s.point),
    current.point,
  ]);
  const futurePath = path([
    current.point,
    ...samples.filter((s) => s.time > time).map((s) => s.point),
  ]);
  const selectKey = (id: MathId) => (event: KeyboardEvent<SVGElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(id);
    }
  };
  const pointKey = (point: Vec2) => (event: KeyboardEvent<SVGElement>) => {
    selectKey("x")(event);
    const step = event.shiftKey ? 0.25 : 0.1;
    const directions: Record<string, Vec2> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: step },
      ArrowDown: { x: 0, y: -step },
    };
    const d = directions[event.key];
    if (d) {
      event.preventDefault();
      onSelect("x");
      onInitialChange({ x: clamp(point.x + d.x), y: clamp(point.y + d.y) });
    }
  };
  const startDrag = (event: PointerEvent<SVGElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.focus();
    drag.current = {
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      scale,
    };
    svgRef.current?.setPointerCapture(event.pointerId);
    setDragging(true);
    onSelect("x");
  };
  const moveDrag = (event: PointerEvent<SVGSVGElement>) => {
    const session = drag.current;
    if (!session) return;
    if (
      !session.moved &&
      Math.hypot(
        event.clientX - session.startX,
        event.clientY - session.startY,
      ) < 4
    )
      return;
    session.moved = true;
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return;
    const p = svg.createSVGPoint();
    p.x = event.clientX;
    p.y = event.clientY;
    const local = p.matrixTransform(matrix.inverse());
    onInitialChange({
      x: clamp((local.x - CX) / session.scale),
      y: clamp((CY - local.y) / session.scale),
    });
  };
  const endDrag = (event: PointerEvent<SVGSVGElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    drag.current = null;
    setDragging(false);
  };
  const contourColors = [
    "#488983",
    "#488983",
    "#538f7b",
    "#698e70",
    "#858f66",
    "#9d9261",
    "#ae9460",
    "#ba9060",
    "#b48162",
    "#a77060",
    "#99605a",
    "#8e5554",
  ];
  const contourMax = Math.max(initialV * 1.8, params.theta * 2.5, 22);
  const terrainActive = active === "V";
  const pointActive = active === "x" || active === "y";
  const boundaryActive = active === "theta" || active === "y";
  const arrows = [];
  for (let sx = 90; dynamics !== "drift" && sx <= 510; sx += 60) {
    for (let sy = 70; sy <= 370; sy += 60) {
      const p = { x: (sx - CX) / scale, y: (CY - sy) / scale };
      const v = field(p, params);
      const norm = Math.hypot(v.x, v.y);
      if (norm < 0.001) continue;
      const length = 9 + Math.min(norm, 3) * 2;
      arrows.push(
        <line
          key={`${sx}-${sy}`}
          x1={sx}
          y1={sy}
          x2={sx + (v.x / norm) * length}
          y2={sy - (v.y / norm) * length}
        />,
      );
    }
  }

  const boundaryVectors =
    params.dynamics && dynamics !== "lasalle" && dynamics !== "drift"
      ? Array.from({ length: 12 }, (_, i) => {
          const angle = (2 * Math.PI * i) / 12;
          const point = {
            x: Math.sqrt(params.theta) * Math.cos(angle),
            y: Math.sqrt(params.theta / params.stretch) * Math.sin(angle),
          };
          const velocity = field(point, params);
          const derivative = potentialDerivative(point, params);
          const start = project(point);
          const next = project({
            x: point.x + velocity.x * 0.01,
            y: point.y + velocity.y * 0.01,
          });
          const dx = next.x - start.x,
            dy = next.y - start.y;
          const length = Math.hypot(dx, dy);
          if (length < 1e-8) return null;
          const ux = dx / length,
            uy = dy / length;
          const end = { x: start.x + 19 * ux, y: start.y + 19 * uy };
          const color = derivative > 1e-7 ? "#ff8a8a" : "#65e6d0";
          return (
            <g key={i} stroke={color} fill={color}>
              <line
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                strokeWidth="1.8"
              />
              <path
                d={`M${end.x},${end.y} L${end.x - 5 * ux + 2.5 * uy},${end.y - 5 * uy - 2.5 * ux} L${end.x - 5 * ux - 2.5 * uy},${end.y - 5 * uy + 2.5 * ux}Z`}
                stroke="none"
              />
            </g>
          );
        })
      : null;
  const zeroDissipationPath = `M30,${CY} L570,${CY}`;
  const invariantOrigin = { x: CX, y: CY };
  const eLabel = { x: 38, y: CY - 13 };
  const driftOverlay =
    dynamics === "drift"
      ? (() => {
          const velocity = velocityAt(time, params);
          const next = project({
            x: current.point.x + velocity.x * 0.01,
            y: current.point.y + velocity.y * 0.01,
          });
          const dx = next.x - state.x,
            dy = next.y - state.y;
          const length = Math.hypot(dx, dy);
          const ux = length > 1e-9 ? dx / length : 0;
          const uy = length > 1e-9 ? dy / length : 0;
          const end = { x: state.x + 38 * ux, y: state.y + 38 * uy };
          const insidePath = path([
            ...samples
              .filter(
                (sample) => sample.time < time && sample.value <= params.theta,
              )
              .map((sample) => sample.point),
            ...(current.value <= params.theta ? [current.point] : []),
          ]);
          return (
            <g pointerEvents="none">
              <path
                data-testid="interior-trajectory"
                d={insidePath}
                fill="none"
                stroke="#a7b9ff"
                strokeWidth="2.6"
              />
              <g
                data-testid="velocity-vector"
                role="img"
                aria-label="現在の速度方向"
                data-vx={velocity.x}
                data-vy={velocity.y}
                stroke="#b5c6ff"
                fill="#b5c6ff"
              >
                {length > 1e-9 ? (
                  <>
                    <line
                      x1={state.x + 12 * ux}
                      y1={state.y + 12 * uy}
                      x2={end.x}
                      y2={end.y}
                      strokeWidth="2"
                    />
                    <path
                      d={`M${end.x},${end.y} L${end.x - 7 * ux + 3.5 * uy},${end.y - 7 * uy - 3.5 * ux} L${end.x - 7 * ux - 3.5 * uy},${end.y - 7 * uy + 3.5 * ux}Z`}
                      stroke="none"
                    />
                  </>
                ) : (
                  <text
                    x={state.x + 18}
                    y={state.y + 20}
                    fontSize="11"
                    stroke="none"
                  >
                    速度 0
                  </text>
                )}
              </g>
            </g>
          );
        })()
      : null;
  const teachingOverlay = (
    <>
      {driftOverlay}
      {boundaryVectors && (
        <g
          data-testid="boundary-vectors"
          data-direction={boundaryDirection}
          pointerEvents="none"
        >
          {boundaryVectors}
        </g>
      )}
      {dynamics === "lasalle" && (
        <>
          <g
            data-testid="zero-dissipation-set"
            role="button"
            tabIndex={0}
            aria-label="散逸ゼロ集合 E を選択"
            className="svg-target"
            onClick={() => onSelect("derivative")}
            onKeyDown={selectKey("derivative")}
            style={{ cursor: "pointer" }}
          >
            <path
              d={zeroDissipationPath}
              fill="none"
              stroke="#e9bc6a"
              strokeWidth={active === "derivative" ? 3 : 2}
              strokeDasharray="7 5"
            />
            <path
              d={zeroDissipationPath}
              fill="none"
              stroke="transparent"
              strokeWidth="12"
            />
            <text x={eLabel.x} y={eLabel.y - 8} fill="#e9bc6a" fontSize="11">
              {params.rotation === 0 ? "M = E = {x₂ = 0}" : "E = {x₂ = 0}"}
            </text>
          </g>
          {params.rotation !== 0 && (
            <g
              data-testid="invariant-set"
              role="button"
              tabIndex={0}
              aria-label="最大不変集合 M 原点を選択"
              className="svg-target"
              onClick={() => onSelect("x")}
              onKeyDown={selectKey("x")}
              style={{ cursor: "pointer" }}
            >
              <circle
                cx={invariantOrigin.x}
                cy={invariantOrigin.y}
                r="11"
                fill="#8da7ff"
                fillOpacity=".16"
              />
              <circle
                cx={invariantOrigin.x}
                cy={invariantOrigin.y}
                r="4.5"
                fill="#8da7ff"
                stroke="#cfdaff"
                strokeWidth="1"
              />
              <text
                x={invariantOrigin.x + 13}
                y={invariantOrigin.y + 20}
                fill="#b6c7ff"
                fontSize="11"
              >
                M = {"{0}"}
              </text>
            </g>
          )}
        </>
      )}
    </>
  );

  return (
    <div className="state-visual">
      <svg
        ref={svgRef}
        viewBox="0 0 600 440"
        data-testid="state-space"
        role="group"
        aria-label="状態空間。点の位置とTCZ、Lyapunov関数の等高線"
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{
          display: "block",
          width: "100%",
          height: "auto",
          background: "#0b1017",
        }}
      >
        <defs>
          <clipPath id={`${uid}-clip`}>
            <rect x="22" y="20" width="556" height="380" rx="3" />
          </clipPath>
          <filter
            id={`${uid}-glow`}
            x="-100%"
            y="-100%"
            width="300%"
            height="300%"
          >
            <feGaussianBlur stdDeviation="3" />
          </filter>
          <radialGradient id={`${uid}-tcz`}>
            <stop offset="0" stopColor="#65e6d0" stopOpacity=".10" />
            <stop offset="1" stopColor="#65e6d0" stopOpacity=".025" />
          </radialGradient>
          <marker
            id={`${uid}-arrow`}
            viewBox="0 0 6 6"
            refX="4.5"
            refY="3"
            markerWidth="4"
            markerHeight="4"
            orient="auto"
          >
            <path
              d="M0 0L6 3L0 6"
              fill="none"
              stroke="#779399"
              strokeWidth="1"
            />
          </marker>
          <linearGradient id={`${uid}-legend`}>
            <stop stopColor="#488983" />
            <stop offset=".5" stopColor="#ae9460" />
            <stop offset="1" stopColor="#8e5554" />
          </linearGradient>
        </defs>
        <g clipPath={`url(#${uid}-clip)`}>
          <g
            className="svg-target terrain-target"
            role="button"
            tabIndex={0}
            aria-label="Lyapunov関数 V の等高線を選択"
            onClick={() => onSelect("V")}
            onKeyDown={selectKey("V")}
            style={{ cursor: "pointer" }}
          >
            <title>等高線は同じVの値を結びます</title>
            <rect x="22" y="20" width="556" height="380" fill="#0b1017" />
            {[...contourColors].reverse().map((color, i) => {
              const r = ((Math.sqrt(contourMax) * (12 - i)) / 12) * scale;
              return (
                <ellipse
                  key={i}
                  cx={CX}
                  cy={CY}
                  rx={r}
                  ry={r / Math.sqrt(params.stretch)}
                  fill={color}
                  fillOpacity={terrainActive ? 0.037 : 0.017}
                  stroke={color}
                  strokeOpacity={terrainActive ? 0.9 : 0.55}
                  strokeWidth={terrainActive ? 1.5 : 1}
                />
              );
            })}
          </g>
          <g
            stroke="#26323f"
            strokeWidth=".65"
            opacity=".65"
            pointerEvents="none"
          >
            {Array.from({ length: 13 }, (_, i) => i - 6).map((i) => (
              <g key={i}>
                <line
                  x1={CX + i * scale}
                  y1="25"
                  x2={CX + i * scale}
                  y2="395"
                />
                <line
                  x1="27"
                  y1={CY + i * scale}
                  x2="573"
                  y2={CY + i * scale}
                />
              </g>
            ))}
          </g>
          <g stroke="#49616b" strokeWidth="1" pointerEvents="none">
            <line x1="35" y1={CY} x2="565" y2={CY} />
            <line x1={CX} y1="30" x2={CX} y2="390" />
          </g>
          {dynamics !== "drift" && (
            <g
              className="field-arrows"
              stroke="#779399"
              strokeWidth=".9"
              opacity={active === "alpha" ? 0.75 : 0.28}
              markerEnd={`url(#${uid}-arrow)`}
              pointerEvents="none"
            >
              {arrows}
            </g>
          )}
          <ellipse
            className="svg-target"
            cx={CX}
            cy={CY}
            rx={boundaryX}
            ry={boundaryY}
            fill={active === "omega" ? "#65e6d02b" : `url(#${uid}-tcz)`}
            stroke="none"
            role="button"
            tabIndex={0}
            aria-label="TCZ領域 Ωθ を選択"
            onClick={() => onSelect("omega")}
            onKeyDown={selectKey("omega")}
            style={{ cursor: "pointer" }}
          >
            <title>TCZ：V(x) ≤ θ</title>
          </ellipse>
          <ellipse
            cx={CX}
            cy={CY}
            rx={boundaryX}
            ry={boundaryY}
            fill="none"
            stroke={boundaryColor}
            strokeWidth={boundaryActive ? 7 : 3}
            opacity={boundaryActive ? 0.25 : 0.08}
            filter={`url(#${uid}-glow)`}
            pointerEvents="none"
          />
          <ellipse
            className="svg-target"
            cx={CX}
            cy={CY}
            rx={boundaryX}
            ry={boundaryY}
            fill="none"
            stroke={boundaryColor}
            strokeWidth={boundaryActive ? 3 : 1.5}
            opacity={boundaryActive ? 1 : 0.8}
          />
          <ellipse
            cx={CX}
            cy={CY}
            rx={boundaryX}
            ry={boundaryY}
            fill="none"
            stroke="transparent"
            strokeWidth="16"
            role="button"
            tabIndex={0}
            aria-label="TCZの境界 θ を選択"
            onClick={() => onSelect("theta")}
            onKeyDown={selectKey("theta")}
            className="svg-target"
            style={{ cursor: "pointer" }}
          >
            <title>境界：V(x) = θ</title>
          </ellipse>
          <g
            fill="#8db8b0"
            textAnchor="middle"
            pointerEvents="none"
            style={{ fontFamily: "inherit" }}
          >
            <text x={CX} y={CY - 10} fontSize="13" letterSpacing="3">
              TCZ
            </text>
            <text x={CX} y={CY + 13} fontSize="11" fill="#688e89">
              V ≤ θ
            </text>
          </g>
          <path
            d={futurePath}
            fill="none"
            stroke="#9eb8b9"
            strokeWidth="1.2"
            strokeDasharray="3 6"
            opacity=".25"
            pointerEvents="none"
          />
          <path
            d={historyPath}
            fill="none"
            stroke="#65e6d0"
            strokeWidth="5"
            opacity=".13"
            filter={`url(#${uid}-glow)`}
            pointerEvents="none"
          />
          <path
            d={historyPath}
            fill="none"
            stroke="#b5f3e8"
            strokeWidth={pointActive ? 2 : 1.5}
            opacity=".9"
            pointerEvents="none"
          />
          <path
            className="svg-target"
            d={historyPath}
            fill="none"
            stroke="transparent"
            strokeWidth="14"
            role="button"
            tabIndex={0}
            aria-label="状態の軌跡 x(t) を選択"
            onClick={() => onSelect("x")}
            onKeyDown={selectKey("x")}
            style={{ cursor: "pointer" }}
          />
          <g
            fill="#8095a1"
            fontSize="12"
            style={{ fontFamily: "monospace" }}
            pointerEvents="none"
          >
            <text x="554" y={CY - 10}>
              x₁
            </text>
            <text x={CX + 12} y="41">
              x₂
            </text>
            <text x={CX - 15} y={CY + 17}>
              0
            </text>
          </g>
          {teachingOverlay}
          <circle
            cx={initial.x}
            cy={initial.y}
            r="5"
            fill="#101923"
            stroke="#9faeaf"
            strokeWidth="1.5"
            pointerEvents="none"
          />
          {time > 0.3 && (
            <text
              x={initial.x + 12}
              y={initial.y - 12}
              fill="#7f949c"
              fontSize="11"
              pointerEvents="none"
            >
              x(0)
            </text>
          )}
          <circle
            className="svg-target draggable-point"
            cx={initial.x}
            cy={initial.y}
            r="13"
            fill="transparent"
            role="button"
            tabIndex={0}
            aria-label="初期状態。ドラッグか矢印キーで移動"
            onPointerDown={startDrag}
            onClick={() => onSelect("x")}
            onKeyDown={pointKey(params.initial)}
            style={{
              cursor: dragging ? "grabbing" : "grab",
              touchAction: "none",
            }}
          />
          <circle
            cx={state.x}
            cy={state.y}
            r={pointActive ? 19 : 13}
            fill="#65e6d0"
            opacity={pointActive ? 0.23 : 0.13}
            filter={`url(#${uid}-glow)`}
            pointerEvents="none"
          />
          <circle
            cx={state.x}
            cy={state.y}
            r={pointActive ? 11 : 9}
            fill="none"
            stroke="#65e6d0"
            opacity=".4"
            pointerEvents="none"
          />
          <circle
            cx={state.x}
            cy={state.y}
            r="5"
            fill="#d9fff6"
            stroke="#65e6d0"
            strokeWidth="1.5"
            pointerEvents="none"
          />
          <circle
            className="svg-target draggable-point"
            data-testid="state-point"
            data-x={current.point.x}
            data-y={current.point.y}
            cx={state.x}
            cy={state.y}
            r="15"
            fill="transparent"
            role="button"
            tabIndex={0}
            aria-label={`現在状態 x(t)。座標 ${current.point.x.toFixed(2)}, ${current.point.y.toFixed(2)}。ドラッグか矢印キーで初期状態を変更`}
            onPointerDown={startDrag}
            onClick={() => onSelect("x")}
            onKeyDown={pointKey(current.point)}
            style={{
              cursor: dragging ? "grabbing" : "grab",
              touchAction: "none",
            }}
          >
            <title>ドラッグで初期状態を変更</title>
          </circle>
          <g
            transform={`translate(${state.x + (state.x > 450 ? -83 : 17)},${state.y - 33})`}
            pointerEvents="none"
          >
            <rect
              width="69"
              height="25"
              rx="5"
              fill="#101d25"
              stroke="#38534f"
              strokeWidth=".7"
            />
            <text
              x="11"
              y="17"
              fill="#c3f9eb"
              fontSize="12"
              style={{ fontFamily: "monospace" }}
            >
              x(t)
            </text>
            <circle cx="55" cy="12" r="2" fill="#65e6d0" />
          </g>
        </g>
        <g
          transform="translate(32,420)"
          fill="#82939f"
          fontSize="10"
          style={{ fontFamily: "monospace" }}
          pointerEvents="none"
        >
          <text>LOW V</text>
          <rect
            x="44"
            y="-6"
            width="78"
            height="3"
            rx="1.5"
            fill={`url(#${uid}-legend)`}
          />
          <text x="132">HIGH V</text>
          <text x="534" textAnchor="end">
            V(x(t)) = {potential(current.point, params).toFixed(3)}
          </text>
        </g>
      </svg>
      {params.dynamics && (
        <p className="state-help">
          {dynamics === "drift"
            ? "矢印：現在の進行方向。TCZ内の漂遊は追加した可視化モデルです。"
            : dynamics === "lasalle"
              ? params.rotation !== 0
                ? "黄破線：散逸ゼロ集合 E（V̇ = 0）／ 青点：最大不変集合 M"
                : "黄破線：散逸ゼロ集合 E。この設定では線全体が不変で、M = E です。"
              : "境界上の矢印：状態の進む向き（赤は外向き、緑は接線または内向き）"}
        </p>
      )}
      <p className="state-help">
        点をドラッグして初期状態を変更 · 図をクリックすると数式と連動
        <br />
        <span>キーボード：点にフォーカスして矢印キーで移動</span>
      </p>
    </div>
  );
}
