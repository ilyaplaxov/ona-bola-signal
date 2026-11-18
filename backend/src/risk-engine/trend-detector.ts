import type { TrendFinding } from "@ona-bola/shared";
import { formatValue, MEASURE_INFO, valuesOf } from "./measures";
import type { Observation, TrendRule, ValidMeasurement } from "./types";

export interface TrendResult {
  finding: TrendFinding;
  triggered: boolean;
  /** The readings in the window, when the trend triggered. */
  evidence: Observation[];
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Reads the last `minReadings` values of the rule's measure (oldest first). The trend triggers when
 * every step moves in the rule's direction and, if `minChange` is set, the total change reaches it.
 * With fewer readings than needed it reports INSUFFICIENT_HISTORY and never triggers.
 */
export function evaluateTrend(rule: TrendRule, measurements: ValidMeasurement[]): TrendResult {
  const series: Observation[] = [];
  for (const m of measurements) {
    for (const [measure, value] of valuesOf(m.reading)) {
      if (measure === rule.measure) {
        series.push({
          measure,
          value,
          measuredAt: m.measuredAt.toISOString(),
          measurementId: m.id,
        });
      }
    }
  }

  const label = MEASURE_INFO[rule.measure].label;
  const window = series.slice(-rule.minReadings);
  if (window.length < rule.minReadings) {
    return {
      triggered: false,
      evidence: [],
      finding: {
        ruleId: rule.id,
        measure: rule.measure,
        status: "INSUFFICIENT_HISTORY",
        text: `${capitalize(label)}: ${series.length} of ${rule.minReadings} readings needed to judge a trend`,
      },
    };
  }

  const values = window.map((o) => Number(o.value));
  const rising = rule.direction === "RISING";
  let monotonic = true;
  for (let i = 1; i < values.length; i += 1) {
    const previous = values[i - 1] ?? 0;
    const current = values[i] ?? 0;
    if (rising ? current <= previous : current >= previous) monotonic = false;
  }
  const first = values[0] ?? 0;
  const last = values[values.length - 1] ?? 0;
  const change = rising ? last - first : first - last;
  const triggered = monotonic && (rule.minChange === undefined || change >= rule.minChange);

  const path = values.map((v) => formatValue(rule.measure, v).split(" ")[0]).join(" → ");
  const unit = MEASURE_INFO[rule.measure].unit ?? "";
  const n = window.length;
  const text = triggered
    ? `${capitalize(label)} ${rising ? "rose" : "fell"} across the last ${n} readings: ${path} ${unit}`
    : `No ${rising ? "rising" : "falling"} ${label} trend across the last ${n} readings: ${path} ${unit}`;

  return {
    triggered,
    evidence: triggered ? window : [],
    finding: {
      ruleId: rule.id,
      measure: rule.measure,
      status: triggered ? "TRIGGERED" : "NOT_TRIGGERED",
      text: text.trim(),
    },
  };
}
