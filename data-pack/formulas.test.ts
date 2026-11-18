import { test } from "node:test";
import assert from "node:assert/strict";
import {
  anemiaGradeNational,
  anemiaGradeWho2024,
  bmi,
  bmiCategory,
  eddFromLmp,
  epdsScore,
  gestationalAge,
  meanArterialPressure,
  missedAncVisits,
  nextAncVisit,
  sfhCentilesCm,
  trimester,
  weightGainTargetKg,
} from "./formulas.ts";
import { fgrRisk, pphRisk, preeclampsiaRisk, vteRisk } from "./risk-scales.ts";
import type { RiskFlag } from "./risk-scales.ts";
import { DEMO_RULES } from "./demo-rules.ts";
import { assessVisit, staleWarnings } from "./reference-assess.ts";
import type { DatedValue } from "./reference-assess.ts";
import { readFileSync } from "node:fs";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const profile = (o: { age: number; bmi?: number; parity?: number; hb?: number; flags?: RiskFlag[] }) => ({
  ageYears: o.age,
  bmi: o.bmi,
  parity: o.parity ?? 1,
  latestHbGL: o.hb,
  flags: new Set(o.flags ?? []),
});

test("due date is LMP + 280 days and GA is derived from it", () => {
  assert.equal(eddFromLmp(d("2026-04-15")).toISOString().slice(0, 10), "2027-01-20");
  const ga = gestationalAge(d("2027-01-20"), d("2026-11-18"));
  assert.deepEqual([ga.weeks, ga.days], [31, 0]);
});

test("trimester boundaries at 14 and 28 weeks", () => {
  assert.deepEqual([13.9, 14, 27.9, 28].map(trimester), [1, 2, 2, 3]);
});

test("MAP, BMI and weight gain targets", () => {
  assert.equal(meanArterialPressure(120, 80).toFixed(2), "93.33");
  assert.equal(bmiCategory(bmi(70, 165)), "OVERWEIGHT");
  assert.deepEqual(weightGainTargetKg(17.9), [12.5, 18]);
  assert.deepEqual(weightGainTargetKg(30), [5, 9]);
});

test("national anaemia grades are trimester-aware and gap-free", () => {
  assert.equal(anemiaGradeNational(104, 2), "MILD");
  assert.equal(anemiaGradeNational(106, 2), "NONE");
  assert.equal(anemiaGradeNational(106, 3), "MILD");
  assert.equal(anemiaGradeNational(89.5, 1), "MODERATE");
  assert.equal(anemiaGradeNational(69, 3), "SEVERE");
  assert.equal(anemiaGradeNational(49, 3), "VERY_SEVERE");
});

test("WHO 2024 anaemia grades differ from national ones", () => {
  assert.equal(anemiaGradeWho2024(96, 2), "MILD");
  assert.equal(anemiaGradeWho2024(94, 2), "MODERATE");
  assert.equal(anemiaGradeWho2024(95, 3), "MODERATE");
  assert.equal(anemiaGradeNational(95, 3), "MILD");
});

test("INTERGROWTH-21st SFH equation reproduces published Table 2 within 0.5 cm", () => {
  const table: Record<number, [number, number, number]> = {
    16: [13.0, 16.0, 18.5],
    20: [17.0, 20.0, 22.5],
    24: [20.5, 24.0, 27.0],
    28: [24.5, 27.5, 31.0],
    32: [28.0, 31.5, 35.0],
    36: [31.5, 35.0, 38.5],
    40: [34.0, 38.0, 42.0],
  };
  for (const [ga, [p3, p50, p97]] of Object.entries(table)) {
    const c = sfhCentilesCm(Number(ga));
    for (const [got, want] of [[c.p3, p3], [c.p50, p50], [c.p97, p97]]) {
      assert.ok(Math.abs(got - want) <= 0.5, `GA ${ga}: ${got.toFixed(2)} vs ${want}`);
    }
  }
  assert.throws(() => sfhCentilesCm(12), RangeError);
});

test("ANC schedule: next and missed visits", () => {
  assert.equal(nextAncVisit(22)?.visit, 3);
  assert.equal(nextAncVisit(41), null);
  assert.deepEqual(missedAncVisits(31, [10, 19]).map((v) => v.visit), [3]);
});

test("EPDS bands", () => {
  assert.deepEqual(epdsScore([0, 0, 1, 1, 0, 1, 0, 0, 0, 0]), { score: 3, band: "LOW", referToSpecialist: false });
  assert.equal(epdsScore([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]).referToSpecialist, true);
  assert.equal(epdsScore([2, 2, 1, 1, 1, 1, 1, 1, 1, 1]).band, "HIGH");
});

test("pre-eclampsia risk: one high or two moderate factors", () => {
  assert.equal(preeclampsiaRisk(profile({ age: 25, flags: ["CHRONIC_HYPERTENSION"] })).level, "HIGH");
  assert.equal(preeclampsiaRisk(profile({ age: 41, parity: 0 })).level, "HIGH");
  assert.equal(preeclampsiaRisk(profile({ age: 25, parity: 0 })).level, "LOW");
});

test("VTE score uses protocol points and counts pre-eclampsia once", () => {
  const r = vteRisk(profile({ age: 37, bmi: 31, flags: ["SMOKING"] }));
  assert.deepEqual([r.score, r.level], [3, "HIGH"]);
  const pe = vteRisk(profile({ age: 25, flags: ["PREECLAMPSIA_MODERATE", "PREECLAMPSIA_EARLY_OR_SEVERE"] }));
  assert.equal(pe.score, 2);
  assert.equal(vteRisk(profile({ age: 25 })).level, "LOW");
});

test("FGR risk: one major or three minor factors", () => {
  assert.equal(fgrRisk(profile({ age: 42 })).level, "HIGH");
  assert.equal(fgrRisk(profile({ age: 37, parity: 0, bmi: 27 })).level, "HIGH");
  assert.equal(fgrRisk(profile({ age: 37, parity: 0, bmi: 22 })).level, "LOW");
});

test("PPH risk includes Hb <90 and a uterine scar", () => {
  assert.equal(pphRisk(profile({ age: 25, hb: 85 })).level, "HIGH");
  assert.equal(pphRisk(profile({ age: 25, flags: ["UTERINE_SCAR"] })).level, "HIGH");
  assert.equal(pphRisk(profile({ age: 25, hb: 112 })).level, "LOW");
});

test("demo rules: unique ids, all illustrative, only BP/Hb trend rules lack a source", () => {
  const ids = DEMO_RULES.rules.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(DEMO_RULES.rules.every((r) => r.source.status === "ILLUSTRATIVE"));
  assert.deepEqual(
    DEMO_RULES.rules.filter((r) => r.source.ref === null).map((r) => r.id),
    ["TR-HB-DROP", "TR-BP-RISE"],
  );
});

test("missing-data rules fire only for the stale and no-data seed patients", () => {
  const seed = JSON.parse(readFileSync(new URL("./synthetic-seed.json", import.meta.url), "utf8"));
  const now = new Date(`${seed.referenceDate}T12:00:00+05:00`);
  const flagged: string[] = [];
  for (const p of seed.patients) {
    const history: DatedValue[] = p.visits.flatMap((v: { measuredAt: string; measurements: Array<Record<string, unknown>> }) =>
      v.measurements.map((m) => ({
        measure: m.type === "BLOOD_PRESSURE" ? "BLOOD_PRESSURE.systolic" : m.type === "GLUCOSE" ? `GLUCOSE.${m.context}` : `${m.type}.value`,
        value: Number(m.value ?? m.systolic),
        measuredAt: new Date(v.measuredAt),
      })),
    );
    const ga = gestationalAge(new Date(`${p.estimatedDueDate}T00:00:00Z`), now).decimalWeeks;
    if (staleWarnings(history, ga, now, DEMO_RULES).length > 0) flagged.push(p.externalReference);
  }
  const expected = seed.patients.filter((p: { scenario: string }) => ["STALE", "NO_DATA"].includes(p.scenario)).map((p: { externalReference: string }) => p.externalReference);
  assert.deepEqual(flagged, expected);
});

test("reference assessment picks the highest zone", () => {
  const normal = assessVisit({ "BLOOD_PRESSURE.systolic": 118, "BLOOD_PRESSURE.diastolic": 76, "HEMOGLOBIN.value": 112 }, 30, DEMO_RULES);
  assert.equal(normal.zone, "GREEN");
  assert.equal(assessVisit({ "HEMOGLOBIN.value": 107 }, 20, DEMO_RULES).zone, "GREEN");
  assert.equal(assessVisit({ "HEMOGLOBIN.value": 107 }, 30, DEMO_RULES).zone, "YELLOW");
  assert.equal(assessVisit({ "HEMOGLOBIN.value": 86 }, 35, DEMO_RULES).zone, "RED");
  assert.equal(assessVisit({ "BLOOD_PRESSURE.systolic": 146, "BLOOD_PRESSURE.diastolic": 92 }, 30, DEMO_RULES).zone, "YELLOW");
  const pe = assessVisit({ "BLOOD_PRESSURE.systolic": 146, "BLOOD_PRESSURE.diastolic": 94, "PROTEINURIA.value": 0.5 }, 33, DEMO_RULES);
  assert.equal(pe.zone, "RED");
  assert.ok(pe.triggered.some((t) => t.id === "PE-BP-PROT"));
  assert.equal(assessVisit({ "GLUCOSE.FASTING": 5.4 }, 12, DEMO_RULES).zone, "YELLOW");
  assert.equal(assessVisit({ "GLUCOSE.FASTING": 7.2 }, 12, DEMO_RULES).zone, "RED");
});
