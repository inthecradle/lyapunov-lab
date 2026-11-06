import type {
  CollectiveParameters,
  CollectiveSample,
} from "../model/collective";
import { COLLECTIVE_DURATION } from "../model/collective";
import { COLLECTIVE_INTRO_DURATION } from "../model/collectiveIntro";
import { collectiveAgentCostAxisMax } from "../model/collectivePlayback";
import {
  formatCollectiveValue,
  type CollectiveFocus,
  type CollectiveSeries,
} from "./collectivePresentation";

type Props = {
  parameters: CollectiveParameters;
  current: CollectiveSample;
  samples: CollectiveSample[];
  playbackRate: number;
  focus: CollectiveFocus;
  onSelect: (series: CollectiveSeries) => void;
};

export default function CollectiveTimeGraph({
  parameters,
  current,
  samples,
  playbackRate,
  focus,
  onSelect,
}: Props) {
  const theorem = parameters.theorem;
  const time = current.time;
  const playbackTime = time / playbackRate;
  const potentialName = theorem === 2 ? "ℒ" : "ℒ_A";
  const thresholdName = theorem === 2 ? "θ" : "θ_A";
  const maxValue =
    theorem === 2
      ? collectiveAgentCostAxisMax(parameters)
      : Math.max(
          0.1,
          parameters.theta,
          ...samples.map((s) => Math.max(s.total, s.bound)),
        ) * 1.12;
  const gx = (t: number) => 48 + (t / COLLECTIVE_DURATION) * 390;
  const gy = (v: number) => 233 - (v / maxValue) * 192;
  const series = [
    { id: "individual" as const, label: "個人", color: "#8da7ff" },
    { id: "social" as const, label: "不一致", color: "#ffcc80" },
    ...(theorem === 3
      ? [{ id: "abstraction" as const, label: "LUB残差", color: "#d3a6ff" }]
      : []),
    { id: "total" as const, label: `合計 ${potentialName}`, color: "#65e6d0" },
  ];
  const line = (key: CollectiveSeries | "bound") =>
    samples
      .map(
        (s, i) =>
          `${i ? "L" : "M"}${gx(s.time).toFixed(2)},${gy(s[key] ?? 0).toFixed(2)}`,
      )
      .join(" ");
  return (
    <article className="cl-panel cl-graph-panel">
      <div className="cl-heading">
        <div>
          <span className="cl-kicker">POTENTIAL OVER TIME</span>
          <h3>何が減り、何が残るか</h3>
        </div>
        <span className="cl-tag">{potentialName}(t)</span>
      </div>
      <div className="cl-total">
        <span>合計ポテンシャル</span>
        <strong data-testid="collective-total">
          {formatCollectiveValue(current.total)}
        </strong>
        <small>
          d{potentialName}/dt = {formatCollectiveValue(current.derivative)}
        </small>
      </div>
      <svg
        viewBox="0 0 470 265"
        className="cl-graph"
        data-testid="collective-time-graph"
        data-axis-max={maxValue}
        role="img"
        aria-label="個人・不一致・LUB残差・合計の時間変化。横軸は収束の再生時間（秒）"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
          <g key={ratio}>
            <line
              x1="48"
              x2="438"
              y1={gy(maxValue * ratio)}
              y2={gy(maxValue * ratio)}
              className="cl-grid"
            />
            <text x="39" y={gy(maxValue * ratio) + 3} textAnchor="end">
              {(maxValue * ratio).toFixed(2)}
            </text>
          </g>
        ))}
        {[0, 3, 6, 9, 12].map((t) => (
          <text key={t} x={gx(t)} y="253" textAnchor="middle">
            {t / playbackRate}
          </text>
        ))}
        {series.map((s) => (
          <path
            key={s.id}
            d={line(s.id)}
            fill="none"
            stroke={s.color}
            strokeWidth={focus === s.id ? 3 : s.id === "total" ? 2.3 : 1.5}
            opacity={focus === "total" || focus === s.id ? 1 : 0.45}
          />
        ))}
        <line
          data-testid="collective-threshold-line"
          x1="48"
          x2="438"
          y1={gy(parameters.theta)}
          y2={gy(parameters.theta)}
          stroke="#e99bb4"
          strokeWidth="1.2"
        />
        <path
          data-testid="collective-bound"
          d={line("bound")}
          fill="none"
          stroke="#dce6f0"
          strokeWidth="1.2"
          strokeDasharray="5 5"
        />
        <line
          data-testid="collective-graph-cursor"
          data-time={time}
          data-playback-time={playbackTime}
          x1={gx(time)}
          x2={gx(time)}
          y1="32"
          y2="233"
          stroke="#c1d4df66"
        />
        {series.map((s) => (
          <circle
            key={s.id}
            cx={gx(time)}
            cy={gy(current[s.id])}
            r="3"
            fill={s.color}
          />
        ))}
      </svg>
      <p className="cl-hint" data-testid="collective-graph-time-label">
        横軸：収束の再生時間（秒）。モデル時間 t = 再生時間 × {playbackRate}。
        {theorem === 3 && ` 導入の${COLLECTIVE_INTRO_DURATION}秒は含みません。`}
        曲線は全期間の予測、縦線は現在位置です。
      </p>
      <div className="cl-graph-legend">
        {series.map((s) => (
          <button
            key={s.id}
            aria-pressed={focus === s.id}
            onClick={() => onSelect(s.id)}
          >
            <i style={{ background: s.color }} />
            {s.label} <b>{formatCollectiveValue(current[s.id])}</b>
          </button>
        ))}
        <span>┄ 閾値からの比較上限</span>
        <span>
          ― {thresholdName} = {parameters.theta.toFixed(2)}
        </span>
      </div>
      <div className="cl-metrics">
        <div>
          <span>主体間の最大距離（重みなし）</span>
          <b data-testid="collective-disagreement">
            {formatCollectiveValue(current.disagreement)}
          </b>
        </div>
        {theorem === 3 && (
          <div>
            <span>LUBまでの最大距離（重みなし）</span>
            <b data-testid="collective-target-distance">
              {formatCollectiveValue(current.targetDistance)}
            </b>
          </div>
        )}
      </div>
      <div
        className="cl-threshold-status"
        data-testid="collective-threshold-status"
      >
        <span>
          {potentialName} ≤ {thresholdName}
        </span>
        <b className={current.thresholdReached ? "cl-yes" : "cl-no"}>
          {current.thresholdReached ? "閾値内" : "閾値外"}
        </b>
        <span>閾値からの超過</span>
        <b data-testid="collective-residual">
          {formatCollectiveValue(current.residual)}
        </b>
      </div>
      <p className="cl-hint">
        閾値内に入ることと、各項が0になることは別です。係数が0の項は合計に寄与しません。
      </p>
    </article>
  );
}
