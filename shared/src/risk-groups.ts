import { z } from "zod";
import { RuleSource } from "./ruleset";

/**
 * Findings from the anamnesis and the current pregnancy that the risk-group scales of the antenatal
 * protocol (pp. 33–41) count. A listed flag is present; a flag that is not listed counts as absent.
 * Same codes as the domain pack (data-pack/risk-scales.ts).
 */
export const RiskFlag = z.enum([
  "PREVIOUS_HYPERTENSION_IN_PREGNANCY",
  "CHRONIC_HYPERTENSION",
  "CHRONIC_KIDNEY_DISEASE",
  "DIABETES",
  "DIABETES_WITH_VASCULAR_DISEASE",
  "AUTOIMMUNE_DISEASE",
  "FAMILY_HISTORY_PREECLAMPSIA",
  "PREGNANCY_INTERVAL_OVER_10_YEARS",
  "MULTIPLE_PREGNANCY",
  "PREVIOUS_GDM",
  "FAMILY_HISTORY_DIABETES",
  "MACROSOMIA_4500G",
  "POLYHYDRAMNIOS",
  "PREVIOUS_STILLBIRTH",
  "PREVIOUS_CHILD_WITH_MALFORMATION",
  "UNEXPLAINED_NEONATAL_DEATH",
  "PREVIOUS_RECURRENT_VTE",
  "PREVIOUS_UNPROVOKED_OR_ESTROGEN_VTE",
  "PREVIOUS_PROVOKED_VTE",
  "FAMILY_HISTORY_THROMBOSIS",
  "HIGH_RISK_THROMBOPHILIA",
  "SMOKING",
  "VARICOSE_VEINS",
  "MEDICAL_COMORBIDITY",
  "PREECLAMPSIA_MODERATE",
  "PREECLAMPSIA_EARLY_OR_SEVERE",
  "INTRAUTERINE_FETAL_DEATH",
  "SURGERY_IN_PREGNANCY",
  "DEHYDRATION",
  "IMMOBILITY_OVER_4_DAYS",
  "PREVIOUS_PPH",
  "LARGE_FETUS",
  "PLACENTA_PREVIA_OR_ACCRETA",
  "PREVIOUS_ABRUPTION",
  "ADVERSE_OBSTETRIC_HISTORY",
  "UTERINE_SCAR",
  "ANTICOAGULANT_THERAPY",
  "COAGULOPATHY",
  "SEVERE_CARDIOVASCULAR_OR_HEMATOLOGIC_DISEASE",
  "SMOKING_11_PLUS_PER_DAY",
  "PREVIOUS_SGA",
  "DAILY_VIGOROUS_EXERCISE",
  "PARENT_BORN_SGA",
  "RENAL_IMPAIRMENT",
  "ANTIPHOSPHOLIPID_SYNDROME",
  "HEAVY_BLEEDING_IN_PREGNANCY",
  "LOW_FRUIT_INTAKE",
  "PREVIOUS_PREECLAMPSIA",
  "PREGNANCY_INTERVAL_UNDER_6_OR_OVER_60_MONTHS",
]);
export type RiskFlag = z.infer<typeof RiskFlag>;

/** Factors a scale derives from age, body-mass index, parity or haemoglobin rather than from a flag. */
export const DerivedRiskFactor = z.enum([
  "NULLIPARITY",
  "AGE_40_PLUS",
  "AGE_OVER_35",
  "AGE_OVER_40",
  "BMI_35_PLUS",
  "BMI_OVER_30",
  "BMI_UNDER_20_OR_25_TO_35",
  "PARITY_3_PLUS",
  "PARITY_4_PLUS",
  "ANEMIA_HB_BELOW_90",
  "SMOKING_1_10_PER_DAY",
]);
export type DerivedRiskFactor = z.infer<typeof DerivedRiskFactor>;

export const RiskFactorCode = z.union([RiskFlag, DerivedRiskFactor]);
export type RiskFactorCode = z.infer<typeof RiskFactorCode>;

/** The five scales of the antenatal protocol: pre-eclampsia, gestational diabetes, thromboembolism, postpartum haemorrhage, fetal growth restriction. */
export const RiskScale = z.enum(["PREECLAMPSIA", "GDM", "VTE", "PPH", "FGR"]);
export type RiskScale = z.infer<typeof RiskScale>;

export const RiskGroupLevel = z.enum(["LOW", "MODERATE", "HIGH"]);
export type RiskGroupLevel = z.infer<typeof RiskGroupLevel>;

/** What the protocol recommends for a raised risk group; the UI words each code. */
export const RiskGroupAction = z.enum([
  "ASPIRIN_150_EVENING",
  "DAILY_BP_SELF_CHECK",
  "PROTEINURIA_EVERY_VISIT",
  "OGTT_FIRST_VISIT_AND_26_28",
  "COMPRESSION_STOCKINGS",
  "HAEMATOLOGIST_LMWH",
  "REASSESS_EVERY_VISIT",
  "TREAT_ANAEMIA",
  "DELIVER_AT_LEVEL_2_3",
  "PREVIA_PLANNED_ADMISSION",
  "SERIAL_GROWTH_SCANS_FROM_26_28",
  "GROWTH_SCAN_20_24",
]);
export type RiskGroupAction = z.infer<typeof RiskGroupAction>;

/**
 * One risk-group scale for one patient: a profile from her history, shown as a badge.
 * It is not a zone and never changes one; only the Risk Engine's rules set zones.
 */
export const RiskGroup = z.object({
  scale: RiskScale,
  level: RiskGroupLevel,
  /** Points on a scored scale (thromboembolism); absent on the others. */
  score: z.number().int().nonnegative().optional(),
  /** The factors that counted. */
  matched: z.array(RiskFactorCode),
  /** What the protocol recommends at this level. Empty at LOW. */
  actions: z.array(RiskGroupAction),
  source: RuleSource,
});
export type RiskGroup = z.infer<typeof RiskGroup>;
