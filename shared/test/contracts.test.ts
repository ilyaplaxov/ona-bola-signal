import { describe, expect, it } from "vitest";
import {
  Alert,
  AssessmentResult,
  endpoints,
  GestationalWeeks,
  MeasurementReading,
  PatientListQuery,
  RiskAssessment,
  RuleSource,
  SubmitMeasurementsRequest,
} from "../src";

const ID = {
  a: "3f0c2a4e-8b1d-4c6a-9e2f-1a2b3c4d5e6f",
  b: "6a1d7c2b-0e3f-4b8a-8c1d-2e3f4a5b6c7d",
  c: "9b2e4f6a-1c3d-4e5f-a6b7-c8d9e0f1a2b3",
};
const NOW = "2026-11-18T09:40:00+05:00";

describe("MeasurementReading", () => {
  it("accepts blood pressure in mmHg", () => {
    const reading = { type: "BLOOD_PRESSURE", systolic: 118, diastolic: 76, unit: "mmHg" };
    expect(MeasurementReading.parse(reading)).toEqual(reading);
  });

  it("rejects a diastolic value that is not lower than the systolic one", () => {
    const result = MeasurementReading.safeParse({
      type: "BLOOD_PRESSURE",
      systolic: 80,
      diastolic: 80,
      unit: "mmHg",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a unit other than the canonical one instead of converting it", () => {
    const result = MeasurementReading.safeParse({ type: "HEMOGLOBIN", value: 11.2, unit: "g/dL" });
    expect(result.success).toBe(false);
  });

  it("accepts a proteinuria result of zero", () => {
    expect(
      MeasurementReading.safeParse({ type: "PROTEINURIA", value: 0, unit: "g/L" }).success,
    ).toBe(true);
  });

  it("rejects non-numeric and non-positive values", () => {
    expect(
      MeasurementReading.safeParse({ type: "GLUCOSE", value: "5.1", unit: "mmol/L" }).success,
    ).toBe(false);
    expect(
      MeasurementReading.safeParse({ type: "HEMOGLOBIN", value: 0, unit: "g/L" }).success,
    ).toBe(false);
  });
});

describe("SubmitMeasurementsRequest", () => {
  const base = { submissionId: ID.a, measuredAt: NOW };

  it("defaults the source to MANUAL", () => {
    const parsed = SubmitMeasurementsRequest.parse({
      ...base,
      measurements: [{ type: "GLUCOSE", value: 4.8, unit: "mmol/L" }],
    });
    expect(parsed.source).toBe("MANUAL");
  });

  it("rejects a visit with two readings of the same type", () => {
    const result = SubmitMeasurementsRequest.safeParse({
      ...base,
      measurements: [
        { type: "GLUCOSE", value: 4.8, unit: "mmol/L" },
        { type: "GLUCOSE", value: 5.0, unit: "mmol/L" },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty visit and a timestamp without an offset", () => {
    expect(SubmitMeasurementsRequest.safeParse({ ...base, measurements: [] }).success).toBe(false);
    expect(
      SubmitMeasurementsRequest.safeParse({
        submissionId: ID.a,
        measuredAt: "2026-11-18 09:40",
        measurements: [{ type: "GLUCOSE", value: 4.8, unit: "mmol/L" }],
      }).success,
    ).toBe(false);
  });
});

describe("assessment invariants", () => {
  const base = {
    patientId: ID.a,
    trendFindings: [],
    dataWarnings: [],
    ruleSetVersion: "demo-0.1",
    ruleSetKind: "ILLUSTRATIVE",
    inputHash: "sha256:test",
    assessedAt: NOW,
  };
  const redReason = {
    ruleId: "DEMO-X-01",
    zone: "RED",
    text: "Example reason",
    measurementIds: [ID.b],
    observed: [{ measure: "BLOOD_PRESSURE.systolic", value: 165, unit: "mmHg", measuredAt: NOW }],
  };

  it("accepts GREEN with no reasons", () => {
    const result = AssessmentResult.safeParse({
      ...base,
      zone: "GREEN",
      triggeredRuleIds: [],
      reasons: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects YELLOW without a reason", () => {
    const result = AssessmentResult.safeParse({
      ...base,
      zone: "YELLOW",
      triggeredRuleIds: [],
      reasons: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a zone lower than its highest reason", () => {
    const result = AssessmentResult.safeParse({
      ...base,
      zone: "YELLOW",
      triggeredRuleIds: ["DEMO-X-01"],
      reasons: [redReason],
    });
    expect(result.success).toBe(false);
  });

  it("rejects triggered rule ids that do not match the reasons", () => {
    const result = AssessmentResult.safeParse({
      ...base,
      zone: "RED",
      triggeredRuleIds: ["DEMO-OTHER"],
      reasons: [redReason],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a stored, consistent RED assessment", () => {
    const result = RiskAssessment.safeParse({
      ...base,
      id: ID.c,
      zone: "RED",
      triggeredRuleIds: ["DEMO-X-01"],
      reasons: [redReason],
    });
    expect(result.success).toBe(true);
  });
});

describe("Alert", () => {
  const alert = {
    id: ID.a,
    patientId: ID.b,
    patientReference: "OB-0001",
    riskAssessmentId: ID.c,
    severity: "RED",
    title: "Red zone",
    message: "Review needed",
    triggeredRuleIds: ["DEMO-X-01"],
    recipientRole: "SPECIALIST",
    createdAt: NOW,
    acknowledgedAt: null,
    acknowledgedBy: null,
  };

  it("accepts a pending alert", () => {
    expect(Alert.safeParse({ ...alert, status: "PENDING" }).success).toBe(true);
  });

  it("requires who and when for an acknowledged alert", () => {
    expect(Alert.safeParse({ ...alert, status: "ACKNOWLEDGED" }).success).toBe(false);
  });
});

describe("RuleSource", () => {
  it("requires a citation for a validated rule", () => {
    expect(RuleSource.safeParse({ status: "VALIDATED", ref: null }).success).toBe(false);
    expect(RuleSource.safeParse({ status: "ILLUSTRATIVE", ref: null }).success).toBe(true);
  });

  it("accepts page citations of a known document, with at least one page", () => {
    const source = (citations: unknown) =>
      RuleSource.safeParse({ status: "ILLUSTRATIVE", ref: "p. 28", citations }).success;
    expect(source([{ document: "UZ_ANTENATAL_CARE_2025", pages: ["28"] }])).toBe(true);
    expect(source([{ document: "UZ_ANTENATAL_CARE_2025", pages: [] }])).toBe(false);
    expect(source([{ document: "SOME_OTHER_BOOK", pages: ["1"] }])).toBe(false);
    expect(source([])).toBe(false);
  });
});

describe("GestationalWeeks", () => {
  it("accepts ranges open at either end and the unknown-week marker", () => {
    for (const weeks of [{ to: 14 }, { from: 14, to: 28 }, { from: 28 }, { unknown: true }]) {
      expect(GestationalWeeks.safeParse(weeks).success).toBe(true);
    }
  });

  it("rejects an empty or reversed range, fractions and a mix of both forms", () => {
    for (const weeks of [
      {},
      { from: 28, to: 14 },
      { from: 14, to: 14 },
      { from: 13.5 },
      { unknown: false },
      { from: 14, unknown: true },
    ]) {
      expect(GestationalWeeks.safeParse(weeks).success).toBe(false);
    }
  });
});

describe("PatientListQuery", () => {
  it("coerces paging values from the query string and applies defaults", () => {
    expect(PatientListQuery.parse({ page: "2" })).toEqual({ page: 2, pageSize: 25 });
  });
});

describe("endpoint catalogue", () => {
  const list = Object.values(endpoints);

  it("gives every endpoint a unique method and path", () => {
    const keys = list.map((e) => `${e.method} ${e.path}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("validates params for every path with an :id segment", () => {
    for (const endpoint of list) {
      if (endpoint.path.includes(":id")) expect("params" in endpoint).toBe(true);
    }
  });
});

// ---------- Contracts added on 18 Nov (auth, permissions, referrals, attachments, signals) ----------

import {
  AnalyzeDocumentResponse,
  can,
  patientScope,
  ReferralActionRequest,
  SignalKind,
  SignalLinkCode,
  signalInstruction,
} from "../src";
import { ALARM_SIGNS } from "../../data-pack/protocol-data";

describe("access matrix", () => {
  it("lets only doctors register patients and keeps managers read-only", () => {
    expect(can("DOCTOR", "PATIENT_CREATE")).toBe(true);
    expect(can("NURSE", "PATIENT_CREATE")).toBe(false);
    expect(can("MANAGER", "VISIT_ADD")).toBe(false);
    expect(can("SPECIALIST", "REFERRAL_RESPOND")).toBe(true);
  });

  it("scopes consultants to referrals and the alert recipient to the district", () => {
    expect(patientScope({ role: "SPECIALIST", specialty: "ENDOCRINOLOGIST" })).toBe("REFERRALS");
    expect(patientScope({ role: "SPECIALIST", specialty: null })).toBe("DISTRICT");
    expect(patientScope({ role: "MANAGER" })).toBe("ALL");
  });
});

describe("patient signals", () => {
  it("uses the protocol's 13 alarm signs, with the same ids as the data pack", () => {
    const protocol = ALARM_SIGNS.map((s) => s.id);
    expect(protocol).toHaveLength(13);
    for (const id of protocol) expect(SignalKind.options).toContain(id);
    expect(SignalKind.options).toHaveLength(15);
  });

  it("tells the patient to seek care for alarm signs and to call 103 in labour", () => {
    expect(signalInstruction("VAGINAL_BLEEDING")).toBe("SEEK_CARE_NOW");
    expect(signalInstruction("LABOUR_ONSET")).toBe("LABOUR");
    expect(signalInstruction("CALL_BACK")).toBe("DOCTOR_WILL_CALL");
  });

  it("normalises link codes and rejects look-alike characters", () => {
    expect(SignalLinkCode.parse(" abcd2345 ")).toBe("ABCD2345");
    expect(SignalLinkCode.safeParse("ABCD0O1I").success).toBe(false);
  });
});

describe("referral actions", () => {
  it("requires a conclusion text to conclude", () => {
    expect(ReferralActionRequest.safeParse({ action: "CONCLUDE" }).success).toBe(false);
    expect(
      ReferralActionRequest.parse({ action: "CONCLUDE", conclusion: "Без патологии" }),
    ).toMatchObject({ attachmentIds: [] });
  });
});

describe("document analysis", () => {
  it("carries an ultrasound dating suggestion", () => {
    const r = AnalyzeDocumentResponse.parse({
      draft: { measuredAt: null, measurements: [] },
      dating: { method: "ULTRASOUND", scanDate: "2026-11-10", weeks: 22, days: 3 },
      warnings: [],
      model: "claude-haiku-5-5",
    });
    expect(r.dating?.method).toBe("ULTRASOUND");
  });
});
