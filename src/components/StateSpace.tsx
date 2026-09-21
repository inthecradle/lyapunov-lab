import { useState, type ComponentProps } from "react";
import StateSpace2D from "./StateSpace2D";
import StateSpace3D from "./StateSpace3D";

type Props = ComponentProps<typeof StateSpace2D>;

export default function StateSpace(props: Props) {
  const [view, setView] = useState<"3d" | "2d">("3d");
  return (
    <div className="state-space-container">
      <div className="state-view-toolbar">
        <span>
          {view === "3d" ? "Vを高さに対応（周辺を圧縮）" : "等高線で高さを見る"}
        </span>
        <div className="segmented small" aria-label="状態空間の表示">
          <button aria-pressed={view === "3d"} onClick={() => setView("3d")}>
            3D 地形
          </button>
          <button aria-pressed={view === "2d"} onClick={() => setView("2d")}>
            2D 等高線
          </button>
        </div>
      </div>
      {view === "3d" ? (
        <StateSpace3D {...props} />
      ) : (
        <StateSpace2D {...props} />
      )}
    </div>
  );
}
