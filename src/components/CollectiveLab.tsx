import { useMemo, useState } from "react";
import {
  COLLECTIVE_DURATION,
  DEFAULT_COLLECTIVE,
  EDGE_PAIRS,
  collectiveGuarantees,
  sampleCollective,
  type CollectiveParameters,
  type Point,
} from "../model/collective";
import { MathText } from "./MathToken";
import CollectiveTerrain3D from "./CollectiveTerrain3D";
import CollectivePlaybackDialog from "./CollectivePlaybackDialog";
import { useCollectivePlayback } from "../hooks/useCollectivePlayback";
import CollectiveTransport from "./CollectiveTransport";
import CollectiveTimeGraph from "./CollectiveTimeGraph";
import CollectiveStateSpace2D from "./CollectiveStateSpace2D";
import {
  COLLECTIVE_COLORS as COLORS,
  formatCollectiveValue as fix,
  type CollectiveFocus,
} from "./collectivePresentation";
import "./collective-lab.css";

const clamp = (n: number) => Math.max(0, Math.min(1, n));
const PRESETS = ["個別に安定", "共有へ収束", "集団を分断"];

export default function CollectiveLab({ theorem }: { theorem: 2 | 3 }) {
  const [parameters, setParameters] = useState<CollectiveParameters>(() => ({
    ...DEFAULT_COLLECTIVE,
    theorem,
    initial: DEFAULT_COLLECTIVE.initial.map((p) => ({ ...p })),
    worlds: DEFAULT_COLLECTIVE.worlds.map((p) => ({ ...p })),
    personalInitial: [...DEFAULT_COLLECTIVE.personalInitial],
    gamma: [...DEFAULT_COLLECTIVE.gamma],
  }));
  const [abstractionThreshold, setAbstractionThreshold] = useState(0.03);
  const [spatialView, setSpatialView] = useState<"2d" | "3d">("3d");
  const {
    time,
    playing,
    playbackOpen,
    introProgress,
    compactLayout,
    playbackRate,
    togglePlayback,
    seek,
    reset,
    closePlayback,
    skipIntro,
    restoreIntro,
    scrubIntro,
    replayIntro,
  } = useCollectivePlayback(theorem, spatialView);
  const [selected, setSelected] = useState(0);
  const [focus, setFocus] = useState<CollectiveFocus>("total");
  const p = useMemo(
    () => ({
      ...parameters,
      theorem,
      theta: theorem === 3 ? abstractionThreshold : parameters.theta,
    }),
    [parameters, theorem, abstractionThreshold],
  );

  const current = useMemo(() => sampleCollective(time, p), [time, p]);
  const samples = useMemo(
    () =>
      Array.from({ length: 121 }, (_, i) =>
        sampleCollective((i / 120) * COLLECTIVE_DURATION, p),
      ),
    [p],
  );
  const guarantee = useMemo(() => collectiveGuarantees(p), [p]);
  const potentialName = theorem === 2 ? "ℒ" : "ℒ_A";
  const thresholdName = theorem === 2 ? "θ" : "θ_A";
  const potentialTex = theorem === 2 ? "\\mathcal L" : "\\mathcal L_A";
  const change = (patch: Partial<CollectiveParameters>) => {
    reset();
    setParameters((old) => ({ ...old, ...patch }));
  };
  const move = (index: number, point: Point) => {
    reset();
    const edited = { x: clamp(point.x), y: clamp(point.y) };
    setParameters((old) => ({
      ...old,
      initial: old.initial.map((v, i) => (i === index ? { ...edited } : v)),
      worlds: old.worlds.map((v, i) => (i === index ? { ...edited } : v)),
    }));
  };
  const preset = (index: number) => {
    change({
      gamma:
        index === 0 ? [0, 0, 0] : index === 2 ? [0.8, 0, 0] : [0.8, 0.8, 0.8],
      eta: DEFAULT_COLLECTIVE.eta,
    });
  };
  const transport = (
    <CollectiveTransport
      time={time}
      playing={playing}
      playbackRate={playbackRate}
      onToggle={togglePlayback}
      onReset={reset}
      onSeek={seek}
    />
  );

  return (
    <section
      className="cl-lab"
      id="experiment"
      aria-label={`定理${theorem}の実験`}
      data-testid="collective-lab"
    >
      <div className="cl-toolbar">
        <div>
          <span className="cl-kicker">COLLECTIVE DYNAMICS / 0{theorem}</span>
          <h2>
            {theorem === 2
              ? "共有は、どの条件で生まれるか。"
              : "合意の先に、何を共有するか。"}
          </h2>
        </div>
      </div>
      <article className="cl-panel cl-original">
        <span className="cl-kicker">
          ORIGINAL FORMULATION / §2 · A.{theorem === 2 ? "3" : "4"}
        </span>
        <h3>原典の定理{theorem}：制御方策と収束先</h3>
        <div className="cl-equation" data-testid="paper-formula">
          <MathText
            tex={
              theorem === 2
                ? "\\pi_i=\\mathop{\\arg\\min}_{u_i(t)}\\int_0^T\\!\\left(V_i(x_i(t),t)+\\sum_j\\gamma_{ij}S_{ij}(x_i,x_j)\\right)dt\\quad\\Rightarrow\\quad x^*(t)\\to\\mathrm{TCZ}^{shared}"
                : "\\pi_i=\\mathop{\\arg\\min}_{u_i(t)}\\mathbb E\\int_0^T\\!\\left(V_i+\\sum_j\\gamma_{ij}S_{ij}+\\eta_i A(x_i(t))\\right)dt"
            }
          />
        </div>
        {theorem === 3 && (
          <div className="cl-equation">
            <MathText
              tex={
                "A(x)=0\\iff\\varphi(x)=\\mathrm{LUB}(W_1,\\ldots,W_N)\\quad\\Rightarrow\\quad x^*(t)\\to\\mathrm{LUB}(W_1,\\ldots,W_N)"
              }
            />
          </div>
        )}
        <p>
          原典の仮定：{theorem === 2 ? "A1〜A5" : "A1〜A6"}
          。下の表示は、これらすべてを自動検証したことを示すものではありません。
        </p>
        <p>
          数値化の設定：原典は評価関数と閉ループの具体形を一意に指定していません。ここでは具体的な関数と勾配流を採用します。最適制御の解を求める機能ではありません。
        </p>
        <details className="cl-numerical-settings">
          <summary>数値化の設定</summary>
          <div className="cl-equation">
            <MathText
              tex={
                "x_i=(r_i,z_i),\\quad\\varphi_i(x_i)=z_i,\\quad V_i=\\tfrac12\\operatorname{dist}(r_i,[-1,1])^2,\\quad S_{ij}=\\tfrac12\\lVert z_i-z_j\\rVert^2"
              }
            />
          </div>
          <p>
            rᵢ は個人状態、zᵢ は共有表象です。[−1, 1] は Vᵢ = 0
            の領域であり、合計が閾値以下となる共有安定領域とは別です。世界 Wᵢ
            は主体の初期位置と一緒に設定し、再生中は固定します。動く認知状態 xᵢ
            と区別します。
          </p>
          <p>
            γᵢⱼ = γⱼᵢ、Sᵢᵢ = 0 とし、原典の Σᵢⱼ
            は順序付きの全組を合計します。各ペアを両方向で数えるため、社会的費用は
            2Σᵢ&lt;ⱼγᵢⱼSᵢⱼ です。
          </p>
          {theorem === 3 && (
            <>
              <div className="cl-equation">
                <MathText
                  tex={
                    "A(x)=\\sum_i A_i,\\quad A_i=\\tfrac12\\lVert z_i-L\\rVert^2,\\quad L=\\mathrm{LUB}(W_1,W_2,W_3),\\quad\\eta_i=\\eta"
                  }
                />
              </div>
              <p>
                LUBの位置が既知で、認識論的不確実性がない決定論的な場合を表示します。原典の期待値
                𝔼 は、この場合に恒等作用となります。
              </p>
            </>
          )}
        </details>
      </article>
      <div className="cl-presets" aria-label="実験の設定例">
        {PRESETS.map((name, index) => (
          <button
            key={name}
            aria-label={name}
            onClick={() => preset(index)}
            data-testid={`cl-preset-${index}`}
          >
            <span>0{index + 1}</span>
            {name}
          </button>
        ))}
      </div>
      {theorem === 3 && (
        <p className="cl-hint">
          設定例の「LUBへの力」は η = {DEFAULT_COLLECTIVE.eta.toFixed(2)}
          から始めます。0に下げると、LUBへの力がない場合との違いを比べられます。
        </p>
      )}

      <div className="cl-main-grid">
        <article className="cl-panel cl-state-panel">
          <div className="cl-heading">
            <div>
              <span className="cl-kicker">SHARED REPRESENTATIONS</span>
              <h3>3人の共有表象</h3>
            </div>
            <span className="cl-tag">zᵢ ∈ [0, 1]²</span>
          </div>
          <div
            className="cl-spatial-switch"
            role="group"
            aria-label="共有表象の表示"
          >
            <button
              aria-pressed={spatialView === "2d"}
              onClick={() => {
                setSpatialView("2d");
                skipIntro();
              }}
            >
              2D 平面
            </button>
            <button
              aria-pressed={spatialView === "3d"}
              onClick={() => {
                if (spatialView === "2d") restoreIntro();
                setSpatialView("3d");
              }}
            >
              3D 地形
            </button>
          </div>
          {spatialView === "3d" ? (
            <CollectiveTerrain3D
              parameters={p}
              current={current}
              selected={selected}
              onSelect={setSelected}
              onMove={move}
              onEditStart={reset}
              playbackControls={
                compactLayout && !playbackOpen ? transport : undefined
              }
              introProgress={introProgress}
              onSkipIntro={skipIntro}
              onIntroChange={scrubIntro}
              onReplayIntro={replayIntro}
            />
          ) : (
            <CollectiveStateSpace2D
              parameters={p}
              current={current}
              samples={samples}
              selected={selected}
              focus={focus}
              onSelect={setSelected}
              onFocus={setFocus}
              onMove={move}
              onEditStart={reset}
            />
          )}
          {compactLayout && spatialView === "2d" && !playbackOpen && transport}
          <p className="cl-hint cl-center">
            点をドラッグ・矢印キーで移動すると、初期位置を変更できます。
            {theorem === 3 &&
              "世界 Wᵢ も更新し、LUBを再計算します。再生中の Wᵢ は固定です。"}
          </p>
          <div className="cl-position-editor">
            <div className="cl-agent-select" aria-label="編集する主体">
              {COLORS.map((color, i) => (
                <button
                  key={i}
                  aria-pressed={selected === i}
                  onClick={() => setSelected(i)}
                  style={{ borderColor: selected === i ? color : undefined }}
                >
                  主体 {i + 1}
                </button>
              ))}
            </div>
            {(["x", "y"] as const).map((axis) => (
              <label key={axis}>
                {axis === "x" ? "成分1" : "成分2"}
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  aria-label={`主体${selected + 1}の初期${axis}`}
                  value={Number(p.initial[selected][axis].toFixed(3))}
                  onChange={(e) => {
                    if (
                      e.target.value !== "" &&
                      Number.isFinite(e.target.valueAsNumber)
                    )
                      move(selected, {
                        ...p.initial[selected],
                        [axis]: e.target.valueAsNumber,
                      });
                  }}
                />
              </label>
            ))}
          </div>
        </article>

        <CollectiveTimeGraph
          parameters={p}
          current={current}
          samples={samples}
          playbackRate={playbackRate}
          focus={focus}
          onSelect={setFocus}
        />
      </div>

      {!compactLayout && !playbackOpen && transport}
      {playbackOpen && (
        <CollectivePlaybackDialog
          parameters={p}
          current={current}
          introProgress={introProgress}
          onSkipIntro={skipIntro}
          onReplayIntro={replayIntro}
          controls={transport}
          onClose={closePlayback}
        />
      )}

      <div className="cl-detail-grid">
        <article className="cl-panel cl-controls">
          <div className="cl-heading">
            <div>
              <span className="cl-kicker">CONDITIONS</span>
              <h3>力とつながりを変える</h3>
            </div>
            <span className="cl-tag">変更すると t = 0</span>
          </div>
          {EDGE_PAIRS.map(([a, b], i) => (
            <label className="cl-slider" key={i}>
              <span>
                主体 {a + 1} ↔ {b + 1}
                <b>
                  γ{a + 1}
                  {b + 1} = γ{b + 1}
                  {a + 1} = {p.gamma[i].toFixed(2)}
                </b>
              </span>
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={p.gamma[i]}
                aria-label={`結合係数 γ${a + 1}${b + 1}`}
                onChange={(e) =>
                  change({
                    gamma: p.gamma.map((v, j) =>
                      j === i ? Number(e.target.value) : v,
                    ),
                  })
                }
              />
            </label>
          ))}
          <p className="cl-hint">
            各係数を0にすると、そのペアの結合が切れます。
            {theorem === 2 &&
              "γを変えた費用の差を比較できるよう、3Dの高さの基準とグラフの目盛りを揃えています。一部のγだけを強くした場合、下界Qの地形が変わらなくても、実際の費用と動きは変わります。"}
          </p>
          {theorem === 3 && (
            <label className="cl-slider">
              <span>
                LUBへの力 <b>η = {p.eta.toFixed(2)}</b>
              </span>
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={p.eta}
                aria-label="LUBへの力"
                onChange={(e) => change({ eta: Number(e.target.value) })}
              />
            </label>
          )}
          <label className="cl-slider">
            <span>
              安定領域の閾値{" "}
              <b>
                {thresholdName} = {p.theta.toFixed(2)}
              </b>
            </span>
            <input
              type="range"
              min="0"
              max={theorem === 3 ? 0.3 : 1}
              step="0.01"
              value={p.theta}
              aria-label="安定領域の閾値"
              onChange={(e) => {
                const theta = Number(e.target.value);
                if (theorem === 3) {
                  reset();
                  setAbstractionThreshold(theta);
                } else change({ theta });
              }}
            />
          </label>
        </article>
        <article
          className="cl-panel cl-guarantee"
          data-testid="collective-guarantees"
        >
          <div className="cl-heading">
            <div>
              <span className="cl-kicker">WHAT IS GUARANTEED</span>
              <h3>減少と到達先を分ける</h3>
            </div>
          </div>
          <div className="cl-guarantee-rows">
            <div>
              <span>原典の結合条件（γ &gt; 0 で連結）</span>
              <b className={guarantee.connected ? "cl-yes" : "cl-no"}>
                {guarantee.connected
                  ? "連結・正の下界あり"
                  : "分断：該当条件外"}
              </b>
            </div>
            {theorem === 3 && (
              <div>
                <span>原典の抽象化係数 η &gt; 0</span>
                <b className={p.eta > 0 ? "cl-yes" : "cl-no"}>
                  {p.eta > 0 ? "正の係数" : "η = 0：該当条件外"}
                </b>
              </div>
            )}
            <div>
              <span>この閉ループの散逸条件</span>
              <b className="cl-yes">
                成立：α = {guarantee.decayRate.toFixed(2)}
              </b>
            </div>
          </div>
          <h4 className="cl-limit-heading">この具体モデルの長時間極限</h4>
          <div className="cl-guarantee-rows">
            <div>
              <span>共有表象の全員一致</span>
              <b
                data-testid="cl-alignment"
                className={guarantee.alignment ? "cl-yes" : "cl-no"}
              >
                {guarantee.alignment ? "一致へ収束" : "一般には一致しない"}
              </b>
            </div>
            {theorem === 3 && (
              <div>
                <span>LUBへの収束</span>
                <b
                  data-testid="cl-lub-guarantee"
                  className={guarantee.lub ? "cl-yes" : "cl-no"}
                >
                  {guarantee.lub ? "LUBへ収束" : "一般には到達しない"}
                </b>
              </div>
            )}
          </div>
          <p className="cl-hint" data-testid="cl-guarantee-reason">
            {guarantee.reason} 原典の全仮定の成立判定とは区別しています。
          </p>
        </article>
      </div>

      <div className="cl-panel cl-formula" aria-label="ポテンシャルの内訳">
        <button
          aria-pressed={focus === "total"}
          onClick={() => setFocus("total")}
        >
          <MathText tex={potentialTex} />
        </button>
        <span>=</span>
        <button
          aria-pressed={focus === "individual"}
          onClick={() => setFocus("individual")}
        >
          <MathText tex={"\\sum_i V_i(x_i,t)"} />
        </button>
        <span>+</span>
        <button
          aria-pressed={focus === "social"}
          onClick={() => setFocus("social")}
        >
          <MathText tex={"\\sum_{i,j}\\gamma_{ij}S_{ij}(x_i,x_j)"} />
        </button>
        {theorem === 3 && (
          <>
            <span>+</span>
            <button
              aria-pressed={focus === "abstraction"}
              onClick={() => setFocus("abstraction")}
            >
              <MathText tex={"\\eta A(x)"} />
            </button>
          </>
        )}
        <div className="cl-term-values">
          {EDGE_PAIRS.map(([a, b], i) => (
            <button
              key={i}
              aria-pressed={focus === `pair${i}`}
              onClick={() => setFocus(`pair${i}`)}
              data-testid={`collective-pair-${i}`}
            >
              S{a + 1}
              {b + 1} <b>{fix(current.pairCosts[i])}</b>
            </button>
          ))}
          {theorem === 3 &&
            current.abstractionCosts.map((v, i) => (
              <button
                key={`a${i}`}
                aria-pressed={focus === `abstract${i}`}
                onClick={() => {
                  setFocus(`abstract${i}`);
                  setSelected(i);
                }}
              >
                A{i + 1} <b>{fix(v)}</b>
              </button>
            ))}
        </div>
      </div>

      <article className="cl-panel cl-personal">
        <div>
          <span className="cl-kicker">PERSONAL STABILITY</span>
          <h3>各主体は個人のTCZ内から開始</h3>
          <p>
            個人状態 rᵢ は初期時点から Vᵢ = 0 の領域 [−1, 1]
            にあり、その値を保ちます。それぞれ個人的に快適でも、共有表象 zᵢ
            は異なる位置から始まります。個人の安定と、集団の共有安定領域の閾値条件は別です。
          </p>
        </div>
        <div className="cl-personal-meters">
          {current.personal.map((r, i) => (
            <div key={i}>
              <div className="cl-meter-caption">
                <span style={{ color: COLORS[i] }}>主体 {i + 1}</span>
                <b>
                  r = {r.toFixed(3)}{" "}
                  <small>
                    V = {fix(0.5 * Math.max(0, Math.abs(r) - 1) ** 2)}
                  </small>
                </b>
              </div>
              <div className="cl-meter-track">
                <span className="cl-stability-zone" />
                <i
                  style={{
                    left: `${((r + 2.5) / 5) * 100}%`,
                    background: COLORS[i],
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </article>

      <article className="cl-panel cl-explanation" id="about">
        <span className="cl-kicker">THRESHOLD & CONVERGENCE</span>
        <h3>共有安定領域と、厳密な一致を区別する</h3>
        <p>
          原典の付録A.{theorem === 2 ? "3" : "4"}は、複合ポテンシャル{" "}
          {potentialName} が閾値 {thresholdName}{" "}
          以下になる集合への接近を扱います。非負分解から、その集合内では有効な結合について
          Sᵢⱼ ≤ {thresholdName}/γᵢⱼ と評価できます。
          {theorem === 3 && "さらに η > 0 なら A(x) ≤ θ_A/η です。"}
        </p>
        <p>
          正の閾値だけでは不一致やLUB残差が厳密に0になるとは言えません。原典の零極限には、閾値を0へ下げる列などの追加条件があります。ここで動かす勾配流は、費用が0へ収束する特殊な具体化です。分断していれば、費用が0でも別の集団どうしの表象は揃わない場合があります。
        </p>
        <p className="cl-source">
          原典：苫米地英人{" "}
          <a
            href="https://tomabechi.jp/TomabechiEvolution5theoremsJA.html"
            target="_blank"
            rel="noreferrer"
          >
            苫米地進化論（5定理版）・2026年7月12日更新 ↗
          </a>{" "}
          §2、基本仮定A1〜A6、付録A.3・A.4。
        </p>
      </article>
    </section>
  );
}
