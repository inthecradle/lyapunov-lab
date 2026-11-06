import { COLLECTIVE_DURATION } from "../model/collective";

type Props = {
  time: number;
  playing: boolean;
  playbackRate: number;
  onToggle: () => void;
  onReset: () => void;
  onSeek: (time: number) => void;
};

export default function CollectiveTransport({
  time,
  playing,
  playbackRate,
  onToggle,
  onReset,
  onSeek,
}: Props) {
  const playbackTime = time / playbackRate;
  const playbackDuration = COLLECTIVE_DURATION / playbackRate;
  return (
    <div className="cl-panel cl-transport">
      <button className="cl-play" data-testid="cl-play" onClick={onToggle}>
        {playing ? "Ⅱ 一時停止" : "▶ 再生"}
      </button>
      <button className="cl-reset" aria-label="時刻を0に戻す" onClick={onReset}>
        ↺
      </button>
      <label className="cl-timeline">
        <span>収束の再生位置 · 再生速度 {playbackRate}倍</span>
        <input
          type="range"
          min="0"
          max={COLLECTIVE_DURATION}
          step="0.01"
          value={time}
          aria-label="共有モデルの時間"
          aria-valuetext={`収束の再生時間 ${playbackTime.toFixed(2)} 秒、モデル時間 ${time.toFixed(2)}`}
          data-testid="cl-time"
          onChange={(e) => onSeek(Number(e.target.value))}
        />
      </label>
      <output
        className="cl-time"
        data-testid="collective-time"
        data-model-time={time}
        data-playback-time={playbackTime}
      >
        {playbackTime.toFixed(2)} <small>/ {playbackDuration} 秒</small>
        <span className="cl-model-time">モデル t = {time.toFixed(2)}</span>
      </output>
    </div>
  );
}
