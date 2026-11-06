export type CollectiveSeries =
  "individual" | "social" | "abstraction" | "total";
export type CollectiveFocus =
  CollectiveSeries | `pair${number}` | `abstract${number}`;

/** Shared subject colors for collective charts and readouts. */
export const COLLECTIVE_COLORS = ["#65e6d0", "#8da7ff", "#ffcc80"];

/** Avoid showing negative zero in four-decimal cost readouts. */
export const formatCollectiveValue = (value: number) =>
  (Math.abs(value) < 0.00005 ? 0 : value).toFixed(4);
