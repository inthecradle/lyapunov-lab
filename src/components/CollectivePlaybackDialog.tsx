import { COLLECTIVE_COLORS as COLORS } from "./collectivePresentation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  sampleCollective,
  type CollectiveParameters,
  type CollectiveSample,
} from "../model/collective";
import {
  collectiveAgentCosts,
  collectiveAgentCostAxisMax,
  collectivePlaybackTerrain,
} from "../model/collectivePlayback";
import CollectiveAgentCostChart from "./CollectiveAgentCostChart";
import CollectivePlaybackTerrain from "./CollectivePlaybackTerrain";
import CollectivePlaybackHeightChart from "./CollectivePlaybackHeightChart";
import { terrainThreshold } from "../model/terrainThreshold";
import { COLLECTIVE_INTRO_DURATION } from "../model/collectiveIntro";
import "./collective-playback.css";

export default function CollectivePlaybackDialog({
  parameters,
  current,
  introProgress,
  onSkipIntro,
  onReplayIntro,
  controls,
  onClose,
}: {
  parameters: CollectiveParameters;
  current: CollectiveSample;
  introProgress: number;
  onSkipIntro: () => void;
  onReplayIntro: () => void;
  controls: ReactNode;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [yaw, setYaw] = useState(-28);
  const [elevation, setElevation] = useState(28);
  useEffect(() => {
    const node = dialog.current!;
    const overflow = document.body.style.overflow;
    node.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      node.close();
      document.body.style.overflow = overflow;
      // The page transport remounts when the modal closes.
      document
        .querySelector<HTMLButtonElement>('[data-testid="cl-play"]')
        ?.focus({ preventScroll: true });
    };
  }, []);
  const terrain = useMemo(
    () => collectivePlaybackTerrain(parameters),
    [parameters],
  );
  const initialSample = useMemo(
    () => sampleCollective(0, parameters),
    [parameters],
  );
  const initialCosts = useMemo(
    () => collectiveAgentCosts(initialSample, parameters),
    [initialSample, parameters],
  );
  const currentCosts = useMemo(
    () => collectiveAgentCosts(current, parameters),
    [current, parameters],
  );
  const costAxisMax = useMemo(
    () => collectiveAgentCostAxisMax(parameters),
    [parameters],
  );
  const thresholdIndex = Math.max(
    0,
    parameters.initial.findIndex((_, i) => !terrain.isolated(i)),
  );
  const threshold = useMemo(
    () => terrainThreshold(parameters, thresholdIndex),
    [parameters, thresholdIndex],
  );
  const thresholdName = parameters.theorem === 3 ? "θ_A" : "θ";
  const potentialName = parameters.theorem === 3 ? "ℒ_A" : "ℒ";
  const introActive = parameters.theorem === 3 && introProgress < 1;
  return (
    <dialog
      ref={dialog}
      className="cl-playback-dialog"
      data-testid="collective-playback-dialog"
      aria-labelledby="cl-playback-title"
      aria-describedby="cl-playback-description"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="cl-playback-header">
        <div>
          <span className="cl-kicker">
            THEOREM 0{parameters.theorem} / CONVERGENCE
          </span>
          <h2 id="cl-playback-title">
            {parameters.theorem === 2
              ? "個人の不快と、相互の不整合。"
              : "個人の谷から、共通の谷へ。"}
          </h2>
        </div>
        <button type="button" className="cl-playback-close" onClick={onClose}>
          閉じて一時停止 <span aria-hidden="true">×</span>
        </button>
      </header>
      <p id="cl-playback-description">
        {parameters.theorem === 2
          ? "全主体が個人の不快Vᵢ=0の状態から始まります。3Dは不一致費用Qの地形で、個人評価Vᵢは含みません。主体別の評価では、個人の不快と相互の不整合を同じゼロ基準・固定目盛りで積み上げます。個人の谷との深さ比較には使いません。"
          : "3つの個人の谷が共通の地形へ変形し、その後に主体が収束します。変形中はモデル時刻と主体の位置を保ちます。高さの比較は、ηAᵢの実際の評価値を0から一定間隔の目盛りで表示します。"}
        再生中も回転・仰角を操作できます。収束中の地形と高さの変換は固定します。
        {parameters.theorem === 2 &&
          "γを変えても、3Dの高さの基準と積み上げ図の目盛りを揃えて比較できます。"}
      </p>
      <div className="cl-playback-plots">
        <CollectivePlaybackTerrain
          parameters={parameters}
          current={current}
          terrain={terrain}
          introProgress={introProgress}
          yaw={yaw}
          elevation={elevation}
        />
        {parameters.theorem === 2 ? (
          <CollectiveAgentCostChart
            initial={initialCosts}
            current={currentCosts}
            axisMax={costAxisMax}
            theta={parameters.theta}
          />
        ) : (
          <CollectivePlaybackHeightChart
            parameters={parameters}
            current={current}
            terrain={terrain}
          />
        )}
      </div>
      {parameters.theorem === 3 && (
        <div className="cl-playback-intro">
          <p data-testid="convergence-intro-status">
            {introActive
              ? introProgress === 0
                ? "3人の個人の谷"
                : "共通の地形へ変化"
              : "共通の地形 · 変形完了"}{" "}
            · {(introProgress * COLLECTIVE_INTRO_DURATION).toFixed(1)} /{" "}
            {COLLECTIVE_INTRO_DURATION}秒
          </p>
          {introActive && (
            <p>
              変形は説明用の概念図です。論文の評価関数の時間変化を表しません。
            </p>
          )}
          <button type="button" onClick={onReplayIntro}>
            変形を最初から再生
          </button>{" "}
          {introActive && (
            <button type="button" onClick={onSkipIntro}>
              導入をスキップ
            </button>
          )}
        </div>
      )}
      <div
        className="cl-playback-camera"
        role="group"
        aria-label="収束3Dの視点操作"
      >
        <label>
          回転{" "}
          <input
            type="range"
            min="-80"
            max="80"
            step="1"
            value={yaw}
            aria-label="収束3D視点の回転"
            onChange={(event) => setYaw(Number(event.target.value))}
          />
          <output>{yaw}°</output>
        </label>
        <label>
          仰角{" "}
          <input
            type="range"
            min="22"
            max="65"
            step="1"
            value={elevation}
            aria-label="収束3D視点の仰角"
            onChange={(event) => setElevation(Number(event.target.value))}
          />
          <output>{elevation}°</output>
        </label>
      </div>
      <div className="cl-playback-threshold" hidden={introActive}>
        <p>
          <span aria-hidden="true" /> 緑：{terrain.label} ≤ {thresholdName} ={" "}
          {parameters.theta.toFixed(2)}（座標0〜1の地形上の範囲）
        </p>
        <p>
          {threshold.kind === "all"
            ? "この評価項による位置の制約がないため、座標0〜1の全域を緑色で表示します。"
            : "谷底の評価は0なので、緑の領域は初期状態から存在します。"}
          集団全体が閾値以下になるための必要条件です。合成評価の判定とは区別します。
        </p>
        <p
          data-testid="convergence-threshold-status"
          data-threshold-reached={current.thresholdReached}
        >
          合成評価 {potentialName} = {current.total.toFixed(4)}{" "}
          {current.thresholdReached ? "≤" : ">"} {thresholdName} ={" "}
          {parameters.theta.toFixed(2)} ·{" "}
          {current.thresholdReached ? "閾値以下" : "閾値の外"}
        </p>
      </div>
      <div className="cl-playback-controls">{controls}</div>
      <div className="cl-playback-values">
        {parameters.initial.map((q, i) => (
          <p key={i} style={{ borderColor: COLORS[i] }}>
            <strong style={{ color: COLORS[i] }}>主体{i + 1}</strong>
            <span>
              初期{" "}
              {parameters.theorem === 2
                ? initialCosts[i].total.toFixed(4)
                : terrain.agentValue(i, q).toFixed(4)}{" "}
              → 現在{" "}
              {parameters.theorem === 2
                ? currentCosts[i].total.toFixed(4)
                : terrain.agentValue(i, current.positions[i]).toFixed(4)}
            </span>
            {parameters.theorem === 2 && (
              <>
                <span>
                  個人の不快 {initialCosts[i].personal.toFixed(4)} →{" "}
                  {currentCosts[i].personal.toFixed(4)}
                </span>
                <span>
                  相互の不整合 {initialCosts[i].social.toFixed(4)} →{" "}
                  {currentCosts[i].social.toFixed(4)}
                </span>
              </>
            )}
          </p>
        ))}
      </div>
      <p className="cl-playback-note">
        {!terrain.hasValley
          ? parameters.theorem === 3
            ? "η = 0のためLUBへの谷は平らです。結合がある場合は、平らな地形の上で主体同士が近づきます。"
            : "結合がないため共通の谷は平らで、共有表象は動きません。"
          : parameters.theorem === 3
            ? "地形は ηAᵢ = η‖zᵢ − LUB‖²/2 です。結合による移動も含むため、個々の主体の高さが一時的に増す場合があります。"
            : terrain.exact
              ? "地形は不一致費用の各主体への分解 Q です。結合した主体の評価値の和が不一致費用に一致します。"
              : "地形 Q は不一致費用の下界です。不均一な結合では、個々の主体の高さが一時的に増す場合があります。"}{" "}
        {parameters.theorem === 2 &&
          !terrain.exact &&
          "一部のγだけを強くすると下界Qの地形が変わらない場合があります。実際の費用は主体別の評価で確認できます。"}
        3Dの高さは元の画面と同じ非線形の表示圧縮です。
        {parameters.theorem === 2
          ? "主体別の評価Cᵢ = Vᵢ + ΣⱼγᵢⱼSᵢⱼは常にVᵢ以上で、3主体の合計がℒです。個々の評価が常に減るとは限りませんが、合成評価はこのモデルで減少します。"
          : "評価値と下降量は「高さの比較」で確認できます。"}
      </p>
    </dialog>
  );
}
