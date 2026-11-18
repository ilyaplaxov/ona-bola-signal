import type { RuleCitation, RuleSource, SourceDocument } from "@ona-bola/shared";
import type { Condition, RuleSet } from "../types";

// ILLUSTRATIVE DEMO RULES. Not clinical guidance, not reviewed by a clinician.
// Cut-off values follow the national clinical protocols of the Ministry of Health of Uzbekistan
// (order No. 180 of 23 June 2025) and the WHO documents they build on; page numbers are in the
// references below and, in structured form, in `citations` (shown under each reason on the
// patient card). Which zone each rule gives is the team's choice for the demo.
// Every rule id has a row in docs/RULES_PROVENANCE.md and Uzbek and English labels in
// frontend/src/i18n/strings.ts (RULE_LABELS); tests check both.

const UZ_ANTENATAL_2025 =
  "National clinical protocol «Antenatal care. Management of pregnant women in risk groups», Ministry of Health of Uzbekistan, order No. 180 of 23 June 2025";
const UZ_ANAEMIA_2025 =
  "National clinical protocol «Management of pregnant women with iron-deficiency anaemia», Ministry of Health of Uzbekistan, order No. 180 of 23 June 2025";

const ANC: SourceDocument = "UZ_ANTENATAL_CARE_2025";
const IDA: SourceDocument = "UZ_IRON_DEFICIENCY_ANAEMIA_2025";
const cite = (document: SourceDocument, ...pages: string[]): RuleCitation => ({ document, pages });

/** An illustrative rule's source: the full reference, plus the pages it cites when a protocol supports it. */
const illustrative = (ref: string, ...citations: RuleCitation[]): RuleSource =>
  citations.length > 0
    ? { status: "ILLUSTRATIVE", ref, citations }
    : { status: "ILLUSTRATIVE", ref };

const HYPERTENSION_SOURCE = illustrative(
  `${UZ_ANTENATAL_2025}, p. 34: hypertension from 140/90 mmHg; non-severe 140–159/90–109; severe from 160/110 mmHg. Same cut-offs as WHO 2020 (https://www.who.int/publications/i/item/9789240008793).`,
  cite(ANC, "34"),
);
const PROTEINURIA_SOURCE = illustrative(
  `${UZ_ANTENATAL_2025}, p. 36: proteinuria 0.3 g/L in the definition of severe pre-eclampsia; p. 34: proteinuria is checked at every visit for women at high risk of pre-eclampsia. Pressure cut-offs as in DEMO-BP-HIGH.`,
  cite(ANC, "34", "36"),
);
const SEVERE_ANAEMIA_SOURCE = illustrative(
  `${UZ_ANAEMIA_2025}, p. 13: severe anaemia below 70 g/L (mild 90–109, moderate 70–89 g/L, following WHO 2011).`,
  cite(IDA, "13"),
);
const TRIMESTER_ANAEMIA_SOURCE = illustrative(
  `${UZ_ANTENATAL_2025}, p. 28: anaemia below 110 g/L in the first and third trimesters and below 105 g/L in the second; ${UZ_ANAEMIA_2025}, p. 13: the same norms. The first trimester ends at 13+6 weeks (antenatal protocol, p. 16); the team starts the third at 28 weeks. The antenatal protocol, p. 20, gives 105 g/L for the third trimester instead: a question for the mentor.`,
  cite(ANC, "28"),
  cite(IDA, "13"),
);
const ANAEMIA_NO_WEEK_SOURCE = illustrative(
  `${UZ_ANAEMIA_2025}, p. 12: anaemia in pregnancy below 110 g/L. Applied while the week of pregnancy is unknown, so the stricter of the trimester norms holds.`,
  cite(IDA, "12"),
);
const GLUCOSE_SOURCE = illustrative(
  `${UZ_ANTENATAL_2025}, p. 31: venous glucose 5.1–6.9 mmol/L gestational diabetes; from 7.0 mmol/L manifest diabetes (as WHO 2013).`,
  cite(ANC, "31"),
);
const CESAREAN_SOURCE = illustrative(
  `${UZ_ANTENATAL_2025}, p. 39: a uterine scar after caesarean section is listed among risk factors. The zone is a team choice for the demo.`,
  cite(ANC, "39"),
);
const BP_SCHEDULE_EARLY_SOURCE = illustrative(
  `${UZ_ANTENATAL_2025}, pp. 14, 17: blood pressure at every visit (p. 17); before 28 weeks the planned visits (up to 12, 18–20 and 26 weeks, p. 14) can be up to 98 days apart, plus 7 days of grace: 105 days. Values from the domain pack (data-pack/RULES_PROVENANCE.md, MISS-BP-EARLY).`,
  cite(ANC, "14", "17"),
);
const BP_SCHEDULE_LATE_SOURCE = illustrative(
  `${UZ_ANTENATAL_2025}, pp. 14, 17: blood pressure at every visit (p. 17); from 28 weeks the planned visits (26, 30, 34, 36, 38 and 40 weeks, p. 14) are at most 28 days apart, plus 7 days of grace: 35 days. Values from the domain pack (MISS-BP-LATE).`,
  cite(ANC, "14", "17"),
);
const BP_SCHEDULE_NO_WEEK_SOURCE = illustrative(
  `${UZ_ANTENATAL_2025}, pp. 14, 17: blood pressure at every visit. While the week of pregnancy is unknown, the shortest gap of the visit schedule applies (35 days, as from 28 weeks).`,
  cite(ANC, "14", "17"),
);
const HB_SCHEDULE_SOURCE = illustrative(
  `${UZ_ANTENATAL_2025}, p. 20: a blood count at the first visit and at 26 weeks. From 28 weeks, haemoglobin older than 112 days means the 26-week count was missed (26 to 41 weeks is at most 105 days, plus 7 days of grace). Values from the domain pack (MISS-HB-26W).`,
  cite(ANC, "20"),
);
const BRIEF_RISK_FACTOR = illustrative(
  "Risk factor listed in the project brief (section 6.2). The zone is a team choice for the demo.",
);
const BRIEF_MISSING_DATA = illustrative(
  "Project brief, section 17: missing data is reported and never treated as normal. Warning only.",
);
const TREND_REPORT_ONLY = illustrative(
  "Reported only; changes no zone until a clinician defines which change is concerning (brief, section 6.3).",
);

const raisedPressure: Condition = {
  any: [
    { measure: "BLOOD_PRESSURE.systolic", op: ">=", value: 140 },
    { measure: "BLOOD_PRESSURE.diastolic", op: ">=", value: 90 },
  ],
};
const severePressure: Condition = {
  any: [
    { measure: "BLOOD_PRESSURE.systolic", op: ">=", value: 160 },
    { measure: "BLOOD_PRESSURE.diastolic", op: ">=", value: 110 },
  ],
};
const belowSevere: Condition = {
  all: [
    { measure: "BLOOD_PRESSURE.systolic", op: "<", value: 160 },
    { measure: "BLOOD_PRESSURE.diastolic", op: "<", value: 110 },
  ],
};
const significantProteinuria: Condition = { measure: "PROTEINURIA", op: ">=", value: 0.3 };

/** Haemoglobin from 70 g/L (below that, DEMO-HB-SEVERE applies) up to the given anaemia threshold. */
const anaemiaBelow = (threshold: number): Condition => ({
  all: [
    { measure: "HEMOGLOBIN", op: "<", value: threshold },
    { measure: "HEMOGLOBIN", op: ">=", value: 70 },
  ],
});

export const DEMO_RULE_SET: RuleSet = {
  id: "demo",
  version: "demo-0.2",
  kind: "ILLUSTRATIVE",
  rules: [
    // Blood pressure and proteinuria
    {
      id: "DEMO-BP-SEVERE",
      kind: "THRESHOLD",
      zone: "RED",
      when: severePressure,
      reason: "Blood pressure in the severe hypertension range",
      source: HYPERTENSION_SOURCE,
    },
    {
      id: "DEMO-BP-HIGH",
      kind: "THRESHOLD",
      zone: "YELLOW",
      when: { all: [raisedPressure, belowSevere] },
      reason: "Blood pressure in the hypertension range",
      source: HYPERTENSION_SOURCE,
    },
    {
      id: "DEMO-PE-PATTERN",
      kind: "THRESHOLD",
      zone: "RED",
      when: { all: [raisedPressure, significantProteinuria] },
      reason: "Pre-eclampsia pattern: raised blood pressure with proteinuria",
      source: PROTEINURIA_SOURCE,
    },
    {
      id: "DEMO-PROTEINURIA",
      kind: "THRESHOLD",
      zone: "YELLOW",
      when: significantProteinuria,
      reason: "Protein in the urine",
      source: PROTEINURIA_SOURCE,
    },

    // Haemoglobin. The anaemia threshold depends on the trimester the reading was taken in.
    {
      id: "DEMO-HB-SEVERE",
      kind: "THRESHOLD",
      zone: "RED",
      when: { measure: "HEMOGLOBIN", op: "<", value: 70 },
      reason: "Haemoglobin in the severe anaemia range",
      source: SEVERE_ANAEMIA_SOURCE,
    },
    {
      id: "DEMO-HB-LOW-T1",
      kind: "THRESHOLD",
      zone: "YELLOW",
      when: anaemiaBelow(110),
      gestationalWeeks: { to: 14 },
      reason: "Haemoglobin below 110 g/L, the anaemia threshold in the first trimester",
      source: TRIMESTER_ANAEMIA_SOURCE,
    },
    {
      id: "DEMO-HB-LOW-T2",
      kind: "THRESHOLD",
      zone: "YELLOW",
      when: anaemiaBelow(105),
      gestationalWeeks: { from: 14, to: 28 },
      reason: "Haemoglobin below 105 g/L, the anaemia threshold in the second trimester",
      source: TRIMESTER_ANAEMIA_SOURCE,
    },
    {
      id: "DEMO-HB-LOW-T3",
      kind: "THRESHOLD",
      zone: "YELLOW",
      when: anaemiaBelow(110),
      gestationalWeeks: { from: 28 },
      reason: "Haemoglobin below 110 g/L, the anaemia threshold in the third trimester",
      source: TRIMESTER_ANAEMIA_SOURCE,
    },
    {
      id: "DEMO-HB-LOW-NO-WEEK",
      kind: "THRESHOLD",
      zone: "YELLOW",
      when: anaemiaBelow(110),
      gestationalWeeks: { unknown: true },
      reason:
        "Haemoglobin below 110 g/L, the anaemia threshold in pregnancy; week of pregnancy unknown",
      source: ANAEMIA_NO_WEEK_SOURCE,
    },

    // Glucose
    {
      id: "DEMO-GLUCOSE-GDM",
      kind: "THRESHOLD",
      zone: "YELLOW",
      when: {
        all: [
          { measure: "GLUCOSE", op: ">=", value: 5.1 },
          { measure: "GLUCOSE", op: "<", value: 7.0 },
        ],
      },
      reason: "Fasting glucose in the gestational diabetes range",
      source: GLUCOSE_SOURCE,
    },
    {
      id: "DEMO-GLUCOSE-DM",
      kind: "THRESHOLD",
      zone: "YELLOW",
      when: { measure: "GLUCOSE", op: ">=", value: 7.0 },
      reason: "Fasting glucose in the diabetes-in-pregnancy range",
      source: GLUCOSE_SOURCE,
    },

    // Recorded risk factors
    {
      id: "DEMO-RF-CESAREAN",
      kind: "THRESHOLD",
      zone: "YELLOW",
      when: { factor: "RISK_FACTOR.previousCesarean", is: true },
      reason: "Risk factor: previous caesarean section",
      source: CESAREAN_SOURCE,
    },
    {
      id: "DEMO-RF-GDM",
      kind: "THRESHOLD",
      zone: "YELLOW",
      when: { factor: "RISK_FACTOR.gestationalDiabetes", is: true },
      reason: "Risk factor: gestational diabetes recorded",
      source: BRIEF_RISK_FACTOR,
    },

    // Trends: reported only
    {
      id: "DEMO-TREND-SYSTOLIC",
      kind: "TREND",
      zone: null,
      measure: "BLOOD_PRESSURE.systolic",
      direction: "RISING",
      minReadings: 3,
      reason: "Systolic pressure is rising",
      source: TREND_REPORT_ONLY,
    },
    {
      id: "DEMO-TREND-HB",
      kind: "TREND",
      zone: null,
      measure: "HEMOGLOBIN",
      direction: "FALLING",
      minReadings: 3,
      reason: "Haemoglobin is falling",
      source: TREND_REPORT_ONLY,
    },

    // Data quality: warnings only. Staleness follows the visit schedule of the protocol.
    {
      id: "DEMO-DQ-BP-MISSING",
      kind: "DATA_QUALITY",
      zone: null,
      check: "MISSING",
      measure: "BLOOD_PRESSURE.systolic",
      reason: "No blood pressure recorded",
      source: BRIEF_MISSING_DATA,
    },
    {
      id: "DEMO-DQ-BP-STALE-EARLY",
      kind: "DATA_QUALITY",
      zone: null,
      check: "STALE",
      measure: "BLOOD_PRESSURE.systolic",
      staleAfterDays: 105,
      gestationalWeeks: { to: 28 },
      reason:
        "Blood pressure not measured for longer than the longest gap between planned visits before 28 weeks",
      source: BP_SCHEDULE_EARLY_SOURCE,
    },
    {
      id: "DEMO-DQ-BP-STALE-LATE",
      kind: "DATA_QUALITY",
      zone: null,
      check: "STALE",
      measure: "BLOOD_PRESSURE.systolic",
      staleAfterDays: 35,
      gestationalWeeks: { from: 28 },
      reason:
        "Blood pressure not measured for longer than the gap between planned visits from 28 weeks",
      source: BP_SCHEDULE_LATE_SOURCE,
    },
    {
      id: "DEMO-DQ-BP-STALE-NO-WEEK",
      kind: "DATA_QUALITY",
      zone: null,
      check: "STALE",
      measure: "BLOOD_PRESSURE.systolic",
      staleAfterDays: 35,
      gestationalWeeks: { unknown: true },
      reason:
        "Blood pressure not measured for longer than the shortest gap between planned visits; week of pregnancy unknown",
      source: BP_SCHEDULE_NO_WEEK_SOURCE,
    },
    {
      id: "DEMO-DQ-HB-MISSING",
      kind: "DATA_QUALITY",
      zone: null,
      check: "MISSING",
      measure: "HEMOGLOBIN",
      reason: "No haemoglobin recorded",
      source: BRIEF_MISSING_DATA,
    },
    {
      id: "DEMO-DQ-HB-STALE",
      kind: "DATA_QUALITY",
      zone: null,
      check: "STALE",
      measure: "HEMOGLOBIN",
      staleAfterDays: 112,
      gestationalWeeks: { from: 28 },
      reason: "No haemoglobin since the blood count planned at 26 weeks",
      source: HB_SCHEDULE_SOURCE,
    },
    {
      id: "DEMO-DQ-PROTEINURIA-MISSING",
      kind: "DATA_QUALITY",
      zone: null,
      check: "MISSING",
      measure: "PROTEINURIA",
      reason: "No urine protein result recorded",
      source: BRIEF_MISSING_DATA,
    },
    {
      id: "DEMO-DQ-DUE-DATE-MISSING",
      kind: "DATA_QUALITY",
      zone: null,
      check: "MISSING",
      measure: "PATIENT.gestationalWeek",
      reason: "Estimated due date not recorded, so the gestational week is unknown",
      source: BRIEF_MISSING_DATA,
    },
    {
      id: "DEMO-DQ-CESAREAN-MISSING",
      kind: "DATA_QUALITY",
      zone: null,
      check: "MISSING",
      measure: "RISK_FACTOR.previousCesarean",
      reason: "Previous caesarean not recorded",
      source: BRIEF_MISSING_DATA,
    },
    {
      id: "DEMO-DQ-GDM-MISSING",
      kind: "DATA_QUALITY",
      zone: null,
      check: "MISSING",
      measure: "RISK_FACTOR.gestationalDiabetes",
      reason: "Gestational diabetes status not recorded",
      source: BRIEF_MISSING_DATA,
    },
  ],
};
