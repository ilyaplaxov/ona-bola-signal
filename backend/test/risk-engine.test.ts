import { readFileSync } from "node:fs";
import { AssessmentResult, RuleSetInfo, type MeasurementReading } from "@ona-bola/shared";
import { describe, expect, it } from "vitest";
import { ageInYears, gestationalWeek } from "../src/domain/pregnancy";
import {
  assess,
  DEMO_RULE_SET,
  toRuleSetInfo,
  validateRuleSet,
  type EngineInput,
  type RuleSet,
} from "../src/risk-engine";

const NOW = new Date("2026-11-18T06:00:00Z");
const PATIENT_ID = "3f0c2a4e-8b1d-4c6a-9e2f-1a2b3c4d5e6f";
const DAY = 86_400_000;

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY).toISOString();
/** Estimated due date that puts the patient at exactly `week` + 0 days on NOW. */
const dueForWeek = (week: number) =>
  new Date(NOW.getTime() + (280 - week * 7) * DAY).toISOString().slice(0, 10);
const bp = (systolic: number, diastolic: number): MeasurementReading => ({
  type: "BLOOD_PRESSURE",
  systolic,
  diastolic,
  unit: "mmHg",
});
const hb = (value: number): MeasurementReading => ({ type: "HEMOGLOBIN", value, unit: "g/L" });
const protein = (value: number): MeasurementReading => ({
  type: "PROTEINURIA",
  value,
  unit: "g/L",
});
const glucose = (value: number): MeasurementReading => ({ type: "GLUCOSE", value, unit: "mmol/L" });

let counter = 0;
const m = (reading: MeasurementReading, days: number) => ({
  id: id(++counter),
  measuredAt: daysAgo(days),
  reading,
});

/** A complete, unremarkable patient: every rule input present, nothing raised. */
function patient(measurements: EngineInput["measurements"], overrides: Partial<EngineInput> = {}) {
  return {
    patientId: PATIENT_ID,
    dateOfBirth: "1996-04-12",
    estimatedDueDate: "2027-01-20",
    riskFactors: { previousCesarean: false, gestationalDiabetes: false },
    measurements,
    ...overrides,
  } satisfies EngineInput;
}

const normalVisit = (days: number) => [
  m(bp(116, 74), days),
  m(hb(121), days),
  m(protein(0), days),
  m(glucose(4.6), days),
];

const ruleIds = (result: AssessmentResult) => result.reasons.map((r) => r.ruleId);
const warningCodes = (result: AssessmentResult) =>
  result.dataWarnings.map((w) => `${w.code}:${w.measure}`);

describe("zones (brief checklist: green, yellow, red)", () => {
  it("gives GREEN with no reasons and no warnings for a complete, normal record", () => {
    const result = assess(patient(normalVisit(5)), DEMO_RULE_SET, NOW);
    expect(result.zone).toBe("GREEN");
    expect(result.reasons).toEqual([]);
    expect(result.dataWarnings).toEqual([]);
    expect(result.ruleSetVersion).toBe("demo-0.2");
    expect(result.ruleSetKind).toBe("ILLUSTRATIVE");
  });

  it("gives YELLOW for blood pressure in the hypertension range, with the values as evidence", () => {
    const input = patient([...normalVisit(20), m(bp(144, 92), 2)]);
    const result = assess(input, DEMO_RULE_SET, NOW);
    expect(result.zone).toBe("YELLOW");
    expect(ruleIds(result)).toEqual(["DEMO-BP-HIGH"]);
    const reason = result.reasons[0];
    expect(reason?.text).toContain("systolic pressure: 144 mmHg");
    expect(reason?.observed.map((o) => o.value)).toEqual([144, 92]);
    expect(reason?.measurementIds).toHaveLength(1);
  });

  it("gives RED for the pre-eclampsia pattern and lists every rule that fired", () => {
    const input = patient([...normalVisit(20), m(bp(146, 94), 1), m(protein(0.6), 1)]);
    const result = assess(input, DEMO_RULE_SET, NOW);
    expect(result.zone).toBe("RED");
    expect(ruleIds(result)).toEqual(["DEMO-BP-HIGH", "DEMO-PE-PATTERN", "DEMO-PROTEINURIA"]);
    expect(result.triggeredRuleIds).toEqual(ruleIds(result));
  });

  it("gives RED for severe hypertension without also listing the non-severe rule", () => {
    const result = assess(patient([...normalVisit(20), m(bp(164, 112), 1)]), DEMO_RULE_SET, NOW);
    expect(result.zone).toBe("RED");
    expect(ruleIds(result)).toEqual(["DEMO-BP-SEVERE"]);
  });

  it("separates anaemia from severe anaemia", () => {
    const low = assess(patient([...normalVisit(20), m(hb(104), 1)]), DEMO_RULE_SET, NOW);
    expect(low.zone).toBe("YELLOW");
    expect(ruleIds(low)).toEqual(["DEMO-HB-LOW-T3"]);
    const severe = assess(patient([...normalVisit(20), m(hb(66), 1)]), DEMO_RULE_SET, NOW);
    expect(severe.zone).toBe("RED");
    expect(ruleIds(severe)).toEqual(["DEMO-HB-SEVERE"]);
  });

  it("raises YELLOW for a recorded risk factor even with normal values", () => {
    const input = patient(normalVisit(5), {
      riskFactors: { previousCesarean: true, gestationalDiabetes: false },
    });
    const result = assess(input, DEMO_RULE_SET, NOW);
    expect(result.zone).toBe("YELLOW");
    expect(ruleIds(result)).toEqual(["DEMO-RF-CESAREAN"]);
    expect(result.reasons[0]?.observed[0]).toMatchObject({ value: true, unit: null });
  });
});

describe("missing, invalid and out-of-order data", () => {
  it("reports missing data as warnings and never fires a rule on it", () => {
    const input = patient([m(bp(118, 76), 3)], { estimatedDueDate: null, riskFactors: {} });
    const result = assess(input, DEMO_RULE_SET, NOW);
    expect(result.zone).toBe("GREEN");
    expect(result.reasons).toEqual([]);
    expect(warningCodes(result)).toEqual([
      "MISSING:HEMOGLOBIN",
      "MISSING:PROTEINURIA",
      "MISSING:PATIENT.gestationalWeek",
      "MISSING:RISK_FACTOR.previousCesarean",
      "MISSING:RISK_FACTOR.gestationalDiabetes",
    ]);
  });

  it("ignores a reading with the wrong unit and says so", () => {
    const wrongUnit = {
      type: "HEMOGLOBIN",
      value: 9.1,
      unit: "g/dL",
    } as unknown as MeasurementReading;
    const input = patient([...normalVisit(20), m(wrongUnit, 1)]);
    const result = assess(input, DEMO_RULE_SET, NOW);
    expect(result.zone).toBe("GREEN");
    expect(result.dataWarnings).toEqual([
      expect.objectContaining({ code: "IMPLAUSIBLE", measure: "HEMOGLOBIN", ruleId: null }),
    ]);
  });

  it("ignores a reading dated in the future", () => {
    const future = { id: id(++counter), measuredAt: daysAgo(-3), reading: bp(170, 115) };
    const result = assess(patient([...normalVisit(5), future]), DEMO_RULE_SET, NOW);
    expect(result.zone).toBe("GREEN");
    expect(warningCodes(result)).toEqual(["IMPLAUSIBLE:BLOOD_PRESSURE.systolic"]);
  });

  it("uses the latest reading by measured time, not by array order", () => {
    const newerNormal = m(bp(118, 76), 2);
    const olderHigh = m(bp(150, 96), 30);
    const rest = [m(hb(120), 2), m(protein(0), 2), m(glucose(4.5), 2)];
    const calm = assess(patient([newerNormal, olderHigh, ...rest]), DEMO_RULE_SET, NOW);
    expect(calm.zone).toBe("GREEN");

    const newerHigh = m(bp(150, 96), 2);
    const olderNormal = m(bp(118, 76), 30);
    const raised = assess(patient([newerHigh, olderNormal, ...rest]), DEMO_RULE_SET, NOW);
    expect(raised.zone).toBe("YELLOW");
  });

  it("warns when the latest blood pressure is older than the visit schedule allows", () => {
    const input = patient([m(bp(118, 76), 70), m(hb(120), 70), m(protein(0), 70)]);
    const result = assess(input, DEMO_RULE_SET, NOW);
    expect(warningCodes(result)).toEqual(["STALE:BLOOD_PRESSURE.systolic"]);
    expect(result.dataWarnings[0]?.ruleId).toBe("DEMO-DQ-BP-STALE-LATE");
    expect(result.dataWarnings[0]?.text).toContain("70 days ago");
  });
});

describe("haemoglobin by trimester (antenatal protocol, p. 28)", () => {
  /** Complete record at `week` today, with one haemoglobin reading taken `days` ago. */
  const withHb = (week: number | null, value: number, days = 1) =>
    patient([m(bp(116, 74), 5), m(protein(0), 5), m(glucose(4.6), 5), m(hb(value), days)], {
      estimatedDueDate: week === null ? null : dueForWeek(week),
    });

  it("reads the same 107 g/L as normal in the second trimester and anaemia in the third", () => {
    expect(assess(withHb(22, 107), DEMO_RULE_SET, NOW).zone).toBe("GREEN");
    const third = assess(withHb(30, 107), DEMO_RULE_SET, NOW);
    expect(third.zone).toBe("YELLOW");
    expect(ruleIds(third)).toEqual(["DEMO-HB-LOW-T3"]);
  });

  it("uses 110 g/L before week 14 and 105 g/L in weeks 14 to 27", () => {
    expect(ruleIds(assess(withHb(10, 107), DEMO_RULE_SET, NOW))).toEqual(["DEMO-HB-LOW-T1"]);
    expect(ruleIds(assess(withHb(20, 104), DEMO_RULE_SET, NOW))).toEqual(["DEMO-HB-LOW-T2"]);
    expect(ruleIds(assess(withHb(20, 105), DEMO_RULE_SET, NOW))).toEqual([]);
  });

  it("switches threshold exactly at 14+0 and 28+0 weeks", () => {
    expect(ruleIds(assess(withHb(14, 107, 1), DEMO_RULE_SET, NOW))).toEqual(["DEMO-HB-LOW-T1"]);
    expect(ruleIds(assess(withHb(14, 107, 0), DEMO_RULE_SET, NOW))).toEqual([]);
    expect(ruleIds(assess(withHb(28, 107, 1), DEMO_RULE_SET, NOW))).toEqual([]);
    expect(ruleIds(assess(withHb(28, 107, 0), DEMO_RULE_SET, NOW))).toEqual(["DEMO-HB-LOW-T3"]);
  });

  it("judges a reading by the week it was taken in and shows that week as evidence", () => {
    // 107 g/L taken at 27+6 weeks stays normal when the patient is re-checked at 31 weeks.
    expect(assess(withHb(31, 107, 22), DEMO_RULE_SET, NOW).zone).toBe("GREEN");

    // 104 g/L taken at 13+0 weeks is first-trimester anaemia, although today she is at 16 weeks.
    const early = assess(withHb(16, 104, 21), DEMO_RULE_SET, NOW);
    expect(ruleIds(early)).toEqual(["DEMO-HB-LOW-T1"]);
    expect(early.reasons[0]?.observed).toEqual([
      expect.objectContaining({ measure: "HEMOGLOBIN", value: 104, unit: "g/L" }),
      expect.objectContaining({
        measure: "PATIENT.gestationalWeek",
        value: 13,
        unit: "weeks",
        measuredAt: daysAgo(21),
      }),
    ]);
    expect(early.reasons[0]?.text).toContain("gestational week: 13 weeks");
    expect(early.reasons[0]?.measurementIds).toHaveLength(1);
  });

  it("applies the stricter 110 g/L while the week of pregnancy is unknown", () => {
    const result = assess(withHb(null, 107), DEMO_RULE_SET, NOW);
    expect(ruleIds(result)).toEqual(["DEMO-HB-LOW-NO-WEEK"]);
    expect(warningCodes(result)).toEqual(["MISSING:PATIENT.gestationalWeek"]);
    expect(ruleIds(assess(withHb(null, 66), DEMO_RULE_SET, NOW))).toEqual(["DEMO-HB-SEVERE"]);
  });
});

describe("stale data follows the antenatal visit schedule (protocol, pp. 14, 17, 20)", () => {
  /** Complete record at `week` today; pressure and haemoglobin taken the given number of days ago. */
  const record = (week: number | null, bpDays: number, hbDays = 5) =>
    patient([m(bp(116, 74), bpDays), m(hb(121), hbDays), m(protein(0), 5), m(glucose(4.6), 5)], {
      estimatedDueDate: week === null ? null : dueForWeek(week),
    });
  const stale = (input: EngineInput) =>
    assess(input, DEMO_RULE_SET, NOW)
      .dataWarnings.filter((w) => w.code === "STALE")
      .map((w) => w.ruleId);

  it("allows up to 105 days without blood pressure before 28 weeks", () => {
    expect(stale(record(24, 105))).toEqual([]);
    expect(stale(record(24, 106))).toEqual(["DEMO-DQ-BP-STALE-EARLY"]);
  });

  it("allows 35 days from 28 weeks, and while the week is unknown", () => {
    expect(stale(record(30, 35))).toEqual([]);
    expect(stale(record(30, 36))).toEqual(["DEMO-DQ-BP-STALE-LATE"]);
    expect(stale(record(null, 36))).toEqual(["DEMO-DQ-BP-STALE-NO-WEEK"]);
  });

  it("flags a missed 26-week blood count from 28 weeks only", () => {
    expect(stale(record(32, 5, 113))).toEqual(["DEMO-DQ-HB-STALE"]);
    expect(stale(record(32, 5, 112))).toEqual([]);
    expect(stale(record(27, 5, 113))).toEqual([]);
  });
});

describe("trends", () => {
  it("reports insufficient history with fewer readings than the window", () => {
    const result = assess(patient([...normalVisit(30), m(bp(124, 80), 2)]), DEMO_RULE_SET, NOW);
    expect(result.trendFindings.find((f) => f.ruleId === "DEMO-TREND-SYSTOLIC")).toMatchObject({
      status: "INSUFFICIENT_HISTORY",
    });
  });

  it("reports a rising systolic trend without changing the zone (demo trends are report-only)", () => {
    const input = patient([...normalVisit(60), m(bp(121, 78), 30), m(bp(128, 82), 2)]);
    const result = assess(input, DEMO_RULE_SET, NOW);
    const finding = result.trendFindings.find((f) => f.ruleId === "DEMO-TREND-SYSTOLIC");
    expect(finding?.status).toBe("TRIGGERED");
    expect(finding?.text).toContain("116 → 121 → 128 mmHg");
    expect(result.zone).toBe("GREEN");
  });

  it("can raise the zone when a rule set gives the trend a zone and a minimum change", () => {
    const escalating = (minChange: number): RuleSet => ({
      id: "test",
      version: "test-1",
      kind: "ILLUSTRATIVE",
      rules: [
        {
          id: "DEMO-TEST-TREND",
          kind: "TREND",
          zone: "YELLOW",
          measure: "HEMOGLOBIN",
          direction: "FALLING",
          minReadings: 3,
          minChange,
          reason: "Haemoglobin is falling",
          source: { status: "ILLUSTRATIVE", ref: null },
        },
      ],
    });
    const input = patient([m(hb(124), 60), m(hb(118), 30), m(hb(112), 2)]);
    const fires = assess(input, escalating(10), NOW);
    expect(fires.zone).toBe("YELLOW");
    expect(fires.reasons[0]?.measurementIds).toHaveLength(3);
    expect(assess(input, escalating(20), NOW).zone).toBe("GREEN");
  });
});

describe("determinism and explanation", () => {
  const input = patient([...normalVisit(40), m(bp(146, 94), 1), m(protein(0.6), 1)]);

  it("gives an identical result and hash for the same input, rule set and time", () => {
    const first = assess(input, DEMO_RULE_SET, NOW);
    const second = assess(structuredClone(input), DEMO_RULE_SET, NOW);
    expect(second).toEqual(first);
  });

  it("does not depend on the order of the input measurements", () => {
    const shuffled = { ...input, measurements: [...input.measurements].reverse() };
    expect(assess(shuffled, DEMO_RULE_SET, NOW)).toEqual(assess(input, DEMO_RULE_SET, NOW));
  });

  it("changes the hash when any value changes", () => {
    const changed = structuredClone(input);
    const last = changed.measurements[changed.measurements.length - 1];
    if (last?.reading.type === "PROTEINURIA") last.reading.value = 0.7;
    expect(assess(changed, DEMO_RULE_SET, NOW).inputHash).not.toBe(
      assess(input, DEMO_RULE_SET, NOW).inputHash,
    );
  });

  it("always returns the rule-set version and a reason for every non-GREEN zone", () => {
    const result = assess(input, DEMO_RULE_SET, NOW);
    expect(AssessmentResult.safeParse(result).success).toBe(true);
    expect(result.ruleSetVersion).toBeTruthy();
    expect(result.reasons.length).toBeGreaterThan(0);
  });
});

describe("demo rule set", () => {
  it("passes the structural checks", () => {
    expect(validateRuleSet(DEMO_RULE_SET)).toEqual([]);
  });

  it("has a provenance row for every rule in docs/RULES_PROVENANCE.md", () => {
    const doc = readFileSync(new URL("../../docs/RULES_PROVENANCE.md", import.meta.url), "utf8");
    const missing = DEMO_RULE_SET.rules
      .map((r) => r.id)
      .filter((ruleId) => !doc.includes(`\`${ruleId}\``));
    expect(missing).toEqual([]);
  });

  it("has Uzbek and English labels for every rule in frontend/src/i18n/strings.ts", () => {
    const strings = readFileSync(
      new URL("../../frontend/src/i18n/strings.ts", import.meta.url),
      "utf8",
    );
    const missing = DEMO_RULE_SET.rules
      .map((r) => r.id)
      .filter((ruleId) => !strings.includes(`"${ruleId}": {`));
    expect(missing).toEqual([]);
  });

  it("cites page numbers for every rule that quotes a national protocol, matching its reference", () => {
    for (const rule of DEMO_RULE_SET.rules) {
      const ref = rule.source.ref ?? "";
      if (ref.startsWith("National clinical protocol")) expect(rule.source.citations).toBeDefined();
      for (const page of (rule.source.citations ?? []).flatMap((c) => c.pages)) {
        expect(ref).toMatch(new RegExp(`pp?\\. [^:]*\\b${page}\\b`));
      }
    }
  });

  it("is served in the shared RuleSetInfo shape with generated descriptions", () => {
    const info = toRuleSetInfo(DEMO_RULE_SET);
    expect(RuleSetInfo.safeParse(info).success).toBe(true);
    const severe = info.rules.find((r) => r.id === "DEMO-BP-SEVERE");
    expect(severe?.description).toBe(
      "Systolic pressure ≥ 160 mmHg or diastolic pressure ≥ 110 mmHg",
    );
    expect(severe?.measures).toEqual(["BLOOD_PRESSURE.systolic", "BLOOD_PRESSURE.diastolic"]);
    expect(severe?.source.citations).toEqual([
      { document: "UZ_ANTENATAL_CARE_2025", pages: ["34"] },
    ]);
    expect(severe?.gestationalWeeks).toBeUndefined();
  });

  it("serves and describes week ranges", () => {
    const rules = new Map(toRuleSetInfo(DEMO_RULE_SET).rules.map((r) => [r.id, r]));
    expect(rules.get("DEMO-HB-LOW-T2")).toMatchObject({
      gestationalWeeks: { from: 14, to: 28 },
      measures: ["HEMOGLOBIN", "PATIENT.gestationalWeek"],
      description:
        "Haemoglobin < 105 g/L and haemoglobin ≥ 70 g/L, for a reading taken in weeks 14–27 of pregnancy",
    });
    expect(rules.get("DEMO-HB-LOW-NO-WEEK")?.description).toBe(
      "Haemoglobin < 110 g/L and haemoglobin ≥ 70 g/L, while the week of pregnancy is unknown",
    );
    expect(rules.get("DEMO-DQ-BP-STALE-LATE")?.description).toBe(
      "Systolic pressure: latest reading older than 35 days, from week 28 of pregnancy; warning only",
    );
  });

  it("rejects a week range that ends before it starts", () => {
    const rule = DEMO_RULE_SET.rules.find((r) => r.id === "DEMO-HB-LOW-T2");
    if (rule?.kind !== "THRESHOLD") throw new Error("DEMO-HB-LOW-T2 is missing");
    const broken: RuleSet = {
      ...DEMO_RULE_SET,
      rules: [{ ...rule, gestationalWeeks: { from: 28, to: 14 } }],
    };
    expect(validateRuleSet(broken)).toEqual([
      "DEMO-HB-LOW-T2: a week range needs whole weeks, at least one end and from < to",
    ]);
  });

  it("rejects duplicate ids and ids without the DEMO- prefix", () => {
    const [first] = DEMO_RULE_SET.rules;
    if (!first) throw new Error("demo rule set is empty");
    const broken: RuleSet = { ...DEMO_RULE_SET, rules: [first, first, { ...first, id: "BP-1" }] };
    expect(validateRuleSet(broken)).toEqual([
      `duplicate rule id ${first.id}`,
      "BP-1: illustrative rule ids start with DEMO-",
    ]);
  });
});

describe("derived patient values", () => {
  it("counts completed weeks back from the estimated due date", () => {
    expect(gestationalWeek("2027-01-20", NOW)).toBe(31);
    expect(gestationalWeek("2026-11-18", NOW)).toBe(40);
    expect(gestationalWeek(null, NOW)).toBeNull();
    expect(gestationalWeek("2027-12-01", NOW)).toBeNull();
  });

  it("counts whole years of age", () => {
    expect(ageInYears("1996-04-12", NOW)).toBe(30);
    expect(ageInYears("1996-12-01", NOW)).toBe(29);
    expect(ageInYears(null, NOW)).toBeNull();
  });
});
