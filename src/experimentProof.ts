import { dynamicsOf, guarantees, type Parameters } from "./model/lyapunov";
import { PROOF_STEPS, type ProofStep } from "./proof";
import type { Study } from "./components/ExperimentControls";

export function experimentProof(params: Parameters, study: Study): ProofStep[] {
  const dynamics = dynamicsOf(params);
  const valid = guarantees(params);
  if (dynamics === "drift") {
    return [
      ...PROOF_STEPS.slice(0, 3),
      {
        short: "減少条件",
        title: "外側では、指数上限を満たしながら進む。",
        text: "この到達例では外側の動きをV̇ = −βV、β = α(1+δ)と置いています。V > θではV̇ ≤ −α(V−θ)なので、比較評価の条件も満たします。",
        tex: String.raw`\dot V=-\beta V\leq-\alpha(V-\theta)\quad(V>\theta)`,
        focus: "derivative",
        engine: "外側の減少条件を確認",
      },
      {
        short: "到達",
        title: "θに到達し、TCZの内側へ進む。",
        text: "外側から始めるとT = log(V(0)/θ)/βで境界に到達します。内部ではyが負になるので、全時刻の比較には正部分y₊ = max(y,0)を使います。有限時間到達は、この教材で選んだ場の性質です。",
        tex: String.raw`T=\begin{cases}\log(V(0)/\theta)/\beta&V(0)>\theta\\0&V(0)\leq\theta\end{cases}`,
        focus: "theta",
        engine: "有限時間の到達を確認",
      },
      {
        short: "滞在",
        title: "TCZの中では、動きながら留まる。",
        text: "TCZ内部の切替点で位置と速度を連続につなぎ、内部を漂う軌道を追加しています。Vは増減してもθ以下を保ちます。この内部軌道は説明用に選んだ可視化で、元の数式が漂い方まで指定しているわけではありません。",
        tex: String.raw`t\geq T\ \Longrightarrow\ V(x(t))\leq\theta`,
        focus: "omega",
        engine: "TCZ内の滞在を確認",
      },
    ];
  }
  if (study === "lasalle") {
    const coupled = params.rotation !== 0;
    return [
      {
        short: "設定",
        title: "同じ地形に、別の動きを与える。",
        text: "q₁ = x₁、q₂ = √b x₂ とおきます。V = q₁² + q₂² は同じですが、散逸はq₂方向だけに働きます。ωが2つの方向を結びつけます。",
        tex: String.raw`\dot q_1=\omega q_2,\quad\dot q_2=-\omega q_1-dq_2`,
        focus: "x",
        engine: "自律系を定義",
      },
      {
        short: "有界性",
        title: "軌道が留まる、有限の領域を用意する。",
        text: "Vは増加しないため、軌道は初期値V(x₀)以下の閉じた楕円領域に留まります。このコンパクトな前方不変集合の中でLaSalleの原理を使います。",
        tex: String.raw`K=\{x:V(x)\leq V(x_0)\}`,
        focus: "V",
        engine: "コンパクトな不変集合",
      },
      {
        short: "散逸",
        title: "下がらない瞬間もある。",
        text: "d = α(1+δ) > 0 とすると、V̇ = −2d q₂² ≤ 0です。q₂ = 0では傾きが0になるため、V̇ < 0をすべての非零状態に要求する議論は使えません。",
        tex: String.raw`\dot V=-2d q_2^2\leq0`,
        focus: "derivative",
        engine: "非増加を確認",
      },
      {
        short: "ゼロ集合",
        title: "散逸が0になる集合を見つける。",
        text: "黄色の破線が E = {x₂ = 0}です。ここではその瞬間のV̇が0になります。「ずっとその場所に留まれる」とは、まだ言っていません。",
        tex: String.raw`E=\{x:\dot V(x)=0\}=\{x:x_2=0\}`,
        focus: "derivative",
        engine: "散逸ゼロ集合 E",
      },
      {
        short: "不変集合",
        title: coupled
          ? "線の上にいても、原点以外では線から動き出す。"
          : "結合をなくすと、線そのものに留まれる。",
        text: coupled
          ? "q₂ = 0上では q̇₂ = −ωq₁です。ω ≠ 0なら原点以外で線から離れるので、Eの中の最大不変集合Mは原点だけになります。"
          : "ω = 0では q₁が一定で、q₂だけが減衰します。E上のすべての点が平衡点になり、最大不変集合MはE全体です。",
        tex: coupled
          ? String.raw`\omega\ne0\ \Longrightarrow\ M=\{0\}`
          : String.raw`\omega=0\ \Longrightarrow\ M=E`,
        focus: "x",
        engine: "最大不変集合 M",
      },
      {
        short: "結論",
        title: coupled
          ? "最大不変集合である原点へ収束する。"
          : "線への収束と、TCZへの収束を区別する。",
        text: coupled
          ? "LaSalleの不変原理により、K内の軌道はM = {0}へ収束します。原点はTCZ内にあります。シミュレーションの見た目ではなく、これまで確認した仮定から得る結論です。"
          : "この場では x(t) → (x₁(0), 0)です。x₁(0)² > θなら極限はTCZの外にあります。Vが非増加でも、TCZへの収束が自動的に決まるわけではありません。",
        tex: coupled
          ? String.raw`x(t)\longrightarrow0`
          : String.raw`x(t)\longrightarrow(x_1(0),0)`,
        focus: "omega",
        engine: "Mへの収束を結論",
      },
    ];
  }
  if (study === "invariance")
    return [
      {
        short: "領域",
        title: "「一度入ったら出ない」を調べる。",
        text: "前方不変とは、TCZ内から始まったすべての軌道が、将来もTCZ内に留まる性質です。外側から近づく収束とは別の問いです。",
        tex: String.raw`x(0)\in\Omega_\theta\Rightarrow x(t)\in\Omega_\theta`,
        focus: "omega",
        engine: "前方不変性を定義",
      },
      {
        short: "境界",
        title: "領域の境界で、動く方向を見る。",
        text:
          dynamics === "contained"
            ? "内側で外向きに進んでも、V = θでは外向きの成分が0になります。輪郭上の矢印は境界に沿う回転を表し、境界を横切りません。"
            : "境界では V = θです。3Dの輪郭上の矢印がその場所でのベクトル場を表します。境界から始めると、この向きを直接確認できます。",
        tex: String.raw`\partial\Omega_\theta=\{x:V(x)=\theta\}`,
        focus: "theta",
        engine: "境界を確認",
      },
      {
        short: "方向",
        title: "高さの変化から、内向き・接線・外向きを読む。",
        text: "V̇ = ∇V・Fが負なら内向き、0なら境界の接線方向、正なら外向きです。この二次関数とθ > 0では、境界上の∇Vは零になりません。",
        tex: String.raw`\dot V=\nabla V\cdot F`,
        focus: "derivative",
        engine: "境界の方向を評価",
      },
      {
        short: "判定",
        title: valid.forwardInvariant
          ? "境界全体で、外向きの動きがない。"
          : "境界に、外向きの動きがある。",
        text: valid.forwardInvariant
          ? "選んだ場は局所Lipschitz連続で、この滑らかな境界の全点でV̇ ≤ 0です。この条件からTCZの前方不変性を確認できます。"
          : "この場では境界で V̇ = βθ(1−1/1.6) > 0です。境界から始まった状態が外へ出るため、TCZの前方不変性は失われます。",
        tex: valid.forwardInvariant
          ? String.raw`\dot V|_{V=\theta}\leq0`
          : String.raw`\dot V|_{V=\theta}>0`,
        focus: "theta",
        engine: "外向きがないか確認",
        valid: valid.forwardInvariant,
      },
      {
        short: "実験",
        title: "内側と境界から、同じ場を試す。",
        text:
          dynamics === "contained"
            ? "0 < V(0) < θならVは増加しますが、θを越えずに近づきます。V(0) = θなら高さを保ちます。原点は静止します。"
            : "初期位置のボタンで出発点を変えてから再生します。1本の軌道の観察と、全初期条件についての保証は区別して表示しています。",
        tex: String.raw`\Omega_\theta=\{x:V(x)\leq\theta\}`,
        focus: "x",
        engine: "初期条件を変えて観察",
      },
      {
        short: "結論",
        title: valid.forwardInvariant
          ? "前方不変性を、収束とは分けて確認できた。"
          : "前方不変性の条件が崩れることを確認した。",
        text: valid.forwardInvariant
          ? "内側から出ないことは、外側から入ることを意味しません。接線方向だけに動く軌道も、前方不変性とは両立します。"
          : "「いま内側にいる」だけでは、将来も内側に留まるとは言えません。場を「境界に接する」または「内側へ向ける」に戻して比べられます。",
        tex: valid.forwardInvariant
          ? String.raw`\Omega_\theta\text{ is forward invariant}`
          : String.raw`\Omega_\theta\text{ is not forward invariant}`,
        focus: "omega",
        engine: "不変性と収束を区別",
      },
    ];
  if (!valid.comparison) {
    const why =
      dynamics === "slow"
        ? "Vは下がりますが、減少率は0.35αです。αで設定した条件を満たしません。"
        : dynamics === "orbit"
          ? "Vが一定のまま周回します。外側ではy > 0なので、ẏ = 0は−αy以下になりません。"
          : "VはK = 1.6θへ近づく場です。θ < V < KではVが増加し、V > Kでは減少してもTCZへは近づきません。";
    return [
      ...PROOF_STEPS.slice(0, 3),
      {
        ...PROOF_STEPS[3],
        title: "設定したαの減少条件が成立しない。",
        text: why,
        tex: String.raw`\dot y\leq-\alpha y\quad\text{is not guaranteed}`,
        engine: "減少条件は不成立",
        valid: false,
      },
      {
        ...PROOF_STEPS[4],
        title: "元の破線を、保証された上限として使えない。",
        text: "灰色の破線は、正常な場で使った指数関数を比較用に残したものです。条件を変更したいまは参考曲線であり、このαによる上限保証を撤回します。",
        tex: String.raw`y(0)e^{-\alpha t}\quad\text{reference only}`,
        engine: "指数上限の保証を撤回",
        valid: false,
      },
      {
        ...PROOF_STEPS[5],
        title:
          dynamics === "slow"
            ? "保証が崩れても、収束する例がある。"
            : "この場では、全初期状態からのTCZ収束を保証できない。",
        text:
          dynamics === "slow"
            ? "この場は y(t) = y(0)e⁻⁰·³⁵ᵅᵗ なので、外側からTCZへ収束します。ただし元のαの上限ではなく、弱い減少率で示す結論です。"
            : dynamics === "orbit"
              ? "外側で初期化するとVが一定のため、TCZへの距離は0に近づきません。減少条件が失われたことと、その具体的な結果を見比べられます。"
              : "原点以外の初期状態ではV → 1.6θ > θとなり、極限の軌道はTCZの外に留まります。これは単に証明が使えないだけでなく、収束しない具体例です。",
        tex:
          dynamics === "slow"
            ? String.raw`y(t)=y(0)e^{-0.35\alpha t}\quad(y(0)>0)`
            : dynamics === "orbit"
              ? String.raw`V(t)=V(0)`
              : String.raw`V(t)\longrightarrow1.6\theta\quad(V(0)>0)`,
        engine: "別の場の結論を確認",
      },
    ];
  }
  if (dynamics === "inward")
    return PROOF_STEPS.map((s, i) =>
      i === 3
        ? {
            ...s,
            text: "この場では V̇ = −βV です。TCZ外ではV ≥ y > 0、β ≥ αなので、ẏ ≤ −αyが成立します。内部に入った後は、非負の正部分 y₊を用いて比較します。",
            tex: String.raw`\dot V=-\beta V\leq-\alpha(V-\theta)\quad(V>\theta)`,
          }
        : i === 4
          ? {
              ...s,
              tex: String.raw`0\leq y_+(t)\leq y_+(0)e^{-\alpha t}`,
              text: "この場はTCZ内部にも進むため、y₊ = max(y,0)を比較します。符号付きのyが0以下になっても、正部分は0を保ちます。",
            }
          : i === 5
            ? {
                ...s,
                text: "V(t) = V(0)e⁻ᵝᵗから原点へ収束します。θ > 0なので、外側から始めても有限時間でTCZに入ります。これはこの場に固有の結論です。",
              }
            : s,
    );
  return PROOF_STEPS;
}

export function proofStatus(params: Parameters, study: Study): string {
  if (dynamicsOf(params) === "drift")
    return "TCZへの到達と領域内の漂遊を確認しました";
  if (study === "lasalle")
    return params.rotation !== 0
      ? "LaSalleの条件と原点への収束を確認しました"
      : "最大不変集合は線：TCZ収束は保証されません";
  if (study === "invariance")
    return guarantees(params).forwardInvariant
      ? "TCZの前方不変性を確認しました"
      : "前方不変性が失われることを確認しました";
  if (!guarantees(params).comparison)
    return "このαによる指数上限の保証は不成立です";
  return "モデルの収束条件を確認しました";
}
