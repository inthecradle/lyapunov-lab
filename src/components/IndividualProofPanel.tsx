import { MathText } from "./MathToken";
import { proofStatus } from "../experimentProof";
import { guarantees, type Parameters } from "../model/lyapunov";
import type { ProofStep } from "../proof";
import type { Study } from "./ExperimentControls";

type IndividualProofPanelProps = {
  params: Parameters;
  study: Study;
  proofSteps: readonly ProofStep[];
  step: number;
  initialOutside: boolean;
  showFormulas: boolean;
  emphasizeProof: boolean;
  onStepSelect: (step: number) => void;
};

export default function IndividualProofPanel({
  params,
  study,
  proofSteps,
  step,
  initialOutside,
  showFormulas,
  emphasizeProof,
  onStepSelect,
}: IndividualProofPanelProps) {
  const validity = guarantees(params);
  const effectiveStep = proofSteps[step];
  const proofDone = step === proofSteps.length - 1;

  return (
    <section
      className={`panel proof-panel ${emphasizeProof ? "proof-mode" : ""}`}
      aria-label="証明パネル"
    >
      <div className="proof-content">
        <div className="proof-topline">
          <span className="eyebrow">THE PROOF, STEP BY STEP</span>
          <span className="proof-counter">
            {String(step + 1).padStart(2, "0")}{" "}
            <span>/ {String(proofSteps.length).padStart(2, "0")}</span>
          </span>
        </div>
        <h2>{effectiveStep.title}</h2>
        <p>{effectiveStep.text}</p>
        {showFormulas && (
          <div className="proof-formula">
            <MathText tex={effectiveStep.tex} />
          </div>
        )}
        {!initialOutside &&
          step >= 3 &&
          validity.forwardInvariant &&
          study !== "lasalle" &&
          study !== "invariance" && (
            <p className="inline-note">
              現在の初期状態はTCZ内です。この場合は y₊ = 0、距離 = 0
              が保たれます。外側からの比較を試すには、点を境界の外へ動かしてください。
            </p>
          )}
        <div className="proof-actions">
          <div className="step-actions">
            <button
              onClick={() => onStepSelect(step - 1)}
              disabled={step === 0}
              aria-label="前の証明ステップ"
            >
              ←
            </button>
            <button
              onClick={() => onStepSelect(step + 1)}
              disabled={step === proofSteps.length - 1}
              aria-label="次の証明ステップ"
            >
              →
            </button>
          </div>
        </div>
      </div>
      <aside className="proof-engine">
        <div>
          <span className="engine-icon">◇</span>
          <span className="eyebrow">PROOF ENGINE</span>
        </div>
        <ol>
          {proofSteps.map((item, i) => (
            <li
              key={item.engine}
              className={`${i === step ? "active" : i < step ? "done" : ""} ${item.valid === false ? "invalid-step" : ""}`}
            >
              <button onClick={() => onStepSelect(i)}>
                <span>
                  {item.valid === false
                    ? "×"
                    : i < step || proofDone
                      ? "✓"
                      : String(i + 1).padStart(2, "0")}
                </span>
                {item.engine}
                {i === step && <i />}
              </button>
            </li>
          ))}
        </ol>
        <div
          className={`engine-status ${(!validity.comparison && study === "break") || (!validity.forwardInvariant && study === "invariance") ? "invalid" : ""}`}
          data-testid="proof-status"
        >
          <span className="status-dot" />
          {proofDone
            ? proofStatus(params, study)
            : "条件と論証をひとつずつ確認"}
        </div>
      </aside>
    </section>
  );
}
