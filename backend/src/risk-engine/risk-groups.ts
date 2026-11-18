import type {
  RiskFactorCode,
  RiskFactors,
  RiskFlag,
  RiskGroup,
  RiskGroupAction,
  RuleSource,
} from "@ona-bola/shared";

// RISK GROUPS FROM THE ANAMNESIS. Badges for the patient card: they never set or change a zone.
// The five scales of the national antenatal protocol (Ministry of Health of Uzbekistan, order
// No. 180 of 23 June 2025, pp. 33–41), ported from the domain pack (data-pack/risk-scales.ts,
// 17 Nov 2026) with the same factors and cut-offs. ILLUSTRATIVE, like the demo rules.
// Differences from the pack: actions are codes the UI words in Uzbek and English, a scale at LOW
// lists no actions, and the placenta-previa admission is listed only when previa is recorded.

/** What the scales read about one patient. */
export interface RiskProfile {
  ageYears: number;
  /** Previous births. */
  parity: number;
  /** Body-mass index before pregnancy, kg/m². */
  bmi?: number;
  /** Latest haemoglobin, g/L. */
  latestHbGL?: number;
  flags: ReadonlySet<RiskFlag>;
}

const UZ_ANTENATAL_2025 =
  "National clinical protocol «Antenatal care. Management of pregnant women in risk groups», Ministry of Health of Uzbekistan, order No. 180 of 23 June 2025";

const source = (text: string, ...pages: string[]): RuleSource => ({
  status: "ILLUSTRATIVE",
  ref: `${UZ_ANTENATAL_2025}, ${text}`,
  citations: [{ document: "UZ_ANTENATAL_CARE_2025", pages }],
});

const PREECLAMPSIA_SOURCE = source(
  "pp. 33–34: high risk with one high-risk factor (hypertension in a previous pregnancy, chronic hypertension, chronic kidney disease, diabetes, autoimmune disease) or two moderate ones (first birth, age 40 or more, BMI 35 or more, pre-eclampsia in the family, more than 10 years since the last pregnancy, multiple pregnancy). Then aspirin 150 mg in the evening from 11–14+6 to 36 weeks, daily blood-pressure self-checks, proteinuria at every visit. The algorithm on p. 54 gives aspirin to 38 weeks.",
  "33–34",
  "54",
);
const GDM_SOURCE = source(
  "pp. 20–21, 30, 53: any one factor (BMI over 30, gestational diabetes before, age 40 or more, diabetes in first- or second-degree relatives, a baby of 4500 g or more, polyhydramnios, stillbirth, a child with a malformation, unexplained neonatal death) calls for a 75 g OGTT at the first visit and again at 26–28 weeks.",
  "20–21",
  "30",
  "53",
);
const VTE_SOURCE = source(
  "pp. 37–38: thromboembolism points; 1–2 points moderate risk (compression stockings), 3 or more high risk (stockings and low-molecular-weight heparin through a haematologist); reassess at every visit.",
  "37–38",
);
const PPH_SOURCE = source(
  "pp. 38–39: any one factor (multiple pregnancy, 4 or more births, haemoglobin below 90 g/L, previous postpartum haemorrhage, pre-eclampsia, a large baby, placenta praevia or accreta, previous abruption, miscarriages or abortions, uterine scar, anticoagulants, coagulopathy, severe cardiovascular or blood disease) puts a woman at risk of postpartum haemorrhage: treat anaemia, deliver at a level 2–3 facility, admit placenta praevia in advance.",
  "38–39",
);
const FGR_SOURCE = source(
  "pp. 40, 55: one major factor or three minor ones mean high risk of fetal growth restriction; a major factor calls for growth scans with Doppler every 3 weeks from 26–28 weeks, three minor ones for a growth scan with Doppler at 20–24 weeks.",
  "40",
  "55",
);

const PREECLAMPSIA_HIGH_FLAGS = [
  "PREVIOUS_HYPERTENSION_IN_PREGNANCY",
  "CHRONIC_HYPERTENSION",
  "CHRONIC_KIDNEY_DISEASE",
  "DIABETES",
  "AUTOIMMUNE_DISEASE",
] as const satisfies readonly RiskFlag[];
const PREECLAMPSIA_MODERATE_FLAGS = [
  "FAMILY_HISTORY_PREECLAMPSIA",
  "PREGNANCY_INTERVAL_OVER_10_YEARS",
  "MULTIPLE_PREGNANCY",
] as const satisfies readonly RiskFlag[];
const GDM_FLAGS = [
  "PREVIOUS_GDM",
  "FAMILY_HISTORY_DIABETES",
  "MACROSOMIA_4500G",
  "POLYHYDRAMNIOS",
  "PREVIOUS_STILLBIRTH",
  "PREVIOUS_CHILD_WITH_MALFORMATION",
  "UNEXPLAINED_NEONATAL_DEATH",
] as const satisfies readonly RiskFlag[];
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
const PPH_FLAGS = [
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
] as const satisfies readonly RiskFlag[];
const FGR_MAJOR_FLAGS = [
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
] as const satisfies readonly RiskFlag[];
const FGR_MINOR_FLAGS = [
  "LOW_FRUIT_INTAKE",
  "PREVIOUS_PREECLAMPSIA",
  "PREGNANCY_INTERVAL_UNDER_6_OR_OVER_60_MONTHS",
] as const satisfies readonly RiskFlag[];

const present = (p: RiskProfile, flags: readonly RiskFlag[]): RiskFlag[] =>
  flags.filter((f) => p.flags.has(f));

export function preeclampsiaRisk(p: RiskProfile): RiskGroup {
  const high = present(p, PREECLAMPSIA_HIGH_FLAGS);
  const moderate: RiskFactorCode[] = [];
  if (p.parity === 0) moderate.push("NULLIPARITY");
  if (p.ageYears >= 40) moderate.push("AGE_40_PLUS");
  if (p.bmi !== undefined && p.bmi >= 35) moderate.push("BMI_35_PLUS");
  moderate.push(...present(p, PREECLAMPSIA_MODERATE_FLAGS));
  const isHigh = high.length >= 1 || moderate.length >= 2;
  return {
    scale: "PREECLAMPSIA",
    level: isHigh ? "HIGH" : "LOW",
    matched: [...high, ...moderate],
    actions: isHigh
      ? ["ASPIRIN_150_EVENING", "DAILY_BP_SELF_CHECK", "PROTEINURIA_EVERY_VISIT"]
      : [],
    source: PREECLAMPSIA_SOURCE,
  };
}

export function gdmRisk(p: RiskProfile): RiskGroup {
  const matched: RiskFactorCode[] = [];
  if (p.bmi !== undefined && p.bmi > 30) matched.push("BMI_OVER_30");
  if (p.ageYears >= 40) matched.push("AGE_40_PLUS");
  matched.push(...present(p, GDM_FLAGS));
  const atRisk = matched.length > 0;
  return {
    scale: "GDM",
    level: atRisk ? "HIGH" : "LOW",
    matched,
    actions: atRisk ? ["OGTT_FIRST_VISIT_AND_26_28"] : [],
    source: GDM_SOURCE,
  };
}

export function vteRisk(p: RiskProfile): RiskGroup {
  const matched: RiskFactorCode[] = [];
  let score = 0;
  const add = (code: RiskFactorCode, points: number) => {
    matched.push(code);
    score += points;
  };
  for (const [flag, points] of VTE_POINTS) if (p.flags.has(flag)) add(flag, points);
  if (p.ageYears > 35) add("AGE_OVER_35", 1);
  if (p.bmi !== undefined && p.bmi > 30) add("BMI_OVER_30", 1);
  if (p.parity >= 3) add("PARITY_3_PLUS", 1);
  if (p.flags.has("PREECLAMPSIA_EARLY_OR_SEVERE")) add("PREECLAMPSIA_EARLY_OR_SEVERE", 2);
  else if (p.flags.has("PREECLAMPSIA_MODERATE")) add("PREECLAMPSIA_MODERATE", 1);
  const level = score >= 3 ? "HIGH" : score >= 1 ? "MODERATE" : "LOW";
  const actions: RiskGroupAction[] =
    level === "HIGH"
      ? ["COMPRESSION_STOCKINGS", "HAEMATOLOGIST_LMWH", "REASSESS_EVERY_VISIT"]
      : level === "MODERATE"
        ? ["COMPRESSION_STOCKINGS", "REASSESS_EVERY_VISIT"]
        : [];
  return { scale: "VTE", level, score, matched, actions, source: VTE_SOURCE };
}

export function pphRisk(p: RiskProfile): RiskGroup {
  const matched: RiskFactorCode[] = [];
  if (p.parity >= 4) matched.push("PARITY_4_PLUS");
  if (p.latestHbGL !== undefined && p.latestHbGL < 90) matched.push("ANEMIA_HB_BELOW_90");
  matched.push(...present(p, PPH_FLAGS));
  const atRisk = matched.length > 0;
  const actions: RiskGroupAction[] = atRisk ? ["TREAT_ANAEMIA", "DELIVER_AT_LEVEL_2_3"] : [];
  if (p.flags.has("PLACENTA_PREVIA_OR_ACCRETA")) actions.push("PREVIA_PLANNED_ADMISSION");
  return { scale: "PPH", level: atRisk ? "HIGH" : "LOW", matched, actions, source: PPH_SOURCE };
}

export function fgrRisk(p: RiskProfile): RiskGroup {
  const major: RiskFactorCode[] = [];
  const minor: RiskFactorCode[] = [];
  if (p.ageYears > 40) major.push("AGE_OVER_40");
  else if (p.ageYears > 35) minor.push("AGE_OVER_35");
  major.push(...present(p, FGR_MAJOR_FLAGS));
  if (p.flags.has("SMOKING") && !p.flags.has("SMOKING_11_PLUS_PER_DAY")) {
    minor.push("SMOKING_1_10_PER_DAY");
  }
  if (p.parity === 0) minor.push("NULLIPARITY");
  if (p.bmi !== undefined && (p.bmi < 20 || (p.bmi >= 25 && p.bmi <= 35))) {
    minor.push("BMI_UNDER_20_OR_25_TO_35");
  }
  minor.push(...present(p, FGR_MINOR_FLAGS));
  const byMajor = major.length >= 1;
  const byMinor = minor.length >= 3;
  const actions: RiskGroupAction[] = byMajor
    ? ["SERIAL_GROWTH_SCANS_FROM_26_28"]
    : byMinor
      ? ["GROWTH_SCAN_20_24"]
      : [];
  return {
    scale: "FGR",
    level: byMajor || byMinor ? "HIGH" : "LOW",
    matched: [...major, ...minor],
    actions,
    source: FGR_SOURCE,
  };
}

export function assessRiskGroups(p: RiskProfile): RiskGroup[] {
  return [preeclampsiaRisk(p), gdmRisk(p), vteRisk(p), pphRisk(p), fgrRisk(p)];
}

/**
 * Risk groups for a patient as stored: null when the parity (the sign that the anamnesis was
 * taken) or the age is unknown, so a missing history never reads as low risk. A recorded previous
 * caesarean counts as a uterine scar.
 */
export function riskGroupsFor(args: {
  riskFactors: RiskFactors;
  ageYears: number | null;
  latestHbGL: number | null;
}): RiskGroup[] | null {
  const { riskFactors, ageYears, latestHbGL } = args;
  if (riskFactors.parity === undefined || ageYears === null) return null;
  const flags = new Set<RiskFlag>(riskFactors.flags ?? []);
  if (riskFactors.previousCesarean === true) flags.add("UTERINE_SCAR");
  return assessRiskGroups({
    ageYears,
    parity: riskFactors.parity,
    flags,
    ...(riskFactors.bmi !== undefined ? { bmi: riskFactors.bmi } : {}),
    ...(latestHbGL !== null ? { latestHbGL } : {}),
  });
}
