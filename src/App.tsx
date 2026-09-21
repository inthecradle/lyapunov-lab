import { useEffect, useMemo, useRef, useState } from "react";
import StateSpace from "./components/StateSpace";
import TimeGraph from "./components/TimeGraph";
import ParameterControls from "./components/ParameterControls";
import MathToken, { MathText } from "./components/MathToken";
import {
  DEFAULT_PARAMETERS,
  DURATION,
  guarantees,
  dynamicsOf,
  viewportPotential,
  sampleAt,
  type Parameters,
} from "./model/lyapunov";
import { MATH_HELP, type MathId } from "./interaction";
import ExperimentControls, {
  presetsForStudy,
  type Study,
} from "./components/ExperimentControls";
import { experimentProof, proofStatus } from "./experimentProof";
import { invariantParameters } from "./model/invariance";

type Mode = "intuition" | "math" | "proof";
const MODE_LABELS: Record<Mode, string> = {
  intuition: "直感",
  math: "数式",
  proof: "証明",
};
const MODE_DESCRIPTIONS: Record<Mode, string> = {
  intuition: "図と文章を中心に表示します。数式の一覧と証明中の式を省略します。",
  math: "図と数式を対応させて確認できます。式を選ぶと、図の対応箇所が光ります。",
  proof:
    "証明の手順を強調表示します。時間スライダーと証明ステップが連動します。",
};

export default function App() {
  const [params, setParams] = useState<Parameters>(DEFAULT_PARAMETERS);
  const [study, setStudy] = useState<Study>("comparison");
  const proofSteps = useMemo(
    () => experimentProof(params, study),
    [params, study],
  );
  const validity = guarantees(params);
  const dynamics = dynamicsOf(params);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState<Mode>("math");
  const [step, setStep] = useState(0);
  const [proofPlaying, setProofPlaying] = useState(false);
  const [proofDone, setProofDone] = useState(false);
  const [active, setActive] = useState<MathId | null>("x");
  const [quiz, setQuiz] = useState<string | null>(null);
  const proofElapsed = useRef(0);
  const current = sampleAt(time, params);
  const initial = sampleAt(0, params);
  const outside = initial.residual > 1e-10;
  const displayResidual =
    current.positiveResidual /
    Math.max(
      initial.positiveResidual,
      viewportPotential(params) - params.theta,
      0.001,
    );
  const effectiveStep = proofSteps[step];

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last: number | null = null;
    const animate = (now: number) => {
      // A hidden tab resumes without jumping over the experiment.
      const dt = last === null ? 0 : Math.min((now - last) / 1000, 0.1);
      last = now;
      setTime((previous) => Math.min(DURATION, previous + dt));
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  useEffect(() => {
    if (time >= DURATION) setPlaying(false);
  }, [time]);

  useEffect(() => {
    if (!proofPlaying) return;
    let frame = 0;
    let last: number | null = null;
    let previousStep = -1;
    const animate = (now: number) => {
      const dt = last === null ? 0 : Math.min((now - last) / 1000, 0.1);
      last = now;
      proofElapsed.current += dt;
      const nextStep = Math.min(5, Math.floor(proofElapsed.current / 2.4));
      if (nextStep !== previousStep) {
        setStep(nextStep);
        setActive(proofSteps[nextStep].focus);
        previousStep = nextStep;
      }
      setTime(Math.min(DURATION, (proofElapsed.current / 14.4) * DURATION));
      if (proofElapsed.current >= 14.4) {
        setProofPlaying(false);
        setProofDone(true);
        return;
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [proofPlaying, proofSteps]);

  const pause = () => {
    setPlaying(false);
    setProofPlaying(false);
  };
  const seek = (value: number) => {
    pause();
    setTime(value);
    setProofDone(false);
    proofElapsed.current = (value / DURATION) * 14.4;
    if (mode === "proof")
      setStep(Math.min(5, Math.floor(proofElapsed.current / 2.4)));
  };
  const selectStep = (value: number) => {
    pause();
    setStep(value);
    setActive(proofSteps[value].focus);
    setProofDone(false);
    proofElapsed.current = value * 2.4;
    setTime(value * 2);
  };
  const changeParams = (next: Parameters, nextStudy: Study = study) => {
    pause();
    setParams(nextStudy === "invariance" ? invariantParameters(next) : next);
    setTime(0);
    setStep(0);
    setProofDone(false);
    setQuiz(null);
    proofElapsed.current = 0;
  };
  const changeStudy = (next: Study) => {
    setStudy(next);
    changeParams(presetsForStudy(next, params), next);
    setActive(
      next === "lasalle" ? "derivative" : next === "invariance" ? "theta" : "x",
    );
    setQuiz(null);
  };
  const reset = () => {
    pause();
    setTime(0);
    setStep(0);
    setActive("x");
    setProofDone(false);
    proofElapsed.current = 0;
  };
  const play = () => {
    if (playing || proofPlaying) {
      pause();
      return;
    }
    if (time >= DURATION) setTime(0);
    setPlaying(true);
  };
  const playProof = () => {
    setPlaying(false);
    setMode("proof");
    if (proofPlaying) {
      setProofPlaying(false);
      return;
    }
    if (proofDone || time >= DURATION) {
      proofElapsed.current = 0;
      setStep(0);
      setTime(0);
      setProofDone(false);
    } else proofElapsed.current = (time / DURATION) * 14.4;
    setProofPlaying(true);
  };
  const token = (id: MathId, tex: string) => (
    <MathToken id={id} tex={tex} active={active} onSelect={setActive} />
  );

  return (
    <div className="app-shell">
      <a className="skip-link" href="#experiment">
        実験へ進む
      </a>
      <header className="site-header">
        <a href="#" className="wordmark" aria-label="LYAPUNOV LAB ホーム">
          <svg viewBox="0 0 36 36" aria-hidden="true">
            <ellipse cx="18" cy="18" rx="15" ry="10" />
            <ellipse cx="18" cy="18" rx="9" ry="6" />
            <circle cx="29" cy="12" r="2.5" />
          </svg>
          <span>
            LYAPUNOV <b>LAB</b>
          </span>
        </a>
        <div className="header-right">
          <span className="edition">INTERACTIVE MATHEMATICS</span>
          <a href="#about">
            この実験について <span aria-hidden="true">↗</span>
          </a>
        </div>
      </header>

      <main>
        <section className="intro">
          <div>
            <p className="eyebrow mint">
              <span className="status-dot" /> EXPERIMENT 01{" "}
              <span className="divider">/</span> INDIVIDUAL STABILITY
            </p>
            <h1>
              なぜ、<span>TCZ</span>へ収束するのか。
            </h1>
            <p className="intro-copy">
              数式を動かす。証明を動かす。収束を目で見る。
            </p>
          </div>
          <div className="intro-aside">
            <span className="vertical-rule" />
            <p>
              点を動かし、条件を変える。
              <br />
              「減少」から「収束」へのつながりを
              <br />
              ひとつずつ確かめる実験室です。
            </p>
          </div>
        </section>

        <nav className="step-navigation" aria-label="学習ステップ">
          {proofSteps.map((item, index) => (
            <button
              key={item.short}
              aria-current={step === index ? "step" : undefined}
              className={step === index ? "current" : ""}
              onClick={() => selectStep(index)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              {item.short}
              <i />
            </button>
          ))}
        </nav>

        <section
          id="experiment"
          className="experiment"
          aria-label="定理1の実験"
        >
          <div className="experiment-toolbar">
            <div className="experiment-label">
              <span className="status-dot" />
              <b>THEOREM 01 LAB</b>
              <span className="model-tag">教育用モデル</span>
            </div>
            <div className="segmented" role="group" aria-label="表示モード">
              {(["intuition", "math", "proof"] as Mode[]).map((item) => (
                <button
                  key={item}
                  aria-pressed={mode === item}
                  aria-describedby="display-mode-help"
                  title={MODE_DESCRIPTIONS[item]}
                  onClick={() => {
                    pause();
                    setMode(item);
                  }}
                >
                  {MODE_LABELS[item]}
                </button>
              ))}
            </div>
          </div>

          <p
            id="display-mode-help"
            className="display-mode-help"
            aria-live="polite"
          >
            表示モード：{MODE_LABELS[mode]} — {MODE_DESCRIPTIONS[mode]}
          </p>

          <ExperimentControls
            study={study}
            params={params}
            time={time}
            onStudyChange={changeStudy}
            onChange={changeParams}
            onSelect={setActive}
          />

          <div className="visual-grid">
            <section
              className={`panel state-panel ${["V", "theta", "omega", "x"].includes(active ?? "") ? "connected" : ""}`}
            >
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">STATE SPACE</span>
                  <h2>ポテンシャルの地形をたどる</h2>
                </div>
                <span className="coordinate-tag">V = x₁² + b x₂²</span>
              </div>
              <StateSpace
                params={params}
                time={time}
                active={active}
                onSelect={setActive}
                onInitialChange={(initial) =>
                  changeParams({ ...params, initial })
                }
              />
              <div className="state-legend">
                <span>
                  <i className="dot-key" />
                  現在の状態
                </span>
                <span>
                  <i className="area-key" />
                  TCZ
                </span>
                <span>
                  <i className="line-key actual" />
                  軌跡
                </span>
                <span>
                  <i className="line-key future" />
                  この先の軌道
                </span>
              </div>
              <div className="state-values">
                <button
                  onClick={() => setActive("x")}
                  className={active === "x" ? "lit-text" : ""}
                >
                  <span>x(t)</span>
                  <b data-testid="coordinates">
                    ({current.point.x.toFixed(2)}, {current.point.y.toFixed(2)})
                  </b>
                </button>
                <button
                  onClick={() => setActive("V")}
                  className={active === "V" ? "lit-text" : ""}
                >
                  <span>V(x(t))</span>
                  <b data-testid="potential-value">
                    {current.value.toFixed(3)}
                  </b>
                </button>
                <button
                  onClick={() => setActive("theta")}
                  className={active === "theta" ? "lit-text" : ""}
                >
                  <span>θ</span>
                  <b>{params.theta.toFixed(2)}</b>
                </button>
              </div>
            </section>

            <section
              className={`panel graph-panel ${["y", "derivative", "alpha", "comparison"].includes(active ?? "") ? "connected" : ""}`}
            >
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">LYAPUNOV / TIME VIEW</span>
                  <h2>評価量の変化を追う</h2>
                </div>
                <span className="live-label">
                  {playing || proofPlaying ? "● RUNNING" : "○ PAUSED"}
                </span>
              </div>
              <TimeGraph
                params={params}
                time={time}
                active={active}
                onSelect={setActive}
                onTimeChange={seek}
              />
              <button
                className={`residual-card ${active === "y" ? "selected" : ""}`}
                onClick={() => setActive("y")}
              >
                <div>
                  <span className="eyebrow">REMAINING POTENTIAL</span>
                  <b>
                    外側に残る量 <span>y₊ = max(y, 0)</span>
                  </b>
                </div>
                <strong>
                  {current.positiveResidual < 0.001 &&
                  current.positiveResidual > 0
                    ? "< 0.001"
                    : current.positiveResidual.toFixed(3)}
                </strong>
                <div className="residual-track">
                  <span
                    style={{
                      width: `${Math.min(100, displayResidual * 100)}%`,
                    }}
                  />
                </div>
              </button>
            </section>
          </div>

          <div className="transport panel">
            <button
              className="play-button"
              onClick={play}
              aria-label={
                playing || proofPlaying ? "一時停止" : "シミュレーションを再生"
              }
            >
              <span aria-hidden="true">
                {playing || proofPlaying ? "Ⅱ" : "▶"}
              </span>
              {playing || proofPlaying
                ? "一時停止"
                : time >= DURATION
                  ? "もう一度"
                  : "再生"}
            </button>
            <button
              className="reset-button"
              onClick={reset}
              title="時間と証明をリセット"
              aria-label="リセット"
            >
              ↺
            </button>
            <label className="timeline">
              <span className="sr-only">時間</span>
              <input
                aria-label="時間"
                type="range"
                min="0"
                max={DURATION}
                step=".01"
                value={time}
                onChange={(e) => seek(Number(e.target.value))}
              />
              <span className="timeline-labels">
                <span>0</span>
                <span>モデル時間 t</span>
                <span>{DURATION}</span>
              </span>
            </label>
            <output className="time-output" data-testid="time-output">
              {time.toFixed(2)}
              <small> / {DURATION.toFixed(2)}</small>
            </output>
          </div>

          {mode !== "intuition" &&
            (study === "lasalle" ? (
              <section className="formula-strip" aria-label="LaSalleの数式">
                <div>{token("V", "V=q_1^2+q_2^2")}</div>
                <span className="formula-arrow">⟶</span>
                <div>{token("derivative", "\\dot V=-2dq_2^2\\leq0")}</div>
                <div>
                  {token("x", params.rotation !== 0 ? "M=\\{0\\}" : "M=E")}
                </div>
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
              <section
                className="formula-strip invalid"
                aria-label="不成立の減少条件"
              >
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
                <span className="formula-condition">
                  参考曲線・上限の保証なし
                </span>
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
                    dynamics === "drift"
                      ? "y_+(0)e^{-\\alpha t}"
                      : "y(0)e^{-\\alpha t}",
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
            ))}

          <div className="interaction-note" aria-live="polite">
            <span className="note-icon">⌘</span>
            <div>
              <b>{active ? MATH_HELP[active].label : "数式と図をつなぐ"}</b>
              <span>
                {active
                  ? active === "comparison" && !validity.comparison
                    ? "現在の場では、このαによる指数上限を使いません。灰色の破線が表示される場合は、正常な場との比較用の参考曲線です。"
                    : active === "alpha" && !validity.comparison
                      ? "このαは場や比較用の曲線を設定する係数です。現在の場の指数上限を保証する値ではありません。"
                      : MATH_HELP[active].text
                  : "数式や図の要素を選ぶと、対応する対象が光ります。"}
              </span>
            </div>
          </div>

          <ParameterControls
            params={params}
            active={active}
            onChange={changeParams}
          />

          <section
            className={`panel proof-panel ${mode === "proof" ? "proof-mode" : ""}`}
            aria-label="証明パネル"
          >
            <div className="proof-content">
              <div className="proof-topline">
                <span className="eyebrow">THE PROOF, STEP BY STEP</span>
                <span className="proof-counter">
                  {String(step + 1).padStart(2, "0")} <span>/ 06</span>
                </span>
              </div>
              <h2>{effectiveStep.title}</h2>
              <p>{effectiveStep.text}</p>
              {mode !== "intuition" && (
                <div className="proof-formula">
                  <MathText tex={effectiveStep.tex} />
                </div>
              )}
              {!outside &&
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
                <button className="outline-button" onClick={playProof}>
                  {proofPlaying
                    ? "Ⅱ 証明を一時停止"
                    : proofDone
                      ? "↺ 証明をもう一度"
                      : "▶ 証明を再生"}
                </button>
                <div className="step-actions">
                  <button
                    onClick={() => selectStep(step - 1)}
                    disabled={step === 0}
                    aria-label="前の証明ステップ"
                  >
                    ←
                  </button>
                  <button
                    onClick={() => selectStep(step + 1)}
                    disabled={step === 5}
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
                    <button onClick={() => selectStep(i)}>
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
                  : proofPlaying
                    ? "証明を再生中"
                    : "条件と論証をひとつずつ確認"}
              </div>
            </aside>
          </section>

          {study === "comparison" && dynamics === "drift" && (
            <section className="understanding panel">
              <div>
                <span className="eyebrow">A QUESTION TO TAKE WITH YOU</span>
                <h2>TCZ内でVが増えたら、領域から出たことになる？</h2>
                <p>前方不変性は、Vの単調減少を要求する性質ではありません。</p>
              </div>
              <div className="quiz-options">
                <button
                  aria-pressed={quiz === "increase"}
                  onClick={() => setQuiz("increase")}
                >
                  Vが増えたらTCZの外に出る
                </button>
                <button
                  aria-pressed={quiz === "within"}
                  onClick={() => setQuiz("within")}
                >
                  θ以下ならTCZ内に留まっている
                </button>
              </div>
              {quiz && (
                <p
                  className={`quiz-feedback ${quiz === "within" ? "correct" : ""}`}
                  role="status"
                >
                  {quiz === "within"
                    ? "そのとおりです。"
                    : "領域を決めるθと比べてみましょう。"}
                  Vが増減しても、V ≤
                  θを保てばTCZ内に留まっています。漂遊の軌道は、この性質を図示するために追加したモデルです。
                </p>
              )}
            </section>
          )}

          {study === "comparison" && dynamics === "normal" && (
            <section className="understanding panel">
              <div>
                <span className="eyebrow">A QUESTION TO TAKE WITH YOU</span>
                <h2>境界へ近づく点は、いつか中に入る？</h2>
                <p>初期状態がTCZの外側にある、このモデルで考えてみましょう。</p>
              </div>
              <div className="quiz-options">
                <button
                  aria-pressed={quiz === "enter"}
                  onClick={() => setQuiz("enter")}
                >
                  有限時間で中に入る
                </button>
                <button
                  aria-pressed={quiz === "approach"}
                  onClick={() => setQuiz("approach")}
                >
                  近づき続けても、外側にいられる
                </button>
              </div>
              {quiz && (
                <p
                  className={`quiz-feedback ${quiz === "approach" ? "correct" : ""}`}
                  role="status"
                >
                  {quiz === "approach"
                    ? "そのとおりです。"
                    : "指数関数の形を見てみましょう。"}{" "}
                  y(0) &gt; 0 なら、y(0)e⁻ᵝᵗ
                  はどの有限時刻でも正です。距離が0へ近づくことと、中に入ることは区別できます。
                </p>
              )}
            </section>
          )}

          <section id="about" className="about-section">
            <details>
              <summary>
                このモデルの前提と出典 <span>＋</span>
              </summary>
              <div className="about-content">
                <p>
                  このアプリは、苫米地定理1に関わるLyapunov型の収束構造を学ぶための教育用モデルです。二次関数と状態の動きは、この教材で選んだ具体例です。人の認知をこの二次元方程式で表したものではありません。
                </p>
                <p>
                  参考：苫米地英人『A Unified Theory of Latent Potentials:
                  Homeostasis and Cognitive Warfare』公開版
                  §2.7〜2.10、および『認知潜在ポテンシャル自由エネルギー理論』の統一収束補題・定理1。本アプリは最適制御問題の求解や定理1全体の証明を行うものではありません。
                </p>
                <h3>TCZへの到達と内部の漂遊</h3>
                <p>
                  標準表示では、外側でV̇ =
                  −βVとする具体例を使い、有限時間でθに到達させます。内部へ進んだ後は、位置と速度を連続につないだ楕円軌道を使います。Vが上下しながらθ以下に留まるこの漂遊は、教材のために追加した挙動です。内部の動きや有限時間到達を、元の比較不等式だけから導いたものではありません。
                </p>
                <h3>境界へ漸近する比較例で使う条件</h3>
                <ul>
                  <li>
                    V(x) = x₁² + b x₂²、b &gt; 0。閾値θ &gt;
                    0は各実験中に固定します。
                  </li>
                  <li>
                    外側で ẏ = −βy、β = α(1+δ) ≥ α &gt;
                    0。内側ではVを一定に保ちます。
                  </li>
                  <li>ベクトル場は局所Lipschitz連続で、軌道は有界です。</li>
                  <li>
                    距離の上限は y₊ / ((√V +
                    √θ)√min(1,b))。この評価から集合への収束を示します。
                  </li>
                </ul>
                <p>
                  積分コストの最小化だけから減少条件は導きません。回転があると境界付近を周回し続け、一点へ止まるとは限りません。表示値が丸められて0になっても、有限時間の到達を意味しません。
                </p>
                <p>
                  条件を壊す実験では、標準モデルの保証を引き継ぎません。前方不変性の実験では、局所Lipschitzな場と滑らかな境界上の向きを確認します。
                </p>
                <p>
                  現在の距離上限：<b>{current.distanceBound.toPrecision(4)}</b>
                  （楕円への最短距離そのものではありません）。
                </p>
              </div>
            </details>
          </section>
        </section>

        <section className="roadmap" aria-label="今後の拡張">
          <span className="eyebrow">ONE STRUCTURE. THREE PERSPECTIVES.</span>
          <div>
            <article className="available">
              <span>01 / INDIVIDUAL</span>
              <h3>V → TCZ</h3>
              <p>
                個人の安定性 <b>公開版</b>
              </p>
            </article>
            <article>
              <span>02 / SHARED</span>
              <h3>ℒ → Shared-TCZ</h3>
              <p>
                共有する安定性 <b>今後の実装</b>
              </p>
            </article>
            <article>
              <span>03 / ABSTRACTION</span>
              <h3>ℒ_A → LUB</h3>
              <p>
                抽象化を含む収束 <b>今後の実装</b>
              </p>
            </article>
          </div>
        </section>
      </main>
      <footer>
        <span>
          LYAPUNOV LAB <i>/</i>{" "}
          <a href="https://note.com/dawn_of_coaching">コーチングの夜明け</a>{" "}
          <i>/</i> CognitiveMind Inc.
        </span>
      </footer>
    </div>
  );
}
