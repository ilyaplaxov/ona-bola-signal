# Rules provenance

Every rule the Risk Engine can apply has one row here. A rule without a row does not ship: `backend/test/risk-engine.test.ts` fails if a rule id is missing from this file, or if it has no Uzbek and English label in `frontend/src/i18n/strings.ts` (`RULE_LABELS`).

- **ILLUSTRATIVE**: chosen by the team for the demo. Not clinical guidance. Shown with a visible label in the UI and in the pitch.
- **VALIDATED**: taken from a cited national protocol or another approved reference, and reviewed by a named clinician.

Illustrative rules use the id prefix `DEMO-` and live in `backend/src/risk-engine/rules/demo-rules.ts`. Validated rules go in `backend/src/risk-engine/rules/validated-rules.ts` (empty for now). The API serves the active set at `GET /api/ruleset`, with descriptions generated from the rule definitions.

Each rule's `source` holds the full reference (`ref`) and, for every rule a protocol supports, the same pages in structured form (`citations`: document and printed pages). The patient card shows them under each reason ("Manba: «Антенатальный уход» milliy protokoli, 34-bet"), and the rules page next to the reference. A test checks that every cited page also appears in the reference text.

## Active rule set: `demo-0.2` (ILLUSTRATIVE)

Every cut-off value matches the national clinical protocols of the Ministry of Health of Uzbekistan [N1], [N2] and the WHO documents they build on [S1]–[S5]. Which zone a rule gives is the team's choice for the demo, and no rule has been reviewed by a clinician yet, so the set stays ILLUSTRATIVE.

"Weeks" limits a rule to some weeks of pregnancy (see [Week ranges](#week-ranges)); "any" means the rule applies whatever the week.

| Rule id                       | Kind         | Measures                         | Value used                                            | Weeks                  | Zone          | Source                               | Status       | Reviewed by | Date       |
| ----------------------------- | ------------ | -------------------------------- | ----------------------------------------------------- | ---------------------- | ------------- | ------------------------------------ | ------------ | ----------- | ---------- |
| `DEMO-BP-SEVERE`              | THRESHOLD    | systolic, diastolic              | systolic ≥ 160 or diastolic ≥ 110 mmHg                | any                    | RED           | [N1] p. 34; [S1]                     | ILLUSTRATIVE | not yet     | 2026-11-17 |
| `DEMO-BP-HIGH`                | THRESHOLD    | systolic, diastolic              | ≥ 140 or ≥ 90 mmHg, and below 160/110                 | any                    | YELLOW        | [N1] p. 34; [S1]                     | ILLUSTRATIVE | not yet     | 2026-11-17 |
| `DEMO-PE-PATTERN`             | THRESHOLD    | systolic, diastolic, proteinuria | pressure ≥ 140 or ≥ 90 mmHg and proteinuria ≥ 0.3 g/L | any                    | RED           | [N1] pp. 34, 36; [S2]                | ILLUSTRATIVE | not yet     | 2026-11-17 |
| `DEMO-PROTEINURIA`            | THRESHOLD    | proteinuria                      | ≥ 0.3 g/L                                             | any                    | YELLOW        | [N1] pp. 34, 36; [S2]                | ILLUSTRATIVE | not yet     | 2026-11-17 |
| `DEMO-HB-SEVERE`              | THRESHOLD    | haemoglobin                      | < 70 g/L                                              | any                    | RED           | [N2] p. 13; [S3]                     | ILLUSTRATIVE | not yet     | 2026-11-17 |
| `DEMO-HB-LOW-T1`              | THRESHOLD    | haemoglobin, gestational week    | 70–109 g/L                                            | reading before week 14 | YELLOW        | [N1] p. 28; [N2] p. 13               | ILLUSTRATIVE | not yet     | 2026-11-18 |
| `DEMO-HB-LOW-T2`              | THRESHOLD    | haemoglobin, gestational week    | 70–104 g/L                                            | reading in weeks 14–27 | YELLOW        | [N1] p. 28; [N2] p. 13               | ILLUSTRATIVE | not yet     | 2026-11-18 |
| `DEMO-HB-LOW-T3`              | THRESHOLD    | haemoglobin, gestational week    | 70–109 g/L                                            | reading from week 28   | YELLOW        | [N1] p. 28; [N2] p. 13 ⚠             | ILLUSTRATIVE | not yet     | 2026-11-18 |
| `DEMO-HB-LOW-NO-WEEK`         | THRESHOLD    | haemoglobin, gestational week    | 70–109 g/L                                            | week unknown           | YELLOW        | [N2] p. 12                           | ILLUSTRATIVE | not yet     | 2026-11-18 |
| `DEMO-GLUCOSE-GDM`            | THRESHOLD    | fasting glucose                  | 5.1–6.9 mmol/L                                        | any                    | YELLOW        | [N1] p. 31; [S4]                     | ILLUSTRATIVE | not yet     | 2026-11-17 |
| `DEMO-GLUCOSE-DM`             | THRESHOLD    | fasting glucose                  | ≥ 7.0 mmol/L                                          | any                    | YELLOW        | [N1] p. 31; [S4]                     | ILLUSTRATIVE | not yet     | 2026-11-17 |
| `DEMO-RF-CESAREAN`            | THRESHOLD    | previous caesarean               | recorded as yes                                       | any                    | YELLOW        | [N1] p. 39 (team zone)               | ILLUSTRATIVE | not yet     | 2026-11-17 |
| `DEMO-RF-GDM`                 | THRESHOLD    | gestational diabetes             | recorded as yes                                       | any                    | YELLOW        | Brief §6.2 (team zone)               | ILLUSTRATIVE | not yet     | 2026-11-17 |
| `DEMO-TREND-SYSTOLIC`         | TREND        | systolic                         | rising across 3 consecutive readings                  | any                    | none, report  | Brief §6.3                           | ILLUSTRATIVE | not yet     | 2026-11-17 |
| `DEMO-TREND-HB`               | TREND        | haemoglobin                      | falling across 3 consecutive readings                 | any                    | none, report  | Brief §6.3                           | ILLUSTRATIVE | not yet     | 2026-11-17 |
| `DEMO-DQ-BP-MISSING`          | DATA_QUALITY | systolic                         | no reading                                            | any                    | none, warning | Brief §17                            | ILLUSTRATIVE | not yet     | 2026-11-17 |
| `DEMO-DQ-BP-STALE-EARLY`      | DATA_QUALITY | systolic, gestational week       | latest reading older than 105 days                    | today before week 28   | none, warning | [N1] pp. 14, 17; [D] MISS-BP-EARLY   | ILLUSTRATIVE | not yet     | 2026-11-18 |
| `DEMO-DQ-BP-STALE-LATE`       | DATA_QUALITY | systolic, gestational week       | latest reading older than 35 days                     | today from week 28     | none, warning | [N1] pp. 14, 17; [D] MISS-BP-LATE    | ILLUSTRATIVE | not yet     | 2026-11-18 |
| `DEMO-DQ-BP-STALE-NO-WEEK`    | DATA_QUALITY | systolic, gestational week       | latest reading older than 35 days                     | week unknown           | none, warning | [N1] pp. 14, 17 (team: shortest gap) | ILLUSTRATIVE | not yet     | 2026-11-18 |
| `DEMO-DQ-HB-MISSING`          | DATA_QUALITY | haemoglobin                      | no reading                                            | any                    | none, warning | Brief §17                            | ILLUSTRATIVE | not yet     | 2026-11-17 |
| `DEMO-DQ-HB-STALE`            | DATA_QUALITY | haemoglobin, gestational week    | latest reading older than 112 days                    | today from week 28     | none, warning | [N1] p. 20; [D] MISS-HB-26W          | ILLUSTRATIVE | not yet     | 2026-11-18 |
| `DEMO-DQ-PROTEINURIA-MISSING` | DATA_QUALITY | proteinuria                      | no reading                                            | any                    | none, warning | Brief §17                            | ILLUSTRATIVE | not yet     | 2026-11-17 |
| `DEMO-DQ-DUE-DATE-MISSING`    | DATA_QUALITY | gestational week                 | no estimated due date                                 | any                    | none, warning | Brief §17                            | ILLUSTRATIVE | not yet     | 2026-11-17 |
| `DEMO-DQ-CESAREAN-MISSING`    | DATA_QUALITY | previous caesarean               | not recorded                                          | any                    | none, warning | Brief §17                            | ILLUSTRATIVE | not yet     | 2026-11-17 |
| `DEMO-DQ-GDM-MISSING`         | DATA_QUALITY | gestational diabetes             | not recorded                                          | any                    | none, warning | Brief §17                            | ILLUSTRATIVE | not yet     | 2026-11-17 |

⚠ [N1] contradicts itself on the third trimester: p. 20 calls haemoglobin ≥ 105 g/L normal there, while p. 28 and [N2] p. 13 diagnose anaemia below 110 g/L. We use 110 (two sources out of three, as the domain pack decided). Question for the mentor.

### Changes from `demo-0.1` (18 Nov 2026)

- `DEMO-HB-LOW` (anaemia below 110 g/L at any week) became four rules: the national trimester norms ([N1] p. 28: below 110 g/L in the first and third trimesters, below 105 g/L in the second) and, while the week is unknown, the general threshold of [N2] p. 12. Haemoglobin of 105–109 g/L in the second trimester is no longer anaemia.
- `DEMO-DQ-BP-STALE` (no blood pressure for 56 days at any week) became three rules that follow the visit schedule: 105 days before week 28, 35 days from week 28, 35 days while the week is unknown.
- New `DEMO-DQ-HB-STALE`: from week 28, haemoglobin older than 112 days means the 26-week blood count was missed ([N1] p. 20).
- `DEMO-HB-SEVERE` now cites [N2] p. 13 only (the severity grades); the anaemia definition on p. 12 moved to `DEMO-HB-LOW-NO-WEEK`.
- Values come from the domain pack [D] (rules `HB-MILD-T1`, `HB-MILD-T2`, `HB-MILD-T3`, `MISS-BP-EARLY`, `MISS-BP-LATE`, `MISS-HB-26W`); each was checked against the protocol PDF on the cited page. Zones stay as in `demo-0.1`: Yellow for anaemia, warnings only for stale data.

## Week ranges

- A range runs from `from` (included) to `to` (excluded): `{ from: 14, to: 28 }` means weeks 14+0 to 27+6.
- **Threshold rules check the week on the date of the reading**, not today's week. A lab value is read against the norm of the week it was taken in, so a re-check later in pregnancy never changes the meaning of an old reading (haemoglobin of 107 g/L taken at 27 weeks stays normal at a re-check at 29 weeks). The week of the reading is shown with the reason.
- **Data-quality rules check today's week**, because the visit schedule asks what is due now.
- **Unknown week** (no estimated due date): a rule with a week range does not apply. Each family has a `{ unknown: true }` rule with the stricter value instead (110 g/L for anaemia, 35 days for blood pressure), so a missing due date never hides a finding. `DEMO-DQ-DUE-DATE-MISSING` reports the missing date as before.
- **Trimesters:** the first ends at 13+6 weeks ([N1] p. 16: first-trimester ultrasound "up to 13 6/7 weeks inclusive"). The second ends at 27+6 weeks: the protocol does not state this boundary, the domain pack chose 28 weeks (team decision, the usual convention); [N1] p. 13 counts the visit at 24 (26) weeks in the second trimester and the visit at 30 weeks in the third, which fits.
- **Grace for stale data:** each stale-data limit is the longest planned gap between visits ([N1] p. 14) plus 7 days. The 7 days are the domain pack's choice, so that a patient who follows the schedule is never flagged (its tests check this).

## Risk groups (badges, not zones)

The patient card also shows risk groups from the anamnesis: the five scales of [N1], ported from [D] (`data-pack/risk-scales.ts`) to `backend/src/risk-engine/risk-groups.ts`. They are a profile, not rules: they never set or change a zone, and the engine does not read them. They are ILLUSTRATIVE like the rules and need the same clinician review. Each group carries its pages in `source.citations`, shown under the badge. They need the number of previous births (`riskFactors.parity`) and the age; without either the card says they are not assessed. A recorded previous caesarean counts as a uterine scar.

| Scale                           | Raised when                                                                                                                                                                                                                            | Protocol action (shown on the card)                                                                                    | Source                 |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Pre-eclampsia (HIGH)            | 1 high factor (hypertension in a previous pregnancy, chronic hypertension, kidney disease, diabetes, autoimmune) or 2 moderate (first birth, age ≥ 40, BMI ≥ 35, pre-eclampsia in the family, interval > 10 years, multiple pregnancy) | aspirin 150 mg in the evening from 11–14+6 to 36 weeks; daily blood-pressure self-checks; urine protein at every visit | [N1] pp. 33–34, 54     |
| Gestational diabetes (HIGH)     | any factor: BMI > 30, age ≥ 40, previous GDM, diabetes in relatives, baby ≥ 4500 g, polyhydramnios, stillbirth, child with a malformation, unexplained neonatal death                                                                  | 75 g OGTT at the first visit and at 26–28 weeks                                                                        | [N1] pp. 20–21, 30, 53 |
| Thromboembolism                 | points: 1–2 MODERATE, ≥ 3 HIGH (age > 35, BMI > 30 and 3+ births 1 point each; flags 1–3 points)                                                                                                                                       | MODERATE: compression stockings; HIGH: also low-molecular-weight heparin through a haematologist; reassess every visit | [N1] pp. 37–38         |
| Postpartum haemorrhage (HIGH)   | any factor: 4+ births, haemoglobin < 90 g/L, uterine scar, previous haemorrhage, pre-eclampsia, praevia and others                                                                                                                     | treat anaemia; deliver at a level 2–3 facility; planned admission for placenta praevia                                 | [N1] pp. 38–39         |
| Fetal growth restriction (HIGH) | 1 major factor (age > 40, ≥ 11 cigarettes a day, chronic hypertension and others) or 3 minor (age > 35, first birth, BMI < 20 or 25–35 and others)                                                                                     | major: growth scans with Doppler every 3 weeks from 26–28 weeks; 3 minor: growth scan at 20–24 weeks                   | [N1] pp. 40, 55        |

`backend/test/risk-groups.test.ts` runs the port on the 25 synthetic patients of [D] (`data-pack/synthetic-seed.json`) and gets every level [D] expects. Differences from [D]: a LOW scale lists no actions, and the placenta-praevia admission is listed only when praevia is recorded.

## National sources (primary)

Both PDFs are in `data-pack/`, next to the domain lane's research pack (`data-pack/README.md`, `data-pack/RULES_PROVENANCE.md`). Page numbers below are the printed page numbers.

- **[N1]** Национальный клинический протокол «Антенатальный уход. Ведение беременных групп риска». Ministry of Health of the Republic of Uzbekistan; Republican Specialized Scientific and Practical Medical Center of Maternal and Child Health; appendix 2 to order No. 180 of 23 June 2025; Tashkent, 2025. 62 pages.
  - p. 34: hypertension in pregnancy from systolic 140 and/or diastolic 90 mmHg; non-severe 140–159 / 90–109 mmHg; severe from 160 / 110 mmHg. Proteinuria is checked at every antenatal visit for women at high risk of pre-eclampsia.
  - p. 36: severe pre-eclampsia is defined with proteinuria of 0.3 g/L, the single-sample unit our measurements use.
  - p. 31: venous glucose 5.1–6.9 mmol/L means gestational diabetes; from 7.0 mmol/L, manifest diabetes. p. 20 gives a different early-screening value (normal fasting glucose below 5.6 mmol/L); the mentor should say which applies when.
  - p. 28: anaemia is diagnosed below 110 g/L in the first and third trimesters and below 105 g/L in the second.
  - p. 20: a blood count at the first visit and at 26 weeks. The same page calls haemoglobin ≥ 105 g/L normal in the third trimester (see ⚠ above).
  - p. 17: blood pressure is measured at every visit.
  - p. 16: the first trimester lasts up to 13 6/7 weeks.
  - pp. 13–14: eight antenatal visits at up to 12, 18–20, 26, 30, 34, 36, 38 and 40 weeks. The text on p. 13 says 24 weeks for the third visit while the table on p. 14 says 26 (the domain pack took 26).
  - p. 39: "uterine scar after caesarean section or myomectomy" is listed among risk factors (the same list includes haemoglobin below 90 g/L).
- **[N2]** Национальный клинический протокол «Ведение беременных с железодефицитной анемией». Same ministry, centre and order (No. 180 of 23 June 2025); Tashkent, 2025. 29 pages.
  - p. 12: anaemia in pregnancy when haemoglobin is below 110 g/L.
  - p. 13: haemoglobin norms of 110 g/L in the first and third trimesters and 105 g/L in the second; following WHO, mild anaemia 110–90 g/L, moderate 89–70 g/L, severe below 70 g/L.

## Domain pack

- **[D]** `data-pack/RULES_PROVENANCE.md` and `data-pack/demo-rules.ts`, prepared by the domain lane on 17 Nov 2026 from [N1] and [N2]. Its rule ids are given in the table where a `DEMO-` rule takes its values from it. The pack stays as delivered; the rules that are not adopted yet are listed below.

## WHO sources (secondary)

- **[S1]** WHO recommendations on drug treatment for non-severe hypertension in pregnancy, 2020. <https://www.who.int/publications/i/item/9789240008793>. Non-severe 140–159 / 90–109 mmHg; severe from 160 / 110 mmHg.
- **[S2]** WHO recommendations for prevention and treatment of pre-eclampsia and eclampsia, 2011. Proteinuria from 300 mg per 24 hours. The WHO definition of pre-eclampsia requires onset after 20 weeks; `DEMO-PE-PATTERN` does not check the week, so it errs on the side of flagging.
- **[S3]** WHO, Haemoglobin concentrations for the diagnosis of anaemia and assessment of severity (WHO/NMH/NHD/MNM/11.1), 2011; WHO NLiS: <https://www.who.int/data/nutrition/nlis/info/anaemia>. Pregnant women: anaemia below 110 g/L, severe below 70 g/L. Not applied: altitude and smoking adjustments. The national trimester norms ([N1] p. 28) are applied; the 2024 WHO guideline uses the same 105 g/L in the second trimester.
- **[S4]** WHO, Diagnostic criteria and classification of hyperglycaemia first detected in pregnancy (WHO/NMH/MND/13.2), 2013. <https://www.who.int/publications/i/item/WHO-NMH-MND-13.2>. Fasting plasma glucose 5.1–6.9 mmol/L gestational diabetes; from 7.0 mmol/L diabetes in pregnancy.
- **[S5]** WHO recommendations on antenatal care for a positive pregnancy experience, 2016. Eight contacts; [N1] adopts the same model.

## Candidates found in [N1] and [D], not implemented

- Age 40 or older as a pre-eclampsia risk factor (pp. 33, 53–54); age over 35 in the thromboembolism risk score (p. 37).
- Haemoglobin below 90 g/L in the risk-factor list on p. 39, moderate anaemia ([D] `HB-MOD`, `HB-MOD-LATE`) and very severe anaemia below 50 g/L ([D] `HB-VSEV`): they would split today's single Yellow anaemia band.
- Proteinuria at every visit for women at high risk of pre-eclampsia (p. 34): a data-quality rule could warn when it is missing.
- Glucose by sample type (fasting, 1 h and 2 h OGTT, random), HbA1c and the missing 26–28-week OGTT ([D] `GLU-*`, `HBA1C-DM`, `MISS-OGTT`): they need a glucose `context` in the contracts.
- Separate systolic and diastolic rules ([D] `BP-SEV-SYS`, `BP-SEV-DIA`, `BP-HTN-*`, `PE-BP-PROT`, `PE-BPD-PROT`): same cut-offs as today's combined rules, so they would change ids but not zones.
- No response to iron in 14 days, haemoglobin drop and blood pressure rise ([D] `TR-*`): need new rule types; two have no protocol source.

## Known limits of the demo rules

- Combined rules read each indicator's latest value, however far apart the readings are. Stale readings are flagged separately by `DEMO-DQ-BP-STALE-*` and `DEMO-DQ-HB-STALE`.
- Trends only report; they never change a zone until a clinician defines which change is concerning.
- Data-quality rules only warn. A patient with key data missing can be Green, and the UI must show it as "Green, incomplete data".
- Glucose readings are treated as fasting venous values.
- The early stale-pressure limit (105 days before week 28) is generous: it covers the gap between a first visit at 6 weeks and the 18–20-week visit, so a missed 18–20-week visit shows only once the 105 days are up.

## For the domain mentor

The values now have national sources. What still needs a clinician: the zone each rule gives (in particular Yellow for risk factors and for glucose of 7.0 mmol/L or more), the third-trimester anaemia threshold (110 g/L on p. 28 against 105 g/L on p. 20), the 28-week boundary between the second and third trimesters, the 7 days of grace in the stale-data limits, the early-screening glucose value (p. 20 against p. 31), whether pre-eclampsia should require 20+ weeks, and the units of district lab forms. Record each answer here (source, page, reviewer name, date), then move confirmed rules into `validated-rules.ts` with status VALIDATED.
