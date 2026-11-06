import { COLLECTIVE_COLORS as COLORS } from "./collectivePresentation";
import type {
  CollectiveParameters,
  CollectiveSample,
} from "../model/collective";
import type { collectivePlaybackTerrain } from "../model/collectivePlayback";

export default function CollectivePlaybackHeightChart({
  parameters,
  current,
  terrain,
}: {
  parameters: CollectiveParameters;
  current: CollectiveSample;
  terrain: ReturnType<typeof collectivePlaybackTerrain>;
}) {
  const chartY = (value: number) => 240 - (value / terrain.axisMax) * 192;
  const thresholdName = parameters.theorem === 3 ? "θ_A" : "θ";
  const chartThreshold = chartY(Math.min(parameters.theta, terrain.axisMax));
  return (
    <svg
      viewBox="0 0 320 300"
      className="cl-convergence-heights"
      data-testid="convergence-heights"
      data-axis-max={terrain.axisMax}
      role="img"
      aria-label="各主体の初期評価値と現在評価値。同じ固定目盛りで高さを比較"
    >
      <text x="22" y="23">
        高さの比較 · {terrain.label}
      </text>
      <rect
        x="54"
        y={chartThreshold}
        width="248"
        height={240 - chartThreshold}
        fill="#65e6a4"
        fillOpacity=".12"
      />
      {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
        <g key={fraction}>
          <line
            x1="54"
            x2="302"
            y1={chartY(fraction * terrain.axisMax)}
            y2={chartY(fraction * terrain.axisMax)}
            stroke="#304351"
            strokeDasharray="3 4"
          />
          <text
            x="47"
            y={chartY(fraction * terrain.axisMax) + 4}
            textAnchor="end"
          >
            {(fraction * terrain.axisMax).toFixed(3)}
          </text>
        </g>
      ))}
      <g data-testid="convergence-height-threshold">
        <line
          x1="54"
          x2="302"
          y1={chartThreshold}
          y2={chartThreshold}
          stroke="#83ffb8"
          strokeDasharray="5 3"
        />
        <text x="302" y={chartThreshold - 7} textAnchor="end" fill="#a2efbf">
          {thresholdName} = {parameters.theta.toFixed(2)}
          {parameters.theta > terrain.axisMax ? "（表示上限以上）" : ""}
        </text>
      </g>
      {parameters.initial.map((initial, i) => {
        const start = terrain.agentValue(i, initial),
          value = terrain.agentValue(i, current.positions[i]),
          x = 96 + i * 80;
        return (
          <g key={i} stroke={COLORS[i]}>
            <line
              x1={x}
              x2={x}
              y1={chartY(start)}
              y2={chartY(value)}
              strokeWidth="4"
              opacity=".55"
            />
            <circle
              data-testid={`convergence-height-initial-${i}`}
              data-height={start}
              cx={x}
              cy={chartY(start)}
              r="6"
              fill="#111923"
              strokeWidth="2"
            />
            <circle
              data-testid={`convergence-height-agent-${i}`}
              data-height={value}
              cx={x}
              cy={chartY(value)}
              r="4"
              fill={COLORS[i]}
            />
            <text
              x={x}
              y="263"
              textAnchor="middle"
              fill={COLORS[i]}
              stroke="none"
            >
              主体{i + 1}
            </text>
            <text x={x} y="283" textAnchor="middle" stroke="none">
              {terrain.isolated(i)
                ? "結合なし"
                : `↓ ${(start - value).toFixed(3)}`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
