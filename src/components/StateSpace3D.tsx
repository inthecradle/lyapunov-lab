import { useEffect, useId, useMemo, useRef, useState } from "react";
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
import {
  terrainProjection as projection,
  terrainDomain,
} from "../model/terrain";
import type {
  TerrainVertex as Vertex,
  TerrainCamera as Camera,
} from "../model/terrain";

type Props = {
  params: Parameters;
  time: number;
  active: MathId | null;
  onSelect: (id: MathId) => void;
  onInitialChange: (point: Vec2) => void;
};
const clamp = (n: number) => Math.max(-3, Math.min(3, n));
const TAU = Math.PI * 2;

const pointsPath = (points: { x: number; y: number }[], close = false) =>
  points
    .map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ") + (close ? "Z" : "");

export default function StateSpace3D({
  params,
  time,
  active,
  onSelect,
  onInitialChange,
}: Props) {
  const uid = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const [yaw, setYaw] = useState(-28);
  const [elevation, setElevation] = useState(37);
  const [dragging, setDragging] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(
    () => window.matchMedia("(min-width: 761px)").matches,
  );
  useEffect(() => {
    const wideScreen = window.matchMedia("(min-width: 761px)");
    const update = () => setToolsOpen(wideScreen.matches);
    wideScreen.addEventListener("change", update);
    return () => wideScreen.removeEventListener("change", update);
  }, []);
  const drag = useRef<{
    start: Vec2;
    origin: Vec2;
    camera: Camera;
    moved: boolean;
  } | null>(null);
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
  const autoMaxV = Math.max(initialV * 1.32, params.theta * 3.1, 4);
  const maxV = dragging && drag.current ? drag.current.camera.maxV : autoMaxV;
  const camera = useMemo(
    () => ({ yaw, elevation, maxV, stretch: params.stretch }),
    [yaw, elevation, maxV, params.stretch],
  );
  const view = useMemo(() => projection(camera), [camera]);
  const surfacePoint = (point: Vec2) =>
    view.point({ ...point, z: potential(point, params) });
  const state = surfacePoint(current.point);
  const initial = surfacePoint(params.initial);
  const ground = view.point({ ...current.point, z: maxV });
  const threshold = view.point({ ...current.point, z: params.theta });
  const boundaryActive = active === "theta" || active === "y";
  const pointActive = active === "x" || active === "y";

  // A rectangular sheet with a smooth central well; all vertices still carry
  // the real V, and projection alone compresses its displayed height.
  const mesh = useMemo(() => {
    const domain = terrainDomain(camera);
    const make = (u: number, v: number): Vertex => {
      const x = u * domain.x,
        y = v * domain.y;
      return { x, y, z: x * x + params.stretch * y * y };
    };
    const patches = [];
    const steps = 36;
    for (let row = 0; row < steps; row++) {
      for (let col = 0; col < steps; col++) {
        const u = (2 * col) / steps - 1,
          v = (2 * row) / steps - 1;
        const world = [
          make(u, v),
          make(u + 2 / steps, v),
          make(u + 2 / steps, v + 2 / steps),
          make(u, v + 2 / steps),
        ];
        const vertices = world.map(view.point);
        const well = Math.max(
          0,
          1 - make(u + 1 / steps, v + 1 / steps).z / (0.85 * maxV),
        );
        patches.push({
          key: `${row}-${col}`,
          d: pointsPath(vertices, true),
          depth: vertices.reduce((sum, p) => sum + p.depth, 0) / 4,
          color: `hsl(${205 - 35 * well} ${28 + 10 * well}% ${12 + 10 * well}%)`,
        });
      }
    }
    const grid = [];
    for (let i = 0; i <= 24; i++) {
      const fixed = i / 12 - 1;
      grid.push(
        pointsPath(
          Array.from({ length: 97 }, (_, j) =>
            view.point(make(fixed, j / 48 - 1)),
          ),
        ),
      );
      grid.push(
        pointsPath(
          Array.from({ length: 97 }, (_, j) =>
            view.point(make(j / 48 - 1, fixed)),
          ),
        ),
      );
    }
    const atRing = (r: number, angle: number) =>
      view.point({
        x: Math.sqrt(params.theta) * r * Math.cos(angle),
        y: Math.sqrt(params.theta / params.stretch) * r * Math.sin(angle),
        z: params.theta * r * r,
      });
    const tcz = [];
    for (let ring = 1; ring <= 8; ring++) {
      for (let i = 0; i < 64; i++) {
        const a = (TAU * i) / 64,
          b = (TAU * (i + 1)) / 64;
        const vertices = [
          atRing((ring - 1) / 8, a),
          atRing(ring / 8, a),
          atRing(ring / 8, b),
          atRing((ring - 1) / 8, b),
        ];
        tcz.push({
          key: `${ring}-${i}`,
          d: pointsPath(vertices, true),
          depth: vertices.reduce((sum, point) => sum + point.depth, 0) / 4,
        });
      }
    }
    return {
      patches: patches.sort((a, b) => a.depth - b.depth),
      tcz: tcz.sort((a, b) => a.depth - b.depth),
      grid,
      boundary: pointsPath(
        Array.from({ length: 129 }, (_, i) => atRing(1, (TAU * i) / 128)),
        true,
      ),
      perimeter: pointsPath(
        [make(-1, -1), make(1, -1), make(1, 1), make(-1, 1)].map(view.point),
        true,
      ),
    };
  }, [params.stretch, params.theta, maxV, camera, view]);
  const terrainActive = active === "V";
  const tczActive = active === "omega";
  const surfaceFaces = useMemo(
    () =>
      mesh.patches.map((patch) => (
        <path
          key={patch.key}
          d={patch.d}
          fill={patch.color}
          fillOpacity={terrainActive ? 0.85 : 0.62}
          stroke={patch.color}
          strokeWidth=".25"
        />
      )),
    [mesh, terrainActive],
  );
  const tczFaces = useMemo(
    () =>
      mesh.tcz.map((patch) => (
        <path
          key={patch.key}
          d={patch.d}
          fill="#65e6d0"
          fillOpacity={tczActive ? 0.42 : 0.19}
          stroke="none"
        />
      )),
    [mesh, tczActive],
  );
  const samples = useMemo(() => trajectory(params, 360), [params]);
  const history = pointsPath([
    ...samples.filter((s) => s.time < time).map((s) => surfacePoint(s.point)),
    state,
  ]);
  const future = pointsPath([
    state,
    ...samples.filter((s) => s.time > time).map((s) => surfacePoint(s.point)),
  ]);
  const keySelect = (id: MathId) => (event: KeyboardEvent<SVGElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(id);
    }
  };
  const pointKey = (point: Vec2) => (event: KeyboardEvent<SVGElement>) => {
    keySelect("x")(event);
    const step = event.shiftKey ? 0.25 : 0.1;
    const delta: Record<string, Vec2> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: step },
      ArrowDown: { x: 0, y: -step },
    };
    const d = delta[event.key];
    if (d) {
      event.preventDefault();
      onSelect("x");
      onInitialChange({ x: clamp(point.x + d.x), y: clamp(point.y + d.y) });
    }
  };
  const localPoint = (event: PointerEvent<SVGElement>): Vec2 | null => {
    const svg = svgRef.current,
      matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return null;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(matrix.inverse());
  };
  const startDrag = (origin: Vec2) => (event: PointerEvent<SVGElement>) => {
    if (event.button !== 0) return;
    const start = localPoint(event);
    if (!start) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.focus();
    drag.current = { start, origin, camera, moved: false };
    svgRef.current?.setPointerCapture(event.pointerId);
    setDragging(true);
    onSelect("x");
  };
  const moveDrag = (event: PointerEvent<SVGSVGElement>) => {
    const session = drag.current,
      local = localPoint(event);
    if (!session || !local) return;
    const dx = local.x - session.start.x,
      dy = local.y - session.start.y;
    if (!session.moved && Math.hypot(dx, dy) < 4) return;
    session.moved = true;
    // Drag deltas move in the underlying state plane. Freeze the camera and
    // scale during the gesture to avoid a feedback jump as initial V changes.
    const p = projection(session.camera),
      horizontal = dx / p.scale,
      forward = dy / (p.scale * p.se);
    onInitialChange({
      x: clamp(session.origin.x + p.c * horizontal + p.s * forward),
      y: clamp(session.origin.y - p.s * horizontal + p.c * forward),
    });
  };
  const endDrag = (event: PointerEvent<SVGSVGElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    drag.current = null;
    setDragging(false);
  };
  const origin = view.point({ x: 0, y: 0, z: 0 });
  const planeOrigin = view.point({ x: 0, y: 0, z: maxV });
  const axes = [
    {
      label: "x₁",
      end: view.point({ x: Math.sqrt(maxV) * 1.12, y: 0, z: maxV }),
    },
    {
      label: "x₂",
      end: view.point({
        x: 0,
        y: Math.sqrt(maxV / params.stretch) * 1.12,
        z: maxV,
      }),
    },
  ].map((axis) => {
    const dx = axis.end.x - origin.x,
      dy = axis.end.y - origin.y;
    const fit = Math.min(
      1,
      dx > 0 ? (564 - origin.x) / dx : dx < 0 ? (24 - origin.x) / dx : 1,
      dy > 0 ? (384 - origin.y) / dy : dy < 0 ? (48 - origin.y) / dy : 1,
    );
    return { ...axis, end: { x: origin.x + dx * fit, y: origin.y + dy * fit } };
  });

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
          const start = view.point({ ...point, z: params.theta });
          const next = view.point({
            x: point.x + velocity.x * 0.01,
            y: point.y + velocity.y * 0.01,
            z: params.theta + derivative * 0.01,
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
  const zeroDissipationPath = pointsPath(
    Array.from({ length: 81 }, (_, i) => {
      const x = Math.sqrt(maxV) * (i / 40 - 1);
      return view.point({ x, y: 0, z: x * x });
    }),
  );
  const invariantOrigin = origin;
  const eLabel = view.point({
    x: -Math.sqrt(maxV) * 0.76,
    y: 0,
    z: maxV * 0.76 ** 2,
  });
  const driftOverlay =
    dynamics === "drift"
      ? (() => {
          const velocity = velocityAt(time, params);
          const next = view.point({
            x: current.point.x + velocity.x * 0.01,
            y: current.point.y + velocity.y * 0.01,
            z: current.value + current.derivative * 0.01,
          });
          const dx = next.x - state.x,
            dy = next.y - state.y;
          const length = Math.hypot(dx, dy);
          const ux = length > 1e-9 ? dx / length : 0;
          const uy = length > 1e-9 ? dy / length : 0;
          const end = { x: state.x + 38 * ux, y: state.y + 38 * uy };
          const insidePath = pointsPath([
            ...samples
              .filter(
                (sample) => sample.time < time && sample.value <= params.theta,
              )
              .map((sample) => surfacePoint(sample.point)),
            ...(current.value <= params.theta ? [state] : []),
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
            onKeyDown={keySelect("derivative")}
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
              onKeyDown={keySelect("x")}
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
        data-view="3d"
        role="group"
        aria-label="3D状態空間。平面の中央に窪みがあり、高さはLyapunov関数Vを圧縮表示。明るい点は現在状態"
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
          <radialGradient id={`${uid}-sphere`} cx="30%" cy="25%">
            <stop stopColor="#ffffff" />
            <stop offset=".42" stopColor="#bfffee" />
            <stop offset="1" stopColor="#249d98" />
          </radialGradient>
          <linearGradient id={`${uid}-legend`}>
            <stop stopColor="#3d988a" />
            <stop offset=".55" stopColor="#547d9f" />
            <stop offset="1" stopColor="#9fbed5" />
          </linearGradient>
          <filter
            id={`${uid}-glow`}
            x="-100%"
            y="-100%"
            width="300%"
            height="300%"
          >
            <feGaussianBlur stdDeviation="3" />
          </filter>
          <clipPath id={`${uid}-clip`}>
            <rect x="12" y="35" width="576" height="366" />
          </clipPath>
        </defs>
        <g pointerEvents="none" fill="#899ba8" fontSize="11">
          <text x="28" y="26">
            高さはVを圧縮表示
          </text>
          <text x="572" y="26" textAnchor="end" fill="#65e6d0">
            3D POTENTIAL
          </text>
        </g>
        <g clipPath={`url(#${uid}-clip)`}>
          <g
            stroke="#51697d"
            strokeWidth=".8"
            pointerEvents="none"
            opacity=".32"
          >
            {axes.map((axis) => (
              <line
                key={axis.label}
                x1={planeOrigin.x}
                y1={planeOrigin.y}
                x2={axis.end.x}
                y2={axis.end.y}
              />
            ))}
          </g>
          <g
            role="button"
            tabIndex={0}
            aria-label="Lyapunov関数 V の等高線を選択"
            className="svg-target terrain-target"
            data-testid="potential-surface"
            data-shape="plane-with-well"
            onClick={() => onSelect("V")}
            onKeyDown={keySelect("V")}
            style={{ cursor: "pointer" }}
          >
            <title>
              Vを高さ方向に圧縮した矩形格子です。中央は低く、外側は平面に滑らかにつながります。
            </title>
            {surfaceFaces}
            <g
              fill="none"
              stroke={active === "V" ? "#c0eee9" : "#7eb6c9"}
              strokeWidth={active === "V" ? 0.95 : 0.72}
              opacity={active === "V" ? 0.78 : 0.49}
            >
              {mesh.grid.map((d, i) => (
                <path key={i} d={d} />
              ))}
            </g>
            <path
              d={mesh.perimeter}
              fill="none"
              stroke="#a7c3d6"
              strokeWidth="1"
              opacity=".65"
            />
          </g>
          <g
            role="button"
            tabIndex={0}
            aria-label="TCZ領域 Ωθ を選択"
            className="svg-target"
            onClick={() => onSelect("omega")}
            onKeyDown={keySelect("omega")}
            style={{ cursor: "pointer" }}
          >
            <title>曲面上の緑の領域：V ≤ θ</title>
            {tczFaces}
          </g>
          <path
            d={mesh.boundary}
            fill="none"
            stroke={boundaryColor}
            strokeWidth="7"
            opacity=".24"
            filter={`url(#${uid}-glow)`}
            pointerEvents="none"
          />
          <path
            d={mesh.boundary}
            fill="none"
            stroke={boundaryColor}
            strokeWidth={boundaryActive ? 3 : 1.7}
            pointerEvents="none"
          />
          <path
            d={mesh.boundary}
            fill="none"
            stroke="transparent"
            strokeWidth="14"
            role="button"
            tabIndex={0}
            aria-label="TCZの境界 θ を選択"
            className="svg-target"
            onClick={() => onSelect("theta")}
            onKeyDown={keySelect("theta")}
            style={{ cursor: "pointer" }}
          />
          <g pointerEvents="none">
            <line
              x1={state.x}
              y1={state.y}
              x2={ground.x}
              y2={ground.y}
              stroke="#aebcc5"
              strokeWidth=".9"
              strokeDasharray="3 5"
              opacity=".48"
            />
            <circle
              cx={ground.x}
              cy={ground.y}
              r="3"
              fill="#9dafb5"
              opacity=".55"
            />
            {current.residual > 0.015 && (
              <g stroke="#8da7ff" strokeWidth={active === "y" ? 2.5 : 1.3}>
                <line
                  x1={state.x + 13}
                  y1={state.y}
                  x2={threshold.x + 13}
                  y2={threshold.y}
                />
                <line
                  x1={state.x + 9}
                  y1={state.y}
                  x2={state.x + 17}
                  y2={state.y}
                />
                <line
                  x1={threshold.x + 9}
                  y1={threshold.y}
                  x2={threshold.x + 17}
                  y2={threshold.y}
                />
              </g>
            )}
            <path
              d={future}
              fill="none"
              stroke="#d0e4e3"
              strokeWidth="1.2"
              strokeDasharray="3 5"
              opacity=".3"
            />
            <path
              d={history}
              fill="none"
              stroke="#0b171c"
              strokeWidth="4.5"
              opacity=".6"
            />
            <path
              d={history}
              fill="none"
              stroke="#d2fff4"
              strokeWidth={pointActive ? 2.4 : 1.8}
            />
          </g>
          <path
            d={history}
            fill="none"
            stroke="transparent"
            strokeWidth="12"
            role="button"
            tabIndex={0}
            aria-label="状態の軌跡 x(t) を選択"
            className="svg-target"
            onClick={() => onSelect("x")}
            onKeyDown={keySelect("x")}
          />
          {teachingOverlay}
          <g pointerEvents="none" fill="#a8b9c2" fontSize="12">
            {axes.map((axis) => (
              <text key={axis.label} x={axis.end.x + 8} y={axis.end.y + 5}>
                {axis.label}
              </text>
            ))}
            <text x={origin.x - 15} y={origin.y + 17}>
              0
            </text>
            <text x="35" y="82" fill="#aebfcd">
              V
            </text>
            <path
              d="M41 91V155M37 96L41 90L45 96"
              stroke="#718798"
              fill="none"
            />
            <text
              x={origin.x}
              y={origin.y - 14}
              textAnchor="middle"
              fill="#a4e6d9"
              fontSize="12"
            >
              TCZ · V ≤ θ
            </text>
            <circle
              cx={initial.x}
              cy={initial.y}
              r="4.5"
              fill="#17232b"
              stroke="#d4ccc0"
              strokeWidth="1.5"
            />
            {time > 0.3 && (
              <text x={initial.x + 9} y={initial.y - 10} fontSize="11">
                x(0)
              </text>
            )}
          </g>
          <circle
            cx={initial.x}
            cy={initial.y}
            r="13"
            fill="transparent"
            role="button"
            tabIndex={0}
            aria-label="初期状態。ドラッグか矢印キーで移動"
            className="svg-target draggable-point"
            onPointerDown={startDrag(params.initial)}
            onClick={() => onSelect("x")}
            onKeyDown={pointKey(params.initial)}
            style={{
              cursor: dragging ? "grabbing" : "grab",
              touchAction: "none",
            }}
          />
          <g pointerEvents="none">
            <circle
              cx={state.x}
              cy={state.y}
              r={pointActive ? 20 : 14}
              fill="#65e6d0"
              opacity=".32"
              filter={`url(#${uid}-glow)`}
            />
            <circle
              cx={state.x}
              cy={state.y}
              r={pointActive ? 8 : 6.5}
              fill={`url(#${uid}-sphere)`}
              stroke="#d1ffef"
              strokeWidth=".8"
            />
            <g
              transform={`translate(${Math.min(467, Math.max(18, state.x + 21))},${Math.max(40, state.y - 33)})`}
            >
              <rect
                width="99"
                height="27"
                rx="5"
                fill="#0d1c25"
                stroke="#46665e"
                strokeWidth=".8"
              />
              <text x="9" y="18" fill="#d1fff0" fontSize="11">
                x(t) · V {current.value.toFixed(2)}
              </text>
            </g>
          </g>
          <circle
            data-testid="state-point"
            data-x={current.point.x}
            data-y={current.point.y}
            data-height={current.value}
            cx={state.x}
            cy={state.y}
            r="15"
            fill="transparent"
            role="button"
            tabIndex={0}
            aria-label={`現在状態 x(t)。座標 ${current.point.x.toFixed(2)}, ${current.point.y.toFixed(2)}。ドラッグか矢印キーで初期状態を変更`}
            className="svg-target draggable-point"
            onPointerDown={startDrag(current.point)}
            onClick={() => onSelect("x")}
            onKeyDown={pointKey(current.point)}
            style={{
              cursor: dragging ? "grabbing" : "grab",
              touchAction: "none",
            }}
          />
        </g>
        <g
          transform="translate(28,420)"
          pointerEvents="none"
          fill="#8e9faa"
          fontSize="10"
        >
          <text>LOW V</text>
          <rect
            x="44"
            y="-6"
            width="75"
            height="3"
            rx="1.5"
            fill={`url(#${uid}-legend)`}
          />
          <text x="129">HIGH V</text>
          <text x="544" textAnchor="end">
            TCZの閾値 θ = {params.theta.toFixed(2)}
          </text>
        </g>
      </svg>
      <details
        className="state-tools"
        open={toolsOpen}
        onToggle={(event) => setToolsOpen(event.currentTarget.open)}
      >
        <summary>視点・操作ガイド</summary>
        <div
          style={{
            display: "flex",
            gap: "18px",
            flexWrap: "wrap",
            padding: "4px 24px 0",
            color: "#a4b4c2",
            fontSize: "11px",
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flex: "1 1 180px",
            }}
          >
            <span style={{ whiteSpace: "nowrap", flexShrink: 0 }}>回転</span>
            <input
              aria-label="3D視点の回転"
              type="range"
              min="-80"
              max="80"
              step="1"
              value={yaw}
              onChange={(e) => setYaw(Number(e.target.value))}
              style={{ minWidth: 0, width: "100%", accentColor: "#65e6d0" }}
            />
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flex: "1 1 180px",
            }}
          >
            <span style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
              見下ろす角度
            </span>
            <input
              aria-label="3D視点の仰角"
              type="range"
              min="22"
              max="65"
              step="1"
              value={elevation}
              onChange={(e) => setElevation(Number(e.target.value))}
              style={{ minWidth: 0, width: "100%", accentColor: "#65e6d0" }}
            />
          </label>
        </div>
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
          点をドラッグして状態平面上の初期位置を変更 ·
          矢印キーでも移動できます。
          <br />
          <span>
            高さはVを圧縮表示しています。物理的な時空や重力の再現ではありません。
          </span>
        </p>
      </details>
    </div>
  );
}
