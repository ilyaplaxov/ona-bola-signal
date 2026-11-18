import type {
  GestationalWeeks,
  ObservedValue,
  RiskFactorCode,
  RuleCitation,
} from "@ona-bola/shared";
import {
  MEASURE_LABELS,
  RISK_FACTOR_LABELS,
  RULE_LABELS,
  SOURCE_LABELS,
  STRINGS,
  UNIT_LABELS,
  type Lang,
} from "./strings";

// Month names are spelled out here: many browsers lack Uzbek locale data and print "2026 M11 17".
const MONTHS: Record<Lang, string[]> = {
  uz: [
    "yanvar",
    "fevral",
    "mart",
    "aprel",
    "may",
    "iyun",
    "iyul",
    "avgust",
    "sentabr",
    "oktabr",
    "noyabr",
    "dekabr",
  ],
  ru: [
    "января",
    "февраля",
    "марта",
    "апреля",
    "мая",
    "июня",
    "июля",
    "августа",
    "сентября",
    "октября",
    "ноября",
    "декабря",
  ],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};

function dateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return {
    year: get("year"),
    month: Number(get("month")),
    day: Number(get("day")),
    time: `${get("hour")}:${get("minute")}`,
  };
}

function dayMonthYear(p: ReturnType<typeof dateParts>, lang: Lang): string {
  const month = MONTHS[lang][p.month - 1] ?? "";
  return lang === "uz" ? `${p.day}-${month} ${p.year}` : `${p.day} ${month} ${p.year}`;
}

/** Date and time in Tashkent time, whatever the viewer's time zone: "17-noyabr 2026, 23:37". */
export function formatDateTime(iso: string, lang: Lang): string {
  const p = dateParts(new Date(iso), "Asia/Tashkent");
  return `${dayMonthYear(p, lang)}, ${p.time}`;
}

/** A calendar date stored as YYYY-MM-DD: "9-yanvar 2027". */
export function formatDate(isoDate: string, lang: Lang): string {
  return dayMonthYear(dateParts(new Date(`${isoDate}T00:00:00Z`), "UTC"), lang);
}

export const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

export function unitLabel(unit: string | null, lang: Lang): string {
  if (!unit) return "";
  return UNIT_LABELS[unit]?.[lang] ?? unit;
}

/** Rule wording in the current language; falls back to the API text for unknown rules. */
export function ruleLabel(ruleId: string | null, lang: Lang, fallback: string): string {
  return (ruleId && RULE_LABELS[ruleId]?.[lang]) || fallback;
}

/** "systolic pressure: 148 mmHg", "previous caesarean: yes". */
export function observedText(o: ObservedValue, lang: Lang): string {
  const label = MEASURE_LABELS[o.measure][lang];
  if (typeof o.value === "boolean") {
    return `${label}: ${o.value ? STRINGS[lang].common.yes : STRINGS[lang].common.no}`;
  }
  return `${label}: ${formatNumber(o.value)} ${unitLabel(o.unit, lang)}`.trim();
}

/** "28-bet", "34, 36-betlar" in Uzbek; "с. 28" in Russian; "p. 28", "pp. 34, 36" in English. */
function pagesText(pages: string[], lang: Lang): string {
  const list = pages.join(", ");
  const several = pages.length > 1 || list.includes("–");
  if (lang === "uz") return several ? `${list}-betlar` : `${list}-bet`;
  if (lang === "ru") return `с. ${list}`;
  return several ? `pp. ${list}` : `p. ${list}`;
}

/** Protocol pages behind a rule: "«Антенатальный уход» milliy protokoli, 34, 36-betlar". */
export function citationText(citations: RuleCitation[], lang: Lang): string {
  return citations
    .map((c) => `${SOURCE_LABELS[c.document].name[lang]}, ${pagesText(c.pages, lang)}`)
    .join("; ");
}

/** Official titles of the cited documents, one per line, for a hover hint. */
export function citationTitles(citations: RuleCitation[]): string {
  return [...new Set(citations.map((c) => SOURCE_LABELS[c.document].title))].join("\n");
}

/** Weeks of pregnancy a rule is limited to: "14–27 hafta", "28 haftadan", "muddat nomaʼlum". */
export function weeksText(range: GestationalWeeks, lang: Lang): string {
  const w = STRINGS[lang].weeks;
  if ("unknown" in range) return w.unknown;
  // Ranges end before `to`, so the last week shown is to − 1.
  if (range.from !== undefined && range.to !== undefined)
    return w.between(range.from, range.to - 1);
  if (range.to !== undefined) return w.before(range.to);
  return w.from(range.from ?? 0);
}

/** A risk-group factor in the current language; unlabelled codes become plain words. */
export function riskFactorLabel(code: RiskFactorCode, lang: Lang): string {
  return RISK_FACTOR_LABELS[code]?.[lang] ?? code.toLowerCase().replaceAll("_", " ");
}

/** The value sequence of a trend finding, e.g. "116 → 121 → 128 mmHg". */
export function trendPath(text: string, lang: Lang): string {
  const tail = text.slice(text.lastIndexOf(": ") + 2);
  return tail
    .replace("mmHg", unitLabel("mmHg", lang))
    .replace("mmol/L", unitLabel("mmol/L", lang))
    .replace("g/L", unitLabel("g/L", lang));
}
