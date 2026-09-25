import "./series-chrome.css";

type LabId = "lyapunov" | "evolution";
const labs = {
  lyapunov: { name: "LYAPUNOV", theorem: "01", theme: "収束と安定性" },
  evolution: { name: "EVOLUTION", theorem: "12", theme: "適応度と進化" },
};

function labUrl(lab: LabId): string | undefined {
  if (import.meta.env.DEV) {
    return `http://127.0.0.1:${lab === "lyapunov" ? 5173 : 5174}/`;
  }
  return lab === "lyapunov"
    ? "https://inthecradle.github.io/lyapunov-lab/"
    : import.meta.env.VITE_EVOLUTION_LAB_URL ||
        "https://inthecradle.github.io/evolution-lab/";
}

function openAbout() {
  const details = document.querySelector<HTMLDetailsElement>("#about details");
  if (details) details.open = true;
}

export function SeriesHeader({ lab }: { lab: LabId }) {
  const { name, theorem } = labs[lab];
  return (
    <header className="series-header" id="top">
      <p className="series-label">COGNITIVE DYNAMICS SERIES</p>
      <div className="series-header-row">
        <a
          href="#top"
          className="series-wordmark"
          aria-label={`${name} LAB ホーム`}
        >
          <svg viewBox="0 0 36 36" aria-hidden="true">
            {lab === "lyapunov" ? (
              <>
                <ellipse cx="18" cy="18" rx="15" ry="10" />
                <ellipse cx="18" cy="18" rx="9" ry="6" />
                <circle cx="29" cy="12" r="2.5" />
              </>
            ) : (
              <path d="M3 29C15 29 16 7 33 7M3 29C18 29 23 25 33 25" />
            )}
          </svg>
          <span>
            {name} <b>LAB</b>
          </span>
        </a>
        <div className="series-header-actions">
          <span className="series-theorem">THEOREM {theorem}</span>
          <a href="#about" className="series-about-link" onClick={openAbout}>
            この実験について <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    </header>
  );
}

export function SeriesFooter({ lab }: { lab: LabId }) {
  return (
    <footer className="series-footer">
      <p className="series-label">COGNITIVE DYNAMICS SERIES</p>
      <nav className="series-labs" aria-label="シリーズの実験">
        {(Object.keys(labs) as LabId[]).map((id) => {
          const entry = labs[id];
          const content = (
            <>
              <strong>{entry.name} LAB</strong>
              <span>{entry.theme}</span>
            </>
          );
          if (id === lab)
            return (
              <span key={id} className="series-lab" aria-current="page">
                {content}
                <small>現在のLab</small>
              </span>
            );
          const url = labUrl(id);
          return url ? (
            <a key={id} className="series-lab" href={url}>
              {content}
              <small aria-hidden="true">↗</small>
            </a>
          ) : (
            <span key={id} className="series-lab series-unavailable">
              {content}
              <small>公開準備中</small>
            </span>
          );
        })}
      </nav>
      <p className="series-description">
        苫米地定理の数理構造を、操作して学ぶ教育用シミュレーターです。
        <br />
        具体関数・可視化モデルの設定と、参照資料の定理を区別しています。
      </p>
      <a href="#about" className="series-sources" onClick={openAbout}>
        この実験について・出典 <span aria-hidden="true">↑</span>
      </a>
      <div className="series-owner">
        <a
          href="https://note.com/dawn_of_coaching"
          target="_blank"
          rel="noopener noreferrer"
        >
          コーチングの夜明け <span aria-hidden="true">↗</span>
        </a>
        <span aria-hidden="true">／</span>
        <span>CognitiveMind Inc.</span>
      </div>
    </footer>
  );
}
