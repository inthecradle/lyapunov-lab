import { dynamicsOf, type Parameters } from "../model/lyapunov";
import type { MathId } from "../interaction";

function Slider({
  name,
  symbol,
  value,
  min,
  max,
  step = 0.05,
  onChange,
  hint,
}: {
  name: string;
  symbol: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  hint: string;
}) {
  return (
    <label className="parameter">
      <span className="parameter-title">
        <span>
          <b>{symbol}</b> {name}
        </span>
        <output>{value.toFixed(2)}</output>
      </span>
      <input
        aria-label={name}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="parameter-hint">{hint}</span>
    </label>
  );
}
export default function ParameterControls({
  params,
  active,
  onChange,
}: {
  params: Parameters;
  active: MathId | null;
  onChange: (params: Parameters) => void;
}) {
  const dynamics = dynamicsOf(params);
  return (
    <section className="panel parameters" aria-label="実験パラメータ">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">PARAMETERS</span>
          <h2>条件を変えて、確かめる。</h2>
        </div>
        <span className="subtle">変更すると t = 0 から再計算</span>
      </div>
      <div className="parameter-grid">
        <div
          className={
            active === "theta" || active === "omega"
              ? "parameter-highlight"
              : ""
          }
        >
          <Slider
            name="TCZの閾値"
            symbol="θ"
            value={params.theta}
            min={0.25}
            max={3}
            onChange={(theta) => onChange({ ...params, theta })}
            hint="大きくするとTCZが広がります"
          />
        </div>
        <div
          className={
            active === "alpha" || active === "comparison"
              ? "parameter-highlight"
              : ""
          }
        >
          <Slider
            name={
              dynamics === "contained"
                ? "境界への接近率"
                : ["normal", "inward", "drift"].includes(dynamics)
                  ? "減少率の保証"
                  : dynamics === "lasalle"
                    ? "散逸係数の基準"
                    : "比較に使う減少率"
            }
            symbol="α"
            value={params.alpha}
            min={0.2}
            max={2}
            onChange={(alpha) => onChange({ ...params, alpha })}
            hint={
              dynamics === "contained"
                ? "内側からも外側からもθへ近づく速さを調整します"
                : dynamics === "lasalle"
                  ? "d = α(1+δ) を通じて散逸を調整します"
                  : ["normal", "inward", "contained", "drift"].includes(
                        dynamics,
                      )
                    ? "指数上限の減り方が変わります"
                    : "条件が崩れた場では保証を表しません"
            }
          />
        </div>
        <div className={active === "V" ? "parameter-highlight" : ""}>
          <Slider
            name="地形の縦方向の重み"
            symbol="b"
            value={params.stretch}
            min={0.5}
            max={2}
            onChange={(stretch) => onChange({ ...params, stretch })}
            hint="V = x₁² + b x₂² の形を変えます"
          />
        </div>
      </div>
      <details className="advanced">
        <summary>
          初期状態と軌道を調整 <span>＋</span>
        </summary>
        <div className="parameter-grid">
          <Slider
            name="初期状態 x₁"
            symbol="x₁"
            value={params.initial.x}
            min={-3}
            max={3}
            onChange={(x) =>
              onChange({ ...params, initial: { ...params.initial, x } })
            }
            hint="状態点の横方向の位置"
          />
          <Slider
            name="初期状態 x₂"
            symbol="x₂"
            value={params.initial.y}
            min={-3}
            max={3}
            onChange={(y) =>
              onChange({ ...params, initial: { ...params.initial, y } })
            }
            hint="状態点の縦方向の位置"
          />
          <Slider
            name={
              dynamics === "lasalle"
                ? "状態間の結合"
                : dynamics === "drift"
                  ? "進入時の回転"
                  : "回転の速さ"
            }
            symbol="ω"
            value={params.rotation}
            min={0}
            max={1.5}
            onChange={(rotation) => onChange({ ...params, rotation })}
            hint={
              dynamics === "lasalle"
                ? "0では散逸ゼロの線が不変になります"
                : dynamics === "drift"
                  ? "TCZへの進入時の回転と、漂遊に引き継ぐ初速度を調整します"
                  : "等高線に沿う動き。Vの減少率は不変"
            }
          />
          <Slider
            name={
              dynamics === "normal"
                ? "上限に対する追加の減少"
                : "場の係数の追加分"
            }
            symbol="δ"
            value={params.extraDecay}
            min={0}
            max={1}
            onChange={(extraDecay) => onChange({ ...params, extraDecay })}
            hint={
              dynamics === "normal"
                ? "0で実際の曲線と上限が一致します"
                : dynamics === "drift"
                  ? "β = α(1+δ) を調整します。0でも指数上限とは一致しません"
                  : dynamics === "slow" || dynamics === "orbit"
                    ? "この場では使用しません"
                    : "β または d = α(1+δ) の δ です"
            }
          />
        </div>
      </details>
    </section>
  );
}
