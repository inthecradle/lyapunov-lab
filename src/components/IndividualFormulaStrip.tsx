import MathToken from "./MathToken";
import type { MathId } from "../interaction";
import { dynamicsOf, guarantees, type Parameters } from "../model/lyapunov";
import type { Study } from "./ExperimentControls";

type IndividualFormulaStripProps = {
  params: Parameters;
  study: Study;
  active: MathId | null;
  onSelect: (id: MathId) => void;
};

export default function IndividualFormulaStrip({
  params,
  study,
  active,
  onSelect,
}: IndividualFormulaStripProps) {
  const validity = guarantees(params);
  const dynamics = dynamicsOf(params);
  const token = (id: MathId, tex: string) => (
    <MathToken id={id} tex={tex} active={active} onSelect={onSelect} />
  );

  return study === "lasalle" ? (
    <section className="formula-strip" aria-label="LaSalleの数式">
      <div>{token("V", "V=q_1^2+q_2^2")}</div>
      <span className="formula-arrow">⟶</span>
      <div>{token("derivative", "\\dot V=-2dq_2^2\\leq0")}</div>
      <div>{token("x", params.rotation !== 0 ? "M=\\{0\\}" : "M=E")}</div>
      <span className="formula-condition">
        E = &#123;x₂ = 0&#125; の中の最大不変集合 M を調べます
      </span>
    </section>
  ) : study === "invariance" ? (
    <section
      className={`formula-strip ${validity.forwardInvariant ? "" : "invalid"}`}
      aria-label="前方不変性の数式"
    >
      <div>{token("theta", "V=\\theta")}</div>
      <span className="formula-arrow">⟶</span>
      <div>
        {token(
          "derivative",
          validity.forwardInvariant
            ? "\\nabla V\\cdot F\\leq0"
            : "\\nabla V\\cdot F>0",
        )}
      </div>
      <div>{token("omega", "\\Omega_\\theta")}</div>
      <span className="formula-condition">
        {validity.forwardInvariant
          ? "この場ではTCZは前方不変です"
          : "外向き：TCZの前方不変性が失われます"}
      </span>
    </section>
  ) : !validity.comparison ? (
    <section className="formula-strip invalid" aria-label="不成立の減少条件">
      <div>
        {token("derivative", "\\dot y(t)")}
        <span>≤ −</span>
        {token("alpha", "\\alpha")}
        {token("y", "y(t)")}
      </div>
      <span className="formula-condition">
        このαでの減少条件は保証されません
      </span>
      <div>{token("comparison", "y(0)e^{-\\alpha t}")}</div>
      <span className="formula-condition">参考曲線・上限の保証なし</span>
    </section>
  ) : (
    <section className="formula-strip" aria-label="操作できる数式">
      <div>
        {token("y", "y(t)")}
        <span>=</span>
        {token("V", "V(x(t))")}
        <span>−</span>
        {token("theta", "\\theta")}
      </div>
      <span className="formula-arrow">⟶</span>
      <div>
        {token("derivative", "\\dot y(t)")}
        <span>≤ −</span>
        {token("alpha", "\\alpha")}
        {token("y", "y(t)")}
      </div>
      <span className="formula-arrow">⟶</span>
      <div>
        {token("y", dynamics === "drift" ? "y_+(t)" : "y(t)")}
        <span>≤</span>
        {token(
          "comparison",
          dynamics === "drift" ? "y_+(0)e^{-\\alpha t}" : "y(0)e^{-\\alpha t}",
        )}
      </div>
      <span className="formula-condition">
        {dynamics === "drift"
          ? "減少条件はTCZ外で適用。全時刻は y₊ = max(y, 0) で評価"
          : "TCZ外から始めた場合"}
      </span>
      <div className="set-formula">
        {token("x", "x(t)")}
        <span>{dynamics === "drift" ? "∈" : "→"}</span>
        {token("omega", "\\Omega_\\theta")}
        <span className="set-definition">
          {" "}
          = &#123;x | V(x) ≤ θ&#125;
          {dynamics === "drift" && "（到達時刻T以降）"}
        </span>
      </div>
    </section>
  );
}
