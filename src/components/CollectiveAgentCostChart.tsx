import { COLLECTIVE_COLORS as COLORS } from "./collectivePresentation";
import type { collectiveAgentCosts } from "../model/collectivePlayback";

type Costs = ReturnType<typeof collectiveAgentCosts>;
const PARTS = [
  { key: "personal", color: "#8da7ff", label: "個人の不快 Vᵢ" },
  { key: "social", color: "#ffcc80", label: "相互の不整合 ΣγSᵢⱼ" },
] as const;

export default function CollectiveAgentCostChart({
  initial,
  current,
  axisMax,
  theta,
}: {
  initial: Costs;
  current: Costs;
  axisMax: number;
  theta: number;
}) {
  const y = (value: number) => 240 - (value / axisMax) * 170;
  const thresholdY = y(Math.min(theta, axisMax));
  return (
    <svg
      viewBox="0 0 320 332"
      className="cl-convergence-heights cl-convergence-costs"
      data-testid="convergence-heights"
      data-axis-max={axisMax}
      role="img"
      aria-label="主体別の評価。個人の不快と相互の不整合を初期・現在の積み上げ棒で比較。共通のゼロと固定した線形目盛り"
    >
      <text x="14" y="20">
        主体別の評価 · Vᵢ + ΣγSᵢⱼ
      </text>
      {PARTS.map((part, i) => (
        <g key={part.key}>
          <rect x="14" y={30 + i * 17} width="8" height="8" fill={part.color} />
          <text x="28" y={38 + i * 17}>
            {part.label}
          </text>
        </g>
      ))}
      <rect
        x="54"
        y={thresholdY}
        width="248"
        height={240 - thresholdY}
        fill="#65e6a4"
        fillOpacity=".12"
      />
      {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
        <g key={fraction}>
          <line
            x1="54"
            x2="302"
            y1={y(fraction * axisMax)}
            y2={y(fraction * axisMax)}
            stroke="#304351"
            strokeDasharray="3 4"
          />
          <text x="47" y={y(fraction * axisMax) + 4} textAnchor="end">
            {(fraction * axisMax).toFixed(3)}
          </text>
        </g>
      ))}
      <g data-testid="convergence-height-threshold">
        <line
          x1="54"
          x2="302"
          y1={thresholdY}
          y2={thresholdY}
          stroke="#83ffb8"
          strokeDasharray="5 3"
        />
        <text x="302" y={thresholdY - 6} textAnchor="end" fill="#a2efbf">
          θ = {theta.toFixed(2)}
        </text>
      </g>
      {current.map((cost, i) => {
        const x = 96 + i * 80;
        const difference = initial[i].total - cost.total;
        return (
          <g key={i}>
            {(
              [
                { name: "initial", cost: initial[i], x: x - 18, opacity: 0.4 },
                { name: "agent", cost, x: x + 3, opacity: 1 },
              ] as const
            ).map((bar) => (
              <g key={bar.name}>
                {PARTS.map((part) => {
                  const bottom =
                    part.key === "personal" ? 0 : bar.cost.personal;
                  return (
                    <rect
                      key={part.key}
                      data-testid={`convergence-cost-${bar.name}-${part.key}-${i}`}
                      data-value={bar.cost[part.key]}
                      x={bar.x}
                      y={y(bottom + bar.cost[part.key])}
                      width="15"
                      height={y(bottom) - y(bottom + bar.cost[part.key])}
                      fill={part.color}
                      fillOpacity={bar.opacity}
                      stroke={part.color}
                      strokeOpacity={bar.opacity}
                      strokeWidth=".5"
                    />
                  );
                })}
                <circle
                  data-testid={`convergence-height-${bar.name}-${i}`}
                  data-height={bar.cost.total}
                  cx={bar.x + 7.5}
                  cy={y(bar.cost.total)}
                  r="3"
                  fill={bar.name === "initial" ? "#111923" : COLORS[i]}
                  stroke={COLORS[i]}
                />
              </g>
            ))}
            <text x={x - 10.5} y="254" textAnchor="middle">
              初期
            </text>
            <text x={x + 10.5} y="268" textAnchor="middle">
              現在
            </text>
            <text x={x} y="287" textAnchor="middle" fill={COLORS[i]}>
              主体{i + 1}
            </text>
            <text x={x} y="305" textAnchor="middle">
              {difference >= 0 ? "↓" : "↑"} {Math.abs(difference).toFixed(3)}
            </text>
          </g>
        );
      })}
      <text x="178" y="326" textAnchor="middle">
        3主体の合計 = 合成評価 ℒ
      </text>
    </svg>
  );
}
