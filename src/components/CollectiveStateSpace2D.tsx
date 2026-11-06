import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  EDGE_PAIRS,
  lubOf,
  type CollectiveParameters,
  type CollectiveSample,
  type Point,
} from "../model/collective";
import {
  COLLECTIVE_COLORS as COLORS,
  type CollectiveFocus,
} from "./collectivePresentation";

const px = (value: number) => 48 + value * 330;
const py = (value: number) => 370 - value * 330;

type Props = {
  parameters: CollectiveParameters;
  current: CollectiveSample;
  samples: CollectiveSample[];
  selected: number;
  focus: CollectiveFocus;
  onSelect: (index: number) => void;
  onFocus: (focus: `pair${number}`) => void;
  onMove: (index: number, point: Point) => void;
  onEditStart: () => void;
};

export default function CollectiveStateSpace2D({
  parameters,
  current,
  samples,
  selected,
  focus,
  onSelect,
  onFocus,
  onMove,
  onEditStart,
}: Props) {
  const theorem = parameters.theorem;
  const lub = lubOf(parameters.worlds);
  const drag = useRef<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const dragPoint = (
    event: ReactPointerEvent<SVGSVGElement>,
    index: number,
  ) => {
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      matrix.inverse(),
    );
    onMove(index, { x: (point.x - 48) / 330, y: (370 - point.y) / 330 });
  };
  return (
    <svg
      ref={svg}
      viewBox="0 0 430 415"
      className="cl-state"
      aria-label="共有表象の状態平面。主体をドラッグまたは矢印キーで移動"
      data-testid="cl-state-svg"
      onPointerMove={(e) => {
        if (drag.current !== null) dragPoint(e, drag.current);
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    >
      <rect
        x="48"
        y="40"
        width="330"
        height="330"
        rx="3"
        fill="#0c141d"
        stroke="#324251"
      />
      {[0, 0.25, 0.5, 0.75, 1].map((v) => (
        <g key={v}>
          <line x1={px(v)} x2={px(v)} y1="40" y2="370" className="cl-grid" />
          <line x1="48" x2="378" y1={py(v)} y2={py(v)} className="cl-grid" />
          <text x={px(v)} y="389" textAnchor="middle">
            {v}
          </text>
          <text x="35" y={py(v) + 4} textAnchor="end">
            {v}
          </text>
        </g>
      ))}
      <text x="214" y="409" textAnchor="middle">
        共有表象の成分 1
      </text>
      <text x="8" y="25">
        成分 2
      </text>
      {theorem === 3 && (
        <>
          {parameters.worlds.map((w, i) => (
            <g
              key={`world${i}`}
              data-testid={`collective-world-${i}`}
              data-x={w.x}
              data-y={w.y}
            >
              <rect
                x={px(w.x) - 5}
                y={py(w.y) - 5}
                width="10"
                height="10"
                stroke={COLORS[i]}
                fill="none"
                strokeDasharray="2 2"
              />
              <text x={px(w.x) + 9} y={py(w.y) + 15}>
                w{i + 1}
              </text>
            </g>
          ))}
          <line
            x1={px(lub.x)}
            x2={px(lub.x)}
            y1="40"
            y2="370"
            stroke="#d3a6ff55"
            strokeDasharray="3 5"
          />
          <line
            x1="48"
            x2="378"
            y1={py(lub.y)}
            y2={py(lub.y)}
            stroke="#d3a6ff55"
            strokeDasharray="3 5"
          />
          <g data-testid="collective-lub" data-x={lub.x} data-y={lub.y}>
            <path
              d={`M${px(lub.x)},${py(lub.y) - 9}l9,9l-9,9l-9,-9Z`}
              fill="#d3a6ff22"
              stroke="#d3a6ff"
              strokeWidth="2"
            />
            <text
              x={px(lub.x) + 13}
              y={py(lub.y) - 12}
              className="cl-lub-label"
            >
              LUB
            </text>
          </g>
        </>
      )}
      {COLORS.map((color, i) => (
        <path
          key={`trail${i}`}
          d={samples
            .filter((s) => s.time <= current.time)
            .concat(current)
            .map(
              (s, j) =>
                `${j ? "L" : "M"}${px(s.positions[i].x)},${py(s.positions[i].y)}`,
            )
            .join(" ")}
          fill="none"
          stroke={color}
          strokeOpacity="0.4"
          strokeWidth="1.5"
        />
      ))}
      {EDGE_PAIRS.map(([a, b], i) => {
        const start = current.positions[a],
          end = current.positions[b];
        const active = parameters.gamma[i] > 0;
        return (
          <g
            key={`edge${i}`}
            className="cl-edge"
            data-testid={`collective-edge-${i}`}
            role="button"
            tabIndex={0}
            aria-label={`主体${a + 1}と${b + 1}の不一致を選択`}
            aria-pressed={focus === `pair${i}`}
            onClick={() => onFocus(`pair${i}`)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onFocus(`pair${i}`);
              }
            }}
          >
            <line
              x1={px(start.x)}
              y1={py(start.y)}
              x2={px(end.x)}
              y2={py(end.y)}
              stroke="transparent"
              strokeWidth="16"
            />
            <line
              x1={px(start.x)}
              y1={py(start.y)}
              x2={px(end.x)}
              y2={py(end.y)}
              stroke={
                focus === `pair${i}`
                  ? "#fff"
                  : current.pairCosts[i] > 0.03
                    ? "#ffcc80"
                    : "#65e6d0"
              }
              strokeWidth={active ? 1 + parameters.gamma[i] * 2.2 : 1}
              strokeOpacity={active ? 0.8 : 0.2}
              strokeDasharray={active ? undefined : "4 6"}
            />
          </g>
        );
      })}
      {current.positions.map((point, i) => (
        <g
          key={i}
          role="button"
          tabIndex={0}
          aria-label={`主体${i + 1}の初期位置を移動`}
          aria-pressed={selected === i}
          data-testid={`collective-point-${i}`}
          data-x={point.x}
          data-y={point.y}
          className="cl-agent"
          onPointerDown={(e) => {
            e.preventDefault();
            selected !== i && onSelect(i);
            drag.current = i;
            svg.current?.setPointerCapture(e.pointerId);
            onEditStart();
          }}
          onKeyDown={(e) => {
            const delta = e.shiftKey ? 0.1 : 0.02;
            const offsets: Record<string, Point> = {
              ArrowLeft: { x: -delta, y: 0 },
              ArrowRight: { x: delta, y: 0 },
              ArrowUp: { x: 0, y: delta },
              ArrowDown: { x: 0, y: -delta },
            };
            if (offsets[e.key]) {
              e.preventDefault();
              onSelect(i);
              onMove(i, {
                x: parameters.initial[i].x + offsets[e.key].x,
                y: parameters.initial[i].y + offsets[e.key].y,
              });
            }
          }}
        >
          <circle cx={px(point.x)} cy={py(point.y)} r="18" fill="transparent" />
          {selected === i && (
            <circle
              cx={px(point.x)}
              cy={py(point.y)}
              r="14"
              fill="none"
              stroke={COLORS[i]}
              strokeOpacity="0.5"
            />
          )}
          <circle
            cx={px(point.x)}
            cy={py(point.y)}
            r="8"
            fill={COLORS[i]}
            stroke="#111923"
            strokeWidth="2"
          />
          <text
            x={px(point.x)}
            y={py(point.y) + 3}
            textAnchor="middle"
            className="cl-agent-number"
          >
            {i + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}
