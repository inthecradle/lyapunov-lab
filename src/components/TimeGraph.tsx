import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  DURATION,
  guarantees,
  dynamicsOf,
  driftTiming,
  sampleAt,
  trajectory,
  type Parameters,
} from "../model/lyapunov";
import type { MathId } from "../interaction";

type Props = {
  params: Parameters;
  time: number;
  active: MathId | null;
  onSelect: (id: MathId) => void;
  onTimeChange: (time: number) => void;
};
export default function TimeGraph({
  params,
  time,
  active,
  onSelect,
  onTimeChange,
}: Props) {
  const [view, setView] = useState<"y" | "V">("y");
  const dynamics = dynamicsOf(params);
  const validComparison = guarantees(params).comparison;
  const isLasalle = dynamics === "lasalle";
  const entryTime = dynamics === "drift" ? driftTiming(params).entryTime : null;
  useEffect(() => {
    setView(dynamics === "lasalle" ? "V" : "y");
  }, [dynamics]);
  const svgRef = useRef<SVGSVGElement>(null);
  const points = useMemo(() => trajectory(params, 240), [params]);
  const current = sampleAt(time, params);
  const initial = points[0];
  const outside = initial.residual > 1e-10;
  const showComparison = outside && !isLasalle;
  const left = 48,
    right = 454,
    top = 22,
    bottom = 212;
  const low =
    view === "y" ? Math.min(-0.12, ...points.map((p) => p.residual * 1.18)) : 0;
  const high = Math.max(
    ...points.map((p) => (view === "V" ? p.value * 1.12 : p.residual * 1.14)),
    view === "V" ? params.theta * 1.3 : 1,
  );
  const px = (t: number) => left + (t / DURATION) * (right - left);
  const py = (value: number) =>
    bottom - ((value - low) / (high - low)) * (bottom - top);
  const value = view === "y" ? current.residual : current.value;
  const path = (bound: boolean) =>
    points
      .map(
        (p, i) =>
          `${i ? "L" : "M"}${px(p.time).toFixed(2)},${py(bound ? p.bound + (view === "V" ? params.theta : 0) : view === "V" ? p.value : p.residual).toFixed(2)}`,
      )
      .join(" ");
  const actualPath = path(false);
  const selectCurve = (id: MathId) => ({
    role: "button" as const,
    tabIndex: 0,
    onPointerDown: (event: React.PointerEvent<SVGPathElement>) =>
      event.stopPropagation(),
    onClick: () => onSelect(id),
    onKeyDown: (event: React.KeyboardEvent<SVGPathElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSelect(id);
      }
    },
    style: { cursor: "pointer" },
  });
  const seek = (event: PointerEvent<SVGSVGElement>) => {
    const matrix = svgRef.current?.getScreenCTM();
    if (!matrix) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      matrix.inverse(),
    );
    onTimeChange(
      Math.max(
        0,
        Math.min(DURATION, ((point.x - left) / (right - left)) * DURATION),
      ),
    );
  };
  const tangent = `M ${px(time - 0.6)},${py(value - 0.6 * current.derivative)} L ${px(time + 0.6)},${py(value + 0.6 * current.derivative)}`;
  return (
    <>
      <div className="graph-readout">
        <button
          className={`readout ${active === "y" || active === "V" ? "lit-text" : ""}`}
          onClick={() => onSelect(view)}
          aria-label="グラフの現在値を選択"
        >
          <span>{view === "y" ? "y(t)" : "V(x(t))"}</span>
          <strong data-testid="graph-value">{value.toFixed(3)}</strong>
        </button>
        <div className="segmented small" aria-label="グラフの表示量">
          <button aria-pressed={view === "y"} onClick={() => setView("y")}>
            残り量 y
          </button>
          <button aria-pressed={view === "V"} onClick={() => setView("V")}>
            高さ V
          </button>
        </div>
      </div>
      <svg
        ref={svgRef}
        className="time-graph"
        viewBox="0 0 480 246"
        aria-label="時間グラフ。下の時間スライダーでも操作できます。"
        data-testid="time-graph"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          onSelect(view);
          e.currentTarget.setPointerCapture(e.pointerId);
          seek(e);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) seek(e);
        }}
        onPointerUp={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
        }}
      >
        <defs>
          <clipPath id="graph-clip">
            <rect x={left} y={top} width={right - left} height={bottom - top} />
          </clipPath>
          <clipPath id="graph-played">
            <rect
              x={left}
              y={top}
              width={px(time) - left}
              height={bottom - top}
            />
          </clipPath>
          <linearGradient id="graph-fill" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#65e6d0" stopOpacity=".14" />
            <stop offset="1" stopColor="#65e6d0" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((i) => {
          const v = low + ((high - low) * i) / 4;
          return (
            <g key={i}>
              <line
                x1={left}
                x2={right}
                y1={py(v)}
                y2={py(v)}
                className="grid-line"
              />
              <text x={left - 10} y={py(v) + 4} textAnchor="end">
                {v.toFixed(1)}
              </text>
            </g>
          );
        })}
        {[0, 2, 4, 6, 8, 10, 12].map((t) => (
          <g key={t}>
            <line
              x1={px(t)}
              x2={px(t)}
              y1={top}
              y2={bottom}
              className="grid-line"
            />
            <text x={px(t)} y={bottom + 22} textAnchor="middle">
              {t}
            </text>
          </g>
        ))}
        <text x={right + 8} y={bottom + 22}>
          t
        </text>
        <g clipPath="url(#graph-clip)">
          {entryTime !== null && entryTime > 0 && entryTime <= DURATION && (
            <g
              data-testid="entry-marker"
              data-time={entryTime}
              pointerEvents="none"
            >
              <line
                x1={px(entryTime)}
                x2={px(entryTime)}
                y1={top}
                y2={bottom}
                stroke="#91caff"
                strokeDasharray="3 4"
                opacity=".6"
              />
              <text
                x={Math.min(right - 66, px(entryTime) + 5)}
                y={top + 12}
                fill="#91caff"
              >
                TCZ到達
              </text>
            </g>
          )}
          <line
            x1={left}
            x2={right}
            y1={py(view === "V" ? params.theta : 0)}
            y2={py(view === "V" ? params.theta : 0)}
            stroke="#617683"
            strokeDasharray="3 5"
          />
          <path
            d={`${actualPath} L${right},${py(view === "V" ? params.theta : 0)} L${left},${py(view === "V" ? params.theta : 0)} Z`}
            fill="url(#graph-fill)"
          />
          {showComparison && (
            <path
              d={path(true)}
              fill="none"
              stroke={validComparison ? "#8da7ff" : "#8794a2"}
              strokeWidth={
                active === "comparison" || active === "alpha" ? 3.5 : 1.8
              }
              strokeDasharray="7 6"
            />
          )}
          <path
            d={actualPath}
            fill="none"
            stroke="#65e6d0"
            opacity=".4"
            strokeWidth="2"
          />
          <path
            d={actualPath}
            fill="none"
            stroke="#65e6d0"
            strokeWidth={active === view ? 3.5 : 2.5}
            clipPath="url(#graph-played)"
          />
          <line
            x1={px(time)}
            x2={px(time)}
            y1={top}
            y2={bottom}
            stroke="#dce6f5"
            opacity=".3"
          />
          <path
            d={tangent}
            fill="none"
            stroke="#ffcc66"
            strokeWidth={active === "derivative" ? 4 : 2}
          />
          <circle
            cx={px(time)}
            cy={py(value)}
            r="5"
            fill="#e8eef5"
            stroke="#65e6d0"
            strokeWidth="2"
            data-testid="graph-cursor"
            data-time={time}
          />
          <path
            d={actualPath}
            fill="none"
            stroke="transparent"
            strokeWidth="12"
            aria-label="実際の曲線を選択"
            {...selectCurve(view)}
          />
          {showComparison && (
            <path
              d={path(true)}
              fill="none"
              stroke="transparent"
              strokeWidth="12"
              aria-label={
                validComparison
                  ? "比較上限の曲線を選択"
                  : "参考曲線（保証なし）を選択"
              }
              {...selectCurve("comparison")}
            />
          )}
          <path
            d={tangent}
            fill="none"
            stroke="transparent"
            strokeWidth="12"
            aria-label="接線を選択"
            {...selectCurve("derivative")}
          />
        </g>
      </svg>
      <div className="graph-legend">
        <button
          className={active === view ? "lit-text" : ""}
          onClick={() => onSelect(view)}
        >
          <i className="line-key actual" />
          実際の{view === "y" ? "y(t)" : "V(t)"}
        </button>
        <button
          disabled={!showComparison}
          className={active === "comparison" ? "lit-text" : ""}
          onClick={() => onSelect("comparison")}
        >
          <i
            className={`line-key bound ${validComparison ? "" : "unverified"}`}
          />
          {isLasalle
            ? "指数上限は使用しません"
            : validComparison
              ? "保証される上限"
              : "参考曲線（保証なし）"}
        </button>
        <button
          className={active === "derivative" ? "lit-text" : ""}
          onClick={() => onSelect("derivative")}
        >
          <i className="line-key tangent" />
          接線
        </button>
      </div>
      {!outside && (
        <p className="inline-note">
          {guarantees(params).forwardInvariant
            ? "初期状態はTCZ内です。この場ではTCZ内を保ちます。"
            : "初期状態はTCZ内ですが、この場では外へ出る場合があります。"}
        </p>
      )}
      {dynamics === "drift" && (
        <p className="inline-note">
          到達後は y ≤ 0（V ≤
          θ）の範囲で増減します。内部の漂遊は、この教材で加えた可視化です。
        </p>
      )}
      <div className="slope-readout">
        <span>
          現在の傾き <b>{view === "V" ? "V̇(t)" : "ẏ(t)"}</b>
        </span>
        <strong data-testid="derivative">
          {current.derivative.toFixed(3)}
        </strong>
        <span>
          {current.derivative < -1e-9
            ? "評価量が減少しています"
            : current.derivative > 1e-9
              ? "評価量が増加しています"
              : "表示精度では、傾きはほぼ0です"}
        </span>
      </div>
    </>
  );
}
