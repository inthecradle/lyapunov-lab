import { memo } from "react";
import katex from "katex";
import { MATH_HELP, type MathId } from "../interaction";

export const MathText = memo(function MathText({
  tex,
  display = false,
}: {
  tex: string;
  display?: boolean;
}) {
  // Only developer-authored formula strings enter KaTeX. No user HTML or trust mode.
  return (
    <span
      className="math"
      dangerouslySetInnerHTML={{
        __html: katex.renderToString(tex, {
          throwOnError: false,
          displayMode: display,
          trust: false,
          output: "htmlAndMathml",
        }),
      }}
    />
  );
});

export default function MathToken({
  id,
  tex,
  active,
  onSelect,
}: {
  id: MathId;
  tex: string;
  active: MathId | null;
  onSelect: (id: MathId) => void;
}) {
  return (
    <button
      className={`math-token ${active === id ? "selected" : ""}`}
      data-math-token={id}
      aria-label={MATH_HELP[id].label}
      aria-pressed={active === id}
      title={MATH_HELP[id].text}
      onClick={() => onSelect(id)}
      onMouseEnter={() => onSelect(id)}
      onFocus={() => onSelect(id)}
    >
      <MathText tex={tex} />
    </button>
  );
}
