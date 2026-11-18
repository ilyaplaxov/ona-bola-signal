export type Zone = "GREEN" | "YELLOW" | "RED";
export type Op = ">=" | ">" | "<" | "<=";
export type SourceStatus = "ILLUSTRATIVE" | "VALIDATED";

export type Measure =
  | "BLOOD_PRESSURE.systolic"
  | "BLOOD_PRESSURE.diastolic"
  | "HEMOGLOBIN.value"
  | "PROTEINURIA.value"
  | "GLUCOSE.FASTING"
  | "GLUCOSE.OGTT_1H"
  | "GLUCOSE.OGTT_2H"
  | "GLUCOSE.RANDOM"
  | "HBA1C.value";

export interface Reason {
  uz: string;
  en: string;
}

export interface Source {
  status: SourceStatus;
  ref: string | null;
}

export interface WeeksRange {
  from?: number;
  to?: number;
}

export interface Condition {
  measure: Measure;
  op: Op;
  value: number;
}

interface RuleBase {
  id: string;
  zone: Zone;
  reason: Reason;
  source: Source;
  gestationalWeeks?: WeeksRange;
}

export interface ThresholdRule extends RuleBase, Condition {
  kind: "threshold";
}

export interface AllOfRule extends RuleBase {
  kind: "all";
  conditions: Condition[];
}

export interface TrendRule extends RuleBase {
  kind: "trend";
  measure: Measure;
  minReadings: number;
  minChange: number;
  windowDays: number;
}

export interface ResponseRule extends RuleBase {
  kind: "response";
  measure: Measure;
  startsWhenAnyRuleFired: string[];
  afterDays: number;
  expectedRise: number;
}

export interface MissingRule {
  id: string;
  kind: "missing";
  measure: Measure;
  staleAfterDays: number;
  gestationalWeeks?: WeeksRange;
  reason: Reason;
  source: Source;
}

export type Rule = ThresholdRule | AllOfRule | TrendRule | ResponseRule | MissingRule;

export interface RuleSet {
  id: string;
  version: string;
  kind: SourceStatus;
  rules: Rule[];
}

const ANC = "НКП «Антенатальный уход. Ведение беременных групп риска», приказ МЗ РУз №180 от 23.06.2025";
const IDA = "НКП «Ведение беременных с железодефицитной анемией», приказ МЗ РУз №180 от 23.06.2025";
const src = (ref: string | null): Source => ({ status: "ILLUSTRATIVE", ref });

export const DEMO_RULES: RuleSet = {
  id: "demo",
  version: "demo-0.2",
  kind: "ILLUSTRATIVE",
  rules: [
    {
      id: "BP-SEV-SYS",
      kind: "threshold",
      measure: "BLOOD_PRESSURE.systolic",
      op: ">=",
      value: 160,
      zone: "RED",
      reason: {
        uz: "Sistolik bosim ≥160 mm sim. ust. — og'ir gipertenziya, shoshilinch gospitalizatsiya",
        en: "Systolic ≥160 mmHg: severe hypertension, urgent hospitalisation",
      },
      source: src(`${ANC}, с.34 (степень), с.36 (срочная госпитализация)`),
    },
    {
      id: "BP-SEV-DIA",
      kind: "threshold",
      measure: "BLOOD_PRESSURE.diastolic",
      op: ">=",
      value: 110,
      zone: "RED",
      reason: {
        uz: "Diastolik bosim ≥110 mm sim. ust. — og'ir gipertenziya, shoshilinch gospitalizatsiya",
        en: "Diastolic ≥110 mmHg: severe hypertension, urgent hospitalisation",
      },
      source: src(`${ANC}, с.34, с.36`),
    },
    {
      id: "PE-BP-PROT",
      kind: "all",
      conditions: [
        { measure: "BLOOD_PRESSURE.systolic", op: ">=", value: 140 },
        { measure: "PROTEINURIA.value", op: ">=", value: 0.3 },
      ],
      zone: "RED",
      reason: {
        uz: "Gipertenziya va proteinuriya — preeklampsiya ehtimoli, gospitalizatsiya",
        en: "Hypertension with proteinuria: possible pre-eclampsia, hospitalisation",
      },
      source: src(`${ANC}, с.34, с.36, с.42 п.10; порог белка 0,3 г/л — см. RULES_PROVENANCE (опечатка в PDF)`),
    },
    {
      id: "PE-BPD-PROT",
      kind: "all",
      conditions: [
        { measure: "BLOOD_PRESSURE.diastolic", op: ">=", value: 90 },
        { measure: "PROTEINURIA.value", op: ">=", value: 0.3 },
      ],
      zone: "RED",
      reason: {
        uz: "Gipertenziya va proteinuriya — preeklampsiya ehtimoli, gospitalizatsiya",
        en: "Hypertension with proteinuria: possible pre-eclampsia, hospitalisation",
      },
      source: src(`${ANC}, с.34, с.36, с.42 п.10`),
    },
    {
      id: "BP-HTN-SYS",
      kind: "threshold",
      measure: "BLOOD_PRESSURE.systolic",
      op: ">=",
      value: 140,
      zone: "YELLOW",
      reason: {
        uz: "Sistolik bosim ≥140 mm sim. ust. — gipertenziya belgisi, 4 soatdan keyin qayta o'lchang",
        en: "Systolic ≥140 mmHg: hypertension range, repeat in 4 hours to confirm",
      },
      source: src(`${ANC}, с.34`),
    },
    {
      id: "BP-HTN-DIA",
      kind: "threshold",
      measure: "BLOOD_PRESSURE.diastolic",
      op: ">=",
      value: 90,
      zone: "YELLOW",
      reason: {
        uz: "Diastolik bosim ≥90 mm sim. ust. — gipertenziya belgisi, 4 soatdan keyin qayta o'lchang",
        en: "Diastolic ≥90 mmHg: hypertension range, repeat in 4 hours to confirm",
      },
      source: src(`${ANC}, с.34`),
    },
    {
      id: "PROT-01",
      kind: "threshold",
      measure: "PROTEINURIA.value",
      op: ">=",
      value: 0.3,
      zone: "YELLOW",
      reason: {
        uz: "Siydikda oqsil ≥0,3 g/l — proteinuriya",
        en: "Urine protein ≥0.3 g/L: proteinuria",
      },
      source: src(`${ANC}, с.34, с.36`),
    },
    {
      id: "HB-VSEV",
      kind: "threshold",
      measure: "HEMOGLOBIN.value",
      op: "<",
      value: 50,
      zone: "RED",
      reason: {
        uz: "Gemoglobin <50 g/l — juda og'ir anemiya, shoshilinch gospitalizatsiya",
        en: "Haemoglobin <50 g/L: very severe anaemia, emergency hospitalisation",
      },
      source: src(`${IDA}, с.13, с.16`),
    },
    {
      id: "HB-SEV",
      kind: "threshold",
      measure: "HEMOGLOBIN.value",
      op: "<",
      value: 70,
      zone: "RED",
      reason: {
        uz: "Gemoglobin <70 g/l — og'ir anemiya, ixtisoslashgan yordam kerak",
        en: "Haemoglobin <70 g/L: severe anaemia, refer to specialised care",
      },
      source: src(`${IDA}, с.13, с.17`),
    },
    {
      id: "HB-MOD-LATE",
      kind: "threshold",
      measure: "HEMOGLOBIN.value",
      op: "<",
      value: 90,
      gestationalWeeks: { from: 34 },
      zone: "RED",
      reason: {
        uz: "34 haftadan keyin gemoglobin <90 g/l — tug'ruqdan oldin parenteral temir kerak",
        en: "Haemoglobin <90 g/L after 34 weeks: needs parenteral iron before delivery",
      },
      source: src(`${IDA}, с.17, с.19 (выбор зоны — решение команды)`),
    },
    {
      id: "HB-MOD",
      kind: "threshold",
      measure: "HEMOGLOBIN.value",
      op: "<",
      value: 90,
      zone: "YELLOW",
      reason: {
        uz: "Gemoglobin <90 g/l — o'rta og'irlikdagi anemiya",
        en: "Haemoglobin <90 g/L: moderate anaemia",
      },
      source: src(`${IDA}, с.13, с.19; ${ANC}, с.39`),
    },
    {
      id: "HB-MILD-T1",
      kind: "threshold",
      measure: "HEMOGLOBIN.value",
      op: "<",
      value: 110,
      gestationalWeeks: { to: 14 },
      zone: "YELLOW",
      reason: {
        uz: "Gemoglobin <110 g/l (I trimestr) — anemiya",
        en: "Haemoglobin <110 g/L (1st trimester): anaemia",
      },
      source: src(`${ANC}, с.28; ${IDA}, с.13`),
    },
    {
      id: "HB-MILD-T2",
      kind: "threshold",
      measure: "HEMOGLOBIN.value",
      op: "<",
      value: 105,
      gestationalWeeks: { from: 14, to: 28 },
      zone: "YELLOW",
      reason: {
        uz: "Gemoglobin <105 g/l (II trimestr) — anemiya",
        en: "Haemoglobin <105 g/L (2nd trimester): anaemia",
      },
      source: src(`${ANC}, с.28; ${IDA}, с.13`),
    },
    {
      id: "HB-MILD-T3",
      kind: "threshold",
      measure: "HEMOGLOBIN.value",
      op: "<",
      value: 110,
      gestationalWeeks: { from: 28 },
      zone: "YELLOW",
      reason: {
        uz: "Gemoglobin <110 g/l (III trimestr) — anemiya",
        en: "Haemoglobin <110 g/L (3rd trimester): anaemia",
      },
      source: src(`${ANC}, с.28; ${IDA}, с.13 (на с.20 АУ для III трим. указано 105 — вопрос ментору)`),
    },
    {
      id: "GLU-F-DM",
      kind: "threshold",
      measure: "GLUCOSE.FASTING",
      op: ">=",
      value: 7.0,
      zone: "RED",
      reason: {
        uz: "Och qoringa glyukoza ≥7,0 mmol/l — manifest qandli diabet mezoni",
        en: "Fasting glucose ≥7.0 mmol/L: overt diabetes criterion",
      },
      source: src(`${ANC}, с.31, с.53`),
    },
    {
      id: "GLU-F-GDM",
      kind: "threshold",
      measure: "GLUCOSE.FASTING",
      op: ">=",
      value: 5.1,
      zone: "YELLOW",
      reason: {
        uz: "Och qoringa glyukoza ≥5,1 mmol/l — gestatsion qandli diabet mezoni",
        en: "Fasting glucose ≥5.1 mmol/L: gestational diabetes criterion",
      },
      source: src(`${ANC}, с.31, с.53 (на с.20 порог направления — ≥5,6)`),
    },
    {
      id: "GLU-1H-GDM",
      kind: "threshold",
      measure: "GLUCOSE.OGTT_1H",
      op: ">=",
      value: 10.0,
      zone: "YELLOW",
      reason: {
        uz: "GTT 1 soat ≥10,0 mmol/l — gestatsion qandli diabet mezoni",
        en: "OGTT 1 h ≥10.0 mmol/L: gestational diabetes criterion",
      },
      source: src(`${ANC}, с.31`),
    },
    {
      id: "GLU-2H-DM",
      kind: "threshold",
      measure: "GLUCOSE.OGTT_2H",
      op: ">=",
      value: 11.1,
      zone: "RED",
      reason: {
        uz: "GTT 2 soat ≥11,1 mmol/l — manifest qandli diabet mezoni",
        en: "OGTT 2 h ≥11.1 mmol/L: overt diabetes criterion",
      },
      source: src(`${ANC}, с.31 (на с.53 — ≥11,0)`),
    },
    {
      id: "GLU-2H-GDM",
      kind: "threshold",
      measure: "GLUCOSE.OGTT_2H",
      op: ">=",
      value: 8.5,
      zone: "YELLOW",
      reason: {
        uz: "GTT 2 soat ≥8,5 mmol/l — gestatsion qandli diabet mezoni",
        en: "OGTT 2 h ≥8.5 mmol/L: gestational diabetes criterion",
      },
      source: src(`${ANC}, с.31, с.53`),
    },
    {
      id: "GLU-RND-DM",
      kind: "threshold",
      measure: "GLUCOSE.RANDOM",
      op: ">=",
      value: 11.1,
      zone: "RED",
      reason: {
        uz: "Tasodifiy glyukoza ≥11,1 mmol/l — manifest qandli diabet mezoni",
        en: "Random plasma glucose ≥11.1 mmol/L: overt diabetes criterion",
      },
      source: src(`${ANC}, с.31`),
    },
    {
      id: "HBA1C-DM",
      kind: "threshold",
      measure: "HBA1C.value",
      op: ">=",
      value: 6.5,
      zone: "RED",
      reason: {
        uz: "HbA1c ≥6,5% — qandli diabet mezoni",
        en: "HbA1c ≥6.5%: diabetes criterion",
      },
      source: src(`${ANC}, с.20, с.53`),
    },
    {
      id: "TR-HB-NORESPONSE",
      kind: "response",
      measure: "HEMOGLOBIN.value",
      startsWhenAnyRuleFired: ["HB-MILD-T1", "HB-MILD-T2", "HB-MILD-T3", "HB-MOD", "HB-MOD-LATE", "HB-SEV", "HB-VSEV"],
      afterDays: 14,
      expectedRise: 10,
      zone: "YELLOW",
      reason: {
        uz: "Anemiya aniqlanganidan 14 kun o'tib gemoglobin 10 g/l ga oshmadi — parenteral temir masalasi",
        en: "Haemoglobin rose <10 g/L within 14 days of anaemia: consider parenteral iron",
      },
      source: src(`${IDA}, с.18–19 (отсчёт от начала терапии; без даты терапии — от первого анемичного значения, решение команды)`),
    },
    {
      id: "TR-HB-DROP",
      kind: "trend",
      measure: "HEMOGLOBIN.value",
      minReadings: 2,
      minChange: -10,
      windowDays: 60,
      zone: "YELLOW",
      reason: {
        uz: "Gemoglobin oldingi o'lchovga nisbatan ≥10 g/l ga tushdi",
        en: "Haemoglobin fell by ≥10 g/L since the previous reading",
      },
      source: src(null),
    },
    {
      id: "TR-BP-RISE",
      kind: "trend",
      measure: "BLOOD_PRESSURE.systolic",
      minReadings: 3,
      minChange: 15,
      windowDays: 90,
      zone: "YELLOW",
      reason: {
        uz: "Sistolik bosim boshlang'ich darajadan ≥15 mm sim. ust. ga oshdi",
        en: "Systolic pressure rose ≥15 mmHg above the patient's baseline",
      },
      source: src(null),
    },
    {
      id: "MISS-BP-EARLY",
      kind: "missing",
      measure: "BLOOD_PRESSURE.systolic",
      staleAfterDays: 105,
      gestationalWeeks: { to: 28 },
      reason: { uz: "Qon bosimi o'lchovi eskirgan", en: "Blood pressure reading is out of date" },
      source: src(`${ANC}, с.14 (визиты до 12 и 18–20 нед: разрыв до 98 дней + 7 дней запаса), с.17`),
    },
    {
      id: "MISS-BP-LATE",
      kind: "missing",
      measure: "BLOOD_PRESSURE.systolic",
      staleAfterDays: 35,
      gestationalWeeks: { from: 28 },
      reason: { uz: "Qon bosimi o'lchovi eskirgan", en: "Blood pressure reading is out of date" },
      source: src(`${ANC}, с.14 (визиты 26, 30, 34 нед: разрыв 28 дней + 7 дней запаса), с.17`),
    },
    {
      id: "MISS-HB-26W",
      kind: "missing",
      measure: "HEMOGLOBIN.value",
      staleAfterDays: 112,
      gestationalWeeks: { from: 28 },
      reason: { uz: "26-haftadagi umumiy qon tahlili yo'q", en: "No blood count since the 26-week check" },
      source: src(`${ANC}, с.20 (ОАК при 1-м визите и в 26 нед: от 26 до 41 нед ≤105 дней)`),
    },
    {
      id: "MISS-OGTT",
      kind: "missing",
      measure: "GLUCOSE.OGTT_2H",
      staleAfterDays: 120,
      gestationalWeeks: { from: 29 },
      reason: { uz: "26–28-haftadagi GTT natijasi yo'q", en: "No 26-28 week OGTT result" },
      source: src(`${ANC}, с.20–21 (ПГТТ всем в 26–28 нед)`),
    },
  ],
};
