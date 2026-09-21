import type { MathId } from "../interaction";
import {
  DEFAULT_PARAMETERS,
  dynamicsOf,
  guarantees,
  potential,
  potentialDerivative,
  sampleAt,
  type Parameters,
} from "../model/lyapunov";
import { MathText } from "./MathToken";

export type Study = "comparison" | "break" | "invariance" | "lasalle";

const STUDIES: { id: Study; label: string }[] = [
  { id: "comparison", label: "比較評価" },
  { id: "break", label: "条件を壊す" },
  { id: "invariance", label: "前方不変性" },
];

export function presetsForStudy(study: Study, params: Parameters): Parameters {
  switch (study) {
    case "comparison":
      return {
        ...params,
        dynamics: "drift",
        initial: { ...DEFAULT_PARAMETERS.initial },
      };
    case "break":
      return {
        ...params,
        dynamics: "slow",
        initial: { ...DEFAULT_PARAMETERS.initial },
      };
    case "invariance":
      return {
        ...params,
        dynamics: "normal",
        rotation: 0.55,
        initial: { x: Math.sqrt(params.theta), y: 0 },
      };
    case "lasalle":
      return {
        ...params,
        dynamics: "lasalle",
        rotation: 1,
        alpha: 0.7,
        extraDecay: 0.35,
        initial: { x: 2, y: 0 },
      };
  }
}

const COPY: Record<Study, { title: string; text: string }> = {
  comparison: {
    title: "実際の減少と、保証される上限を比べる。",
    text: "外側から再生すると、閾値との差が指数上限の下で減っていきます。追加の減少を0にすると、2本の曲線が重なります。",
  },
  break: {
    title: "条件を変えると、どの結論が残るでしょうか。",
    text: "減少の速さや向きを変えて、上限と軌道を比べます。現在の点でVが減っていても、領域全体での条件を満たすとは限りません。",
  },
  invariance: {
    title: "境界での向きと、領域から出ない性質を見る。",
    text: "初期状態をTCZの内側・境界に切り替えて再生します。ここでは、状態がθを越えない3つの場を比較します。外向きの動きも境界では弱まり、領域内に留まります。",
  },
  lasalle: {
    title: "一瞬の散逸ゼロと、そこに留まる軌道を分ける。",
    text: "散逸がゼロの線から再生します。結合があると線を離れ、Vが減少します。結合をなくすと、この線上の各点に留まります。",
  },
};

function format(value: number): string {
  return (Math.abs(value) < 0.00005 ? 0 : value).toFixed(4);
}

function Guarantee({
  label,
  valid,
  yes,
  no,
}: {
  label: string;
  valid: boolean;
  yes: string;
  no: string;
}) {
  return (
    <div className={`guarantee-item ${valid ? "valid" : "invalid"}`}>
      <span>{label}</span>
      <strong>{valid ? yes : no}</strong>
    </div>
  );
}

export default function ExperimentControls({
  study,
  params,
  time,
  onStudyChange,
  onChange,
  onSelect,
}: {
  study: Study;
  params: Parameters;
  time: number;
  onStudyChange: (study: Study) => void;
  onChange: (params: Parameters) => void;
  onSelect: (id: MathId) => void;
}) {
  const mode = dynamicsOf(params);
  const result = guarantees(params);
  const current = sampleAt(time, params);
  const margin = -params.alpha * current.residual - current.derivative;
  const initialValue = potential(params.initial, params);
  const boundary =
    initialValue > 0
      ? {
          x: params.initial.x * Math.sqrt(params.theta / initialValue),
          y: params.initial.y * Math.sqrt(params.theta / initialValue),
        }
      : { x: Math.sqrt(params.theta), y: 0 };
  const boundaryDerivative =
    mode === "drift" ? null : potentialDerivative(boundary, params);
  const setMode = (dynamics: Parameters["dynamics"]) =>
    onChange({ ...params, dynamics });
  const startAt = (factor: number) =>
    onChange({
      ...params,
      initial: { x: factor * Math.sqrt(params.theta), y: 0 },
    });
  const isStartAt = (factor: number) =>
    Math.abs(params.initial.x - factor * Math.sqrt(params.theta)) < 1e-8 &&
    Math.abs(params.initial.y) < 1e-8;
  const isInitialAt = (x: number, y: number) =>
    Math.abs(params.initial.x - x) < 1e-8 &&
    Math.abs(params.initial.y - y) < 1e-8;

  return (
    <section className="panel scenario-panel" aria-label="学習実験">
      <div className="study-tabs" role="group" aria-label="学習テーマ">
        {STUDIES.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-pressed={study === id}
            onClick={() => onStudyChange(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="scenario-copy">
        <h2>
          {mode === "drift"
            ? "TCZに近づき、入った後の動きを見る。"
            : COPY[study].title}
        </h2>
        <p>
          {mode === "drift"
            ? "外側ではVが減少してTCZに到達します。入った後は、それまでの速度を引き継ぎ、領域内の楕円軌道を漂います。"
            : COPY[study].text}
        </p>
        <p className="subtle">
          条件や初期状態のボタンを選ぶと、時刻0からやり直します。
        </p>
      </div>

      <div className="scenario-options" role="group" aria-label="実験の条件">
        {study === "comparison" && (
          <>
            <button
              type="button"
              aria-pressed={mode === "drift"}
              onClick={() => setMode("drift")}
            >
              TCZに入って漂う
            </button>
            <button
              type="button"
              aria-pressed={mode === "normal" && params.extraDecay === 0}
              onClick={() =>
                onChange({ ...params, dynamics: "normal", extraDecay: 0 })
              }
            >
              上限と一致させる
            </button>
          </>
        )}
        {study === "break" &&
          (
            [
              ["normal", "保証を満たす"],
              ["slow", "減少を弱める"],
              ["orbit", "減少を止める"],
              ["outward", "外向きにする"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
            >
              {label}
            </button>
          ))}
        {study === "invariance" && (
          <>
            {(
              [
                ["normal", "境界に接する"],
                ["inward", "内側へ向ける"],
                ["contained", "外側へ向ける"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
              >
                {label}
              </button>
            ))}
            <span className="scenario-option-divider" aria-hidden="true" />
            {(
              [
                [0.7, "内側から"],
                [1, "境界から"],
              ] as const
            ).map(([factor, label]) => (
              <button
                key={factor}
                type="button"
                aria-pressed={isStartAt(factor)}
                onClick={() => startAt(factor)}
              >
                {label}
              </button>
            ))}
          </>
        )}
        {study === "lasalle" && (
          <>
            <button
              type="button"
              aria-pressed={params.rotation !== 0}
              onClick={() =>
                onChange({ ...params, dynamics: "lasalle", rotation: 1 })
              }
            >
              結合あり
            </button>
            <button
              type="button"
              aria-pressed={params.rotation === 0}
              onClick={() =>
                onChange({ ...params, dynamics: "lasalle", rotation: 0 })
              }
            >
              結合なし
            </button>
            <button
              type="button"
              aria-pressed={isInitialAt(2, 0)}
              onClick={() => onChange({ ...params, initial: { x: 2, y: 0 } })}
            >
              散逸ゼロの線から
            </button>
          </>
        )}
      </div>

      {study === "comparison" && mode !== "drift" && (
        <p className="inline-note">
          「上限と一致させる」は、境界へ漸近する比較例です。
        </p>
      )}
      {mode === "drift" && (
        <p className="inline-note">
          TCZ内の漂遊は、領域内に留まる様子を示すために加えた可視化です。元の数式から内部軌道が決まるという意味ではありません。保証表示は、この教材の初期化・切替ルールで生成した軌道についてのものです。
        </p>
      )}

      {mode === "contained" && (
        <p className="inline-note">
          外向きの成分はθに近づくほど弱まり、境界では0になります。内側からの状態は、θを越えずに境界へ近づきます（原点は静止）。
        </p>
      )}

      <div className="guarantee-grid" aria-label="領域全体の性質">
        {study === "lasalle" ? (
          <>
            <div className="guarantee-item neutral">
              <span>散逸がゼロの集合 E</span>
              <strong>
                <MathText tex="x_2=0" />
              </strong>
            </div>
            <div className="guarantee-item valid">
              <span>E内の最大不変集合 M</span>
              <strong>
                <MathText
                  tex={params.rotation !== 0 ? "\\{(0,0)\\}" : "\\{x_2=0\\}"}
                />
              </strong>
            </div>
            <div className="guarantee-item neutral">
              <span>このモデルの漸近挙動</span>
              <strong>
                {params.rotation !== 0
                  ? "原点へ収束"
                  : "初期 x₁ を保って線へ収束"}
              </strong>
            </div>
          </>
        ) : (
          <>
            <Guarantee
              label="指定したαでの指数上限"
              valid={result.comparison}
              yes={
                mode === "drift" ? "この可視化モデルで成立" : "全域条件を満たす"
              }
              no="保証なし・参考線"
            />
            <Guarantee
              label="TCZの前方不変性"
              valid={result.forwardInvariant}
              yes="内側から出ない"
              no="成立しない"
            />
            <Guarantee
              label="全初期状態からTCZへの距離"
              valid={result.convergesToTCZ}
              yes="0へ収束"
              no="0への収束は保証なし"
            />
          </>
        )}
      </div>

      <div className="scenario-metrics" aria-label="現在の数値">
        <button type="button" onClick={() => onSelect("derivative")}>
          <MathText tex="\\dot V(x(t))" />
          <output>{format(current.derivative)}</output>
        </button>
        {study !== "lasalle" && (
          <>
            <button type="button" onClick={() => onSelect("comparison")}>
              <span>外側の減少条件の余裕</span>
              <output>
                {current.residual > 1e-8
                  ? format(margin)
                  : "内側・境界は対象外"}
              </output>
            </button>
            {boundaryDerivative !== null && (
              <button type="button" onClick={() => onSelect("omega")}>
                <span>
                  初期方向の境界での <MathText tex="\\dot V" />
                </span>
                <output>{format(boundaryDerivative)}</output>
              </button>
            )}
          </>
        )}
      </div>

      <details className="scenario-details">
        <summary>条件と数値の読み方</summary>
        {study === "lasalle" ? (
          <p>
            この実験では{" "}
            <MathText tex="q=(x_1,\\sqrt b\\,x_2),\\quad \\dot q=(\\omega q_2,-\\omega q_1-dq_2)" />
            、
            <MathText tex="d=\\alpha(1+\\delta)>0" /> としています。
            <MathText tex="\\dot V=-2dbx_2^2\\leq0" />{" "}
            で、閉じた有界な劣位集合内に軌道が留まります。
            LaSalleの原理が示すのは、Eの中で軌道がずっと留まれる最大不変集合Mへの接近です。
            結合なしではMが線全体となり、全初期状態からの原点収束は言えません。
          </p>
        ) : (
          <>
            <p>
              余裕は <MathText tex="-\\alpha(V-\\theta)-\\dot V" />{" "}
              です。外側で0以上なら、その点では減少条件を満たします。
              {mode === "drift"
                ? "上の保証表示は、この教材の初期化・切替ルールで生成した軌道全体についてのものです。"
                : "上の保証表示は現在の一点でなく、モデルの全域条件に基づきます。"}
            </p>
            {mode !== "drift" && (
              <p>
                境界での値は、初期状態と同じ方向の境界点で評価しています。0は接する向き、負は内向き、正は外向きを表します。このモデルでは境界全体の向きも同じです。
              </p>
            )}
            {mode === "drift" && (
              <p>
                外側では{" "}
                <MathText tex="\\dot V=-\\beta V,\\quad\\beta=\\alpha(1+\\delta)" />{" "}
                とし、有限時間でTCZに入ります。
                内側の追加モデルはTCZ内部の切替点で位置と速度を引き継ぎ、両方が連続になるよう接続しています。
                内部軌道は切替時の状態にも依存するため、位置だけから境界の向きを評価する数値は表示していません。
                δが0でも、閾値との差の曲線は指数上限とは一致しません。
              </p>
            )}
            {mode === "slow" && (
              <p>
                弱い減少でもTCZへの距離は0へ収束します。ただし減少率が指定したαより小さいため、表示された指数曲線は上限として使えません。
              </p>
            )}
            {mode === "orbit" && (
              <p>
                Vが一定なので、外側の軌道のTCZまでの距離は0へ収束しません。内側に留まる性質と、外側から接近する性質は別に確認します。
              </p>
            )}
            {mode === "outward" && (
              <p>
                原点以外ではVが1.6θへ近づくモデルです。遠い外側でVが減っていても、境界では外向きのため、TCZの前方不変性は成立しません。
              </p>
            )}
            {mode === "contained" && (
              <p>
                この場では{" "}
                <MathText tex="\\dot V=\\beta V(1-V/\\theta),\\quad\\beta=\\alpha(1+\\delta)" />
                です。内側ではVが増え、境界では変化が0、外側ではVが減ります。内側から始まった軌道は境界を越えず、TCZの前方不変性が成立します。
              </p>
            )}
            {mode === "normal" && (
              <p>
                {study === "invariance"
                  ? "この場では内側・境界のVは一定で、同じ高さに沿って動きます。領域に留まることは、その中の一点への収束を意味しません。"
                  : "外側からの接近は漸近的です。有限時間でのTCZへの到達や、TCZ内の一点への収束を意味しません。"}
              </p>
            )}
          </>
        )}
      </details>
    </section>
  );
}
