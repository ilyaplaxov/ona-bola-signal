export const SOURCE_ANC = "НКП «Антенатальный уход. Ведение беременных групп риска», МЗ РУз, приказ №180 от 23.06.2025";

export type RiskFlag =
  | "PREVIOUS_HYPERTENSION_IN_PREGNANCY"
  | "CHRONIC_HYPERTENSION"
  | "CHRONIC_KIDNEY_DISEASE"
  | "DIABETES"
  | "DIABETES_WITH_VASCULAR_DISEASE"
  | "AUTOIMMUNE_DISEASE"
  | "FAMILY_HISTORY_PREECLAMPSIA"
  | "PREGNANCY_INTERVAL_OVER_10_YEARS"
  | "MULTIPLE_PREGNANCY"
  | "PREVIOUS_GDM"
  | "FAMILY_HISTORY_DIABETES"
  | "MACROSOMIA_4500G"
  | "POLYHYDRAMNIOS"
  | "PREVIOUS_STILLBIRTH"
  | "PREVIOUS_CHILD_WITH_MALFORMATION"
  | "UNEXPLAINED_NEONATAL_DEATH"
  | "PREVIOUS_RECURRENT_VTE"
  | "PREVIOUS_UNPROVOKED_OR_ESTROGEN_VTE"
  | "PREVIOUS_PROVOKED_VTE"
  | "FAMILY_HISTORY_THROMBOSIS"
  | "HIGH_RISK_THROMBOPHILIA"
  | "SMOKING"
  | "VARICOSE_VEINS"
  | "MEDICAL_COMORBIDITY"
  | "PREECLAMPSIA_MODERATE"
  | "PREECLAMPSIA_EARLY_OR_SEVERE"
  | "INTRAUTERINE_FETAL_DEATH"
  | "SURGERY_IN_PREGNANCY"
  | "DEHYDRATION"
  | "IMMOBILITY_OVER_4_DAYS"
  | "PREVIOUS_PPH"
  | "LARGE_FETUS"
  | "PLACENTA_PREVIA_OR_ACCRETA"
  | "PREVIOUS_ABRUPTION"
  | "ADVERSE_OBSTETRIC_HISTORY"
  | "UTERINE_SCAR"
  | "ANTICOAGULANT_THERAPY"
  | "COAGULOPATHY"
  | "SEVERE_CARDIOVASCULAR_OR_HEMATOLOGIC_DISEASE"
  | "SMOKING_11_PLUS_PER_DAY"
  | "PREVIOUS_SGA"
  | "DAILY_VIGOROUS_EXERCISE"
  | "PARENT_BORN_SGA"
  | "RENAL_IMPAIRMENT"
  | "ANTIPHOSPHOLIPID_SYNDROME"
  | "HEAVY_BLEEDING_IN_PREGNANCY"
  | "LOW_FRUIT_INTAKE"
  | "PREVIOUS_PREECLAMPSIA"
  | "PREGNANCY_INTERVAL_UNDER_6_OR_OVER_60_MONTHS";

export interface RiskProfile {
  ageYears: number;
  bmi?: number;
  parity: number;
  latestHbGL?: number;
  flags: ReadonlySet<RiskFlag>;
}

export interface RiskResult {
  scale: "PREECLAMPSIA" | "GDM" | "VTE" | "PPH" | "FGR";
  level: "LOW" | "MODERATE" | "HIGH";
  score?: number;
  matched: string[];
  actions: string[];
  source: string;
}

const has = (p: RiskProfile, f: RiskFlag) => p.flags.has(f);

export function preeclampsiaRisk(p: RiskProfile): RiskResult {
  const high = (
    [
      "PREVIOUS_HYPERTENSION_IN_PREGNANCY",
      "CHRONIC_HYPERTENSION",
      "CHRONIC_KIDNEY_DISEASE",
      "DIABETES",
      "AUTOIMMUNE_DISEASE",
    ] as const
  ).filter((f) => has(p, f));
  const moderate: string[] = [];
  if (p.parity === 0) moderate.push("NULLIPARITY");
  if (p.ageYears >= 40) moderate.push("AGE_40_PLUS");
  if (p.bmi !== undefined && p.bmi >= 35) moderate.push("BMI_35_PLUS");
  for (const f of ["FAMILY_HISTORY_PREECLAMPSIA", "PREGNANCY_INTERVAL_OVER_10_YEARS", "MULTIPLE_PREGNANCY"] as const) {
    if (has(p, f)) moderate.push(f);
  }
  const isHigh = high.length >= 1 || moderate.length >= 2;
  return {
    scale: "PREECLAMPSIA",
    level: isHigh ? "HIGH" : "LOW",
    matched: [...high, ...moderate],
    actions: isHigh
      ? [
          "Аспирин 150 мг/сут вечером с 11–14+6 до 36 нед (с.34; на с.54 — до 38 нед)",
          "Ежедневный самоконтроль АД",
          "Протеинурия при каждом визите (не первая утренняя порция)",
        ]
      : [],
    source: `${SOURCE_ANC}, с.33–34, алгоритм с.54`,
  };
}

export function gdmRisk(p: RiskProfile): RiskResult {
  const matched: string[] = [];
  if (p.bmi !== undefined && p.bmi > 30) matched.push("BMI_OVER_30");
  if (p.ageYears >= 40) matched.push("AGE_40_PLUS");
  for (const f of [
    "PREVIOUS_GDM",
    "FAMILY_HISTORY_DIABETES",
    "MACROSOMIA_4500G",
    "POLYHYDRAMNIOS",
    "PREVIOUS_STILLBIRTH",
    "PREVIOUS_CHILD_WITH_MALFORMATION",
    "UNEXPLAINED_NEONATAL_DEATH",
  ] as const) {
    if (has(p, f)) matched.push(f);
  }
  const atRisk = matched.length > 0;
  return {
    scale: "GDM",
    level: atRisk ? "HIGH" : "LOW",
    matched,
    actions: atRisk
      ? ["ПГТТ 75 г при 1-м визите и повторно в 26–28 нед"]
      : ["Глюкоза венозной плазмы натощак при 1-м визите, ПГТТ 75 г в 26–28 нед"],
    source: `${SOURCE_ANC}, с.20–21, с.30, алгоритм с.53`,
  };
}

const VTE_POINTS: ReadonlyArray<readonly [RiskFlag, number]> = [
  ["PREVIOUS_RECURRENT_VTE", 3],
  ["PREVIOUS_UNPROVOKED_OR_ESTROGEN_VTE", 3],
  ["PREVIOUS_PROVOKED_VTE", 2],
  ["FAMILY_HISTORY_THROMBOSIS", 1],
  ["HIGH_RISK_THROMBOPHILIA", 3],
  ["SMOKING", 1],
  ["VARICOSE_VEINS", 1],
  ["MEDICAL_COMORBIDITY", 2],
  ["MULTIPLE_PREGNANCY", 1],
  ["INTRAUTERINE_FETAL_DEATH", 2],
  ["SURGERY_IN_PREGNANCY", 2],
  ["DEHYDRATION", 1],
  ["IMMOBILITY_OVER_4_DAYS", 1],
];

export function vteRisk(p: RiskProfile): RiskResult {
  const matched: string[] = [];
  let score = 0;
  const add = (id: string, pts: number) => {
    matched.push(`${id}+${pts}`);
    score += pts;
  };
  for (const [flag, pts] of VTE_POINTS) if (has(p, flag)) add(flag, pts);
  if (p.ageYears > 35) add("AGE_OVER_35", 1);
  if (p.bmi !== undefined && p.bmi > 30) add("BMI_OVER_30", 1);
  if (p.parity >= 3) add("PARITY_3_PLUS", 1);
  if (has(p, "PREECLAMPSIA_EARLY_OR_SEVERE")) add("PREECLAMPSIA_EARLY_OR_SEVERE", 2);
  else if (has(p, "PREECLAMPSIA_MODERATE")) add("PREECLAMPSIA_MODERATE", 1);
  const level = score >= 3 ? "HIGH" : score >= 1 ? "MODERATE" : "LOW";
  const actions =
    level === "HIGH"
      ? ["Компрессионный трикотаж", "Направить к гематологу: НМГ по весу", "Переоценивать при каждом визите"]
      : level === "MODERATE"
        ? ["Компрессионный трикотаж всю беременность", "Переоценивать при каждом визите"]
        : ["Переоценивать при каждом визите"];
  return { scale: "VTE", level, score, matched, actions, source: `${SOURCE_ANC}, с.37–38` };
}

export function pphRisk(p: RiskProfile): RiskResult {
  const matched: string[] = [];
  if (p.parity >= 4) matched.push("PARITY_4_PLUS");
  if (p.latestHbGL !== undefined && p.latestHbGL < 90) matched.push("ANEMIA_HB_BELOW_90");
  for (const f of [
    "MULTIPLE_PREGNANCY",
    "PREVIOUS_PPH",
    "PREECLAMPSIA_MODERATE",
    "PREECLAMPSIA_EARLY_OR_SEVERE",
    "LARGE_FETUS",
    "PLACENTA_PREVIA_OR_ACCRETA",
    "PREVIOUS_ABRUPTION",
    "ADVERSE_OBSTETRIC_HISTORY",
    "UTERINE_SCAR",
    "ANTICOAGULANT_THERAPY",
    "COAGULOPATHY",
    "SEVERE_CARDIOVASCULAR_OR_HEMATOLOGIC_DISEASE",
  ] as const) {
    if (has(p, f)) matched.push(f);
  }
  const atRisk = matched.length > 0;
  return {
    scale: "PPH",
    level: atRisk ? "HIGH" : "LOW",
    matched,
    actions: atRisk
      ? [
          "Антенатальная диагностика и лечение анемии",
          "Родоразрешение с мультидисциплинарной бригадой в учреждении 2–3 уровня",
          "Предлежание плаценты: плановая госпитализация на 3-й уровень (полное — 34 нед, неполное — 36–37 нед)",
        ]
      : [],
    source: `${SOURCE_ANC}, с.38–39`,
  };
}

export function fgrRisk(p: RiskProfile): RiskResult {
  const major: string[] = [];
  const minor: string[] = [];
  if (p.ageYears > 40) major.push("AGE_OVER_40");
  else if (p.ageYears > 35) minor.push("AGE_OVER_35");
  for (const f of [
    "SMOKING_11_PLUS_PER_DAY",
    "PREVIOUS_SGA",
    "DAILY_VIGOROUS_EXERCISE",
    "PARENT_BORN_SGA",
    "PREVIOUS_STILLBIRTH",
    "CHRONIC_HYPERTENSION",
    "DIABETES_WITH_VASCULAR_DISEASE",
    "RENAL_IMPAIRMENT",
    "ANTIPHOSPHOLIPID_SYNDROME",
    "HEAVY_BLEEDING_IN_PREGNANCY",
  ] as const) {
    if (has(p, f)) major.push(f);
  }
  if (has(p, "SMOKING") && !has(p, "SMOKING_11_PLUS_PER_DAY")) minor.push("SMOKING_1_10_PER_DAY");
  if (p.parity === 0) minor.push("NULLIPARITY");
  if (p.bmi !== undefined && (p.bmi < 20 || (p.bmi >= 25 && p.bmi <= 35))) minor.push("BMI_UNDER_20_OR_25_TO_35");
  for (const f of ["LOW_FRUIT_INTAKE", "PREVIOUS_PREECLAMPSIA", "PREGNANCY_INTERVAL_UNDER_6_OR_OVER_60_MONTHS"] as const) {
    if (has(p, f)) minor.push(f);
  }
  const highByMajor = major.length >= 1;
  const highByMinor = minor.length >= 3;
  const actions = highByMajor
    ? ["Серийная УЗ-фетометрия и допплерометрия (маточные артерии, артерия пуповины) каждые 3 нед с 26–28 нед"]
    : highByMinor
      ? ["УЗ-фетометрия и допплерометрия в 20–24 нед; при норме — повторно в 30–34 нед"]
      : ["Гравидограмма (ВДМ) с 20 нед"];
  return {
    scale: "FGR",
    level: highByMajor || highByMinor ? "HIGH" : "LOW",
    matched: [...major.map((m) => `major:${m}`), ...minor.map((m) => `minor:${m}`)],
    actions,
    source: `${SOURCE_ANC}, с.39–41, алгоритм с.55`,
  };
}

export function assessRiskGroups(p: RiskProfile): RiskResult[] {
  return [preeclampsiaRisk(p), gdmRisk(p), vteRisk(p), pphRisk(p), fgrRisk(p)];
}
