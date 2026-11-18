import {
  CANONICAL_UNITS,
  IsoDate,
  IsoDateTime,
  MeasurementReading,
  type AnalyzeNoteResponse,
  type Language,
  type MeasurementType,
  type NoteExtractionOutput,
} from "@ona-bola/shared";

// Turns what Claude read from a note into a draft for the measurement form. Claude only copies
// numbers and units as written; every unit conversion and every check happens here, in code.
// Nothing is saved: the clinician reviews the draft and submits the form (source AI_ASSISTED).

/** Offset used when the note gives a local time without one (the registry runs in Tashkent). */
export const LOCAL_OFFSET = "+05:00";

/**
 * Accepted ways of writing each unit, after `unitKey` (lower case, no spaces or dots), with the
 * factor that converts the value to the canonical unit. Anything else is left out of the draft.
 * Factors are unit arithmetic, not clinical values. Glucose: 1 mmol/L = 18.016 mg/dL (molar mass).
 */
const UNIT_FACTORS: Record<Exclude<MeasurementType, "BLOOD_PRESSURE">, Record<string, number>> = {
  HEMOGLOBIN: { "g/l": 1, "г/л": 1, "g/dl": 10, "г/дл": 10 },
  PROTEINURIA: { "g/l": 1, "г/л": 1, "mg/dl": 0.01, "мг/дл": 0.01, "mg/l": 0.001, "мг/л": 0.001 },
  GLUCOSE: { "mmol/l": 1, "ммоль/л": 1, "mg/dl": 1 / 18.016, "мг/дл": 1 / 18.016 },
};

/** Ways of writing mmHg: Latin, Russian (мм рт. ст.) and Uzbek (mm sim. ust.). */
const BLOOD_PRESSURE_UNITS = new Set(["mmhg", "ммртст", "mmrtst", "mmsimust", "ммсимуст"]);

/** Decimal places kept after a conversion, so 11.2 g/dL becomes 112 g/L, not 111.99999999999999. */
const DECIMALS: Record<Exclude<MeasurementType, "BLOOD_PRESSURE">, number> = {
  HEMOGLOBIN: 1,
  PROTEINURIA: 3,
  GLUCOSE: 1,
};

const LABELS: Record<MeasurementType, Record<Language, string>> = {
  BLOOD_PRESSURE: { uz: "Qon bosimi", ru: "Давление", en: "Blood pressure" },
  HEMOGLOBIN: { uz: "Gemoglobin", ru: "Гемоглобин", en: "Haemoglobin" },
  PROTEINURIA: { uz: "Siydikdagi oqsil", ru: "Белок в моче", en: "Urine protein" },
  GLUCOSE: { uz: "Glyukoza", ru: "Глюкоза", en: "Glucose" },
};

const MESSAGES = {
  noUnit: {
    uz: (what: string) =>
      `${what}: izohda oʻlchov birligi yozilmagan, shuning uchun qoʻshilmadi. Birlikni tekshirib, qoʻlda kiriting.`,
    ru: (what: string) =>
      `${what}: в заметке не указана единица, значение не подставлено. Проверьте единицу и введите вручную.`,
    en: (what: string) =>
      `${what}: the note gives no unit, so it was left out. Check the unit and enter it by hand.`,
  },
  unknownUnit: {
    uz: (what: string) =>
      `${what}: bu oʻlchov birligi qoʻllab-quvvatlanmaydi, shuning uchun qoʻshilmadi. Qoʻlda kiriting.`,
    ru: (what: string) =>
      `${what}: эта единица не поддерживается, значение не подставлено. Введите вручную.`,
    en: (what: string) =>
      `${what}: this unit is not supported, so it was left out. Enter it by hand.`,
  },
  converted: {
    uz: (what: string, to: string) => `${what} ${to} ga oʻtkazildi. Saqlashdan oldin tekshiring.`,
    ru: (what: string, to: string) => `${what} пересчитано в ${to}. Проверьте перед сохранением.`,
    en: (what: string, to: string) => `${what} was converted to ${to}. Check it before saving.`,
  },
  invalid: {
    uz: (what: string) => `${what}: qiymat forma tekshiruvidan oʻtmadi, shuning uchun qoʻshilmadi.`,
    ru: (what: string) => `${what}: значение не прошло проверку формы и не подставлено.`,
    en: (what: string) => `${what}: the value failed the form checks, so it was left out.`,
  },
  dateOnly: {
    uz: () => "Izohda sana bor, lekin vaqt yoʻq. Oʻlchov vaqtini formada belgilang.",
    ru: () => "В заметке есть дата, но нет времени. Укажите время измерения в форме.",
    en: () => "The note gives a date but no time. Set the measurement time in the form.",
  },
  badTime: {
    uz: () => "Izohdagi oʻlchov vaqtini ishlatib boʻlmadi. Formadagi vaqtni tekshiring.",
    ru: () => "Время измерения из заметки использовать нельзя. Проверьте время в форме.",
    en: () => "The measurement time in the note could not be used. Check the time in the form.",
  },
} as const;

export interface NoteDraft {
  draft: AnalyzeNoteResponse["draft"];
  warnings: string[];
}

/** Lower case without spaces, dots or underscores: "мм рт. ст." → "ммртст", "g/dL" → "g/dl". */
export function unitKey(unit: string): string {
  return unit.toLowerCase().replace(/[\s._]/g, "");
}

function round(value: number, decimals: number): number {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}

function written(value: number, unit: string | null): string {
  return unit === null ? String(value) : `${value} ${unit}`;
}

/**
 * Builds the form draft. Values without a unit are left out (except blood pressure, which is
 * always written in mmHg), because a guess such as g/L for "11.2" would turn a normal haemoglobin
 * into a severe one. Every reading is checked with the shared MeasurementReading schema.
 */
export function toNoteDraft(
  extraction: NoteExtractionOutput,
  options: { language: Language; now: Date },
): NoteDraft {
  const { language, now } = options;
  const warnings: string[] = [];
  const measurements: MeasurementReading[] = [];

  const accept = (type: MeasurementType, candidate: unknown) => {
    const parsed = MeasurementReading.safeParse(candidate);
    if (parsed.success) measurements.push(parsed.data);
    else warnings.push(MESSAGES.invalid[language](LABELS[type][language]));
  };

  const bp = extraction.bloodPressure;
  if (bp) {
    const what = `${LABELS.BLOOD_PRESSURE[language]} ${bp.systolic}/${bp.diastolic}`;
    if (bp.unitAsWritten !== null && !BLOOD_PRESSURE_UNITS.has(unitKey(bp.unitAsWritten))) {
      warnings.push(MESSAGES.unknownUnit[language](`${what} ${bp.unitAsWritten}`));
    } else {
      accept("BLOOD_PRESSURE", {
        type: "BLOOD_PRESSURE",
        systolic: bp.systolic,
        diastolic: bp.diastolic,
        unit: CANONICAL_UNITS.BLOOD_PRESSURE,
      });
    }
  }

  const singles = [
    ["HEMOGLOBIN", extraction.hemoglobin],
    ["PROTEINURIA", extraction.proteinuria],
    ["GLUCOSE", extraction.glucose],
  ] as const;
  for (const [type, extracted] of singles) {
    if (!extracted) continue;
    const what = `${LABELS[type][language]} ${written(extracted.value, extracted.unitAsWritten)}`;
    if (extracted.unitAsWritten === null) {
      warnings.push(MESSAGES.noUnit[language](what));
      continue;
    }
    const factor = UNIT_FACTORS[type][unitKey(extracted.unitAsWritten)];
    if (factor === undefined) {
      warnings.push(MESSAGES.unknownUnit[language](what));
      continue;
    }
    const unit = CANONICAL_UNITS[type];
    const value = factor === 1 ? extracted.value : round(extracted.value * factor, DECIMALS[type]);
    if (factor !== 1) warnings.push(MESSAGES.converted[language](what, `${value} ${unit}`));
    accept(type, { type, value, unit });
  }

  const time = draftTime(extraction.measuredAt, now);
  if (time.problem) warnings.push(MESSAGES[time.problem][language]());

  return {
    draft: { measuredAt: time.measuredAt, measurements },
    warnings: [...warnings, ...extraction.missingOrUnclear.filter((w) => w.trim() !== "")],
  };
}

const LOCAL_DATE_TIME = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(:\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/;

/**
 * Measurement time from the note, with seconds and an offset added when they are missing.
 * A date without a time, a malformed value or a time in the future gives null and a problem.
 */
export function draftTime(
  raw: string | null,
  now: Date,
): { measuredAt: string | null; problem?: "dateOnly" | "badTime" } {
  if (raw === null || raw.trim() === "") return { measuredAt: null };
  const text = raw.trim();
  if (IsoDate.safeParse(text).success) return { measuredAt: null, problem: "dateOnly" };

  const match = LOCAL_DATE_TIME.exec(text);
  const candidate = match ? `${match[1]}${match[2] ?? ":00"}${match[3] ?? LOCAL_OFFSET}` : text;
  const valid = IsoDateTime.safeParse(candidate).success;
  const time = new Date(candidate).getTime();
  if (!valid || Number.isNaN(time) || time > now.getTime()) {
    return { measuredAt: null, problem: "badTime" };
  }
  return { measuredAt: candidate };
}
