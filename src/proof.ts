import type { MathId } from "./interaction";

export type ProofStep = {
  short: string;
  title: string;
  text: string;
  tex: string;
  focus: MathId;
  engine: string;
  valid?: boolean;
};
// Declarative proof steps keep the teaching sequence separate from rendering.
export const PROOF_STEPS: ProofStep[] = [
  {
    short: "状態空間",
    title: "状態を、ひとつの点として見る。",
    text: "左の点は状態 x(t) です。動いた跡が軌道になります。まずは再生して、点がどこへ近づくか観察してみましょう。",
    tex: String.raw`x(t)=(x_1(t),x_2(t))`,
    focus: "x",
    engine: "状態を定義",
  },
  {
    short: "ポテンシャル",
    title: "地形の高さで、状態を評価する。",
    text: "Vの小さい状態を、平面の中央にある窪みで表します。3Dでは周辺の高さを圧縮しており、実際のVは数値と時間グラフで確認できます。V = x₁² + b x₂² が閾値θ以下になる領域がTCZです。",
    tex: String.raw`\Omega_\theta=\{x\mid V(x)\leq\theta\}`,
    focus: "V",
    engine: "評価量を定義",
  },
  {
    short: "残り量",
    title: "境界の高さとの差を取り出す。",
    text: "y(t)は現在のVと閾値θの差です。外側では正、境界で0、内側では負になります。右のグラフで、その変化を追えます。",
    tex: String.raw`y(t)=V(x(t))-\theta`,
    focus: "y",
    engine: "残り量を定義",
  },
  {
    short: "減少条件",
    title: "傾きに、減り方の条件を置く。",
    text: "TCZの外側では、接線の傾きが −αy 以下になります。このモデルでは ẏ = −α(1+δ)y と設計して、この条件を満たしています。",
    tex: String.raw`\dot y(t)\leq-\alpha y(t)\quad(y>0)`,
    focus: "derivative",
    engine: "減少条件を確認",
  },
  {
    short: "比較",
    title: "実際の曲線を、指数関数で押さえる。",
    text: "初期状態が外側なら、実際のy(t)は破線の上限以下になります。破線は軌道そのものではありません。δを0にすると両者が一致します。",
    tex: String.raw`0\leq y(t)\leq y(0)e^{-\alpha t}\quad(y(0)>0)`,
    focus: "comparison",
    engine: "指数上限と比較",
  },
  {
    short: "収束",
    title: "領域までの距離が、0へ近づく。",
    text: "外側では指数上限が0へ近づきます。この二次関数モデルでは距離も0へ近づくと示せます。有限時間で中に入ることや、ひとつの点に止まることまでは意味しません。",
    tex: String.raw`\operatorname{dist}(x(t),\Omega_\theta)\longrightarrow0`,
    focus: "omega",
    engine: "集合への収束を確認",
  },
];
