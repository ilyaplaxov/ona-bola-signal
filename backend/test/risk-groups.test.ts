import { readFileSync } from "node:fs";
import { RiskFlag, RiskGroup, type RiskGroupLevel, type RiskScale } from "@ona-bola/shared";
import { describe, expect, it } from "vitest";
import { ageInYears } from "../src/domain/pregnancy";
import { assessRiskGroups, riskGroupsFor, type RiskProfile } from "../src/risk-engine";

const profile = (overrides: Partial<RiskProfile> = {}): RiskProfile => ({
  ageYears: 28,
  parity: 1,
  bmi: 23,
  flags: new Set(),
  ...overrides,
});
const flags = (...list: RiskFlag[]) => new Set<RiskFlag>(list);
const group = (p: RiskProfile, scale: RiskScale) => {
  const found = assessRiskGroups(p).find((g) => g.scale === scale);
  if (!found) throw new Error(`no ${scale} group`);
  return found;
};

describe("risk groups from the anamnesis (antenatal protocol, pp. 33–41)", () => {
  it("returns all five scales, LOW and without actions for an unremarkable history", () => {
    const groups = assessRiskGroups(profile());
    expect(groups.map((g) => g.scale)).toEqual(["PREECLAMPSIA", "GDM", "VTE", "PPH", "FGR"]);
    expect(groups.every((g) => g.level === "LOW" && g.actions.length === 0)).toBe(true);
    expect(groups.every((g) => RiskGroup.safeParse(g).success)).toBe(true);
  });

  it("raises pre-eclampsia risk for one high factor or two moderate ones (p. 34)", () => {
    expect(group(profile({ flags: flags("CHRONIC_HYPERTENSION") }), "PREECLAMPSIA").level).toBe(
      "HIGH",
    );
    expect(group(profile({ parity: 0 }), "PREECLAMPSIA").level).toBe("LOW");
    const high = group(
      profile({ parity: 0, flags: flags("FAMILY_HISTORY_PREECLAMPSIA") }),
      "PREECLAMPSIA",
    );
    expect(high).toMatchObject({
      level: "HIGH",
      matched: ["NULLIPARITY", "FAMILY_HISTORY_PREECLAMPSIA"],
      actions: ["ASPIRIN_150_EVENING", "DAILY_BP_SELF_CHECK", "PROTEINURIA_EVERY_VISIT"],
    });
    expect(high.source.citations).toEqual([
      { document: "UZ_ANTENATAL_CARE_2025", pages: ["33–34", "54"] },
    ]);
  });

  it("scores thromboembolism: 1–2 points moderate, 3 or more high (pp. 37–38)", () => {
    expect(group(profile({ ageYears: 36 }), "VTE")).toMatchObject({ level: "MODERATE", score: 1 });
    const high = group(profile({ ageYears: 36, bmi: 32, parity: 3 }), "VTE");
    expect(high).toMatchObject({
      level: "HIGH",
      score: 3,
      matched: ["AGE_OVER_35", "BMI_OVER_30", "PARITY_3_PLUS"],
    });
    expect(high.actions).toContain("HAEMATOLOGIST_LMWH");
    // Severe pre-eclampsia counts 2 points instead of, not on top of, moderate pre-eclampsia.
    const both = flags("PREECLAMPSIA_MODERATE", "PREECLAMPSIA_EARLY_OR_SEVERE");
    expect(group(profile({ flags: both }), "VTE").score).toBe(2);
  });

  it("puts haemoglobin below 90 g/L or a uterine scar at risk of haemorrhage (pp. 38–39)", () => {
    expect(group(profile({ latestHbGL: 89 }), "PPH").matched).toEqual(["ANEMIA_HB_BELOW_90"]);
    expect(group(profile({ latestHbGL: 90 }), "PPH").level).toBe("LOW");
    expect(group(profile({ flags: flags("UTERINE_SCAR") }), "PPH").actions).toEqual([
      "TREAT_ANAEMIA",
      "DELIVER_AT_LEVEL_2_3",
    ]);
    expect(group(profile({ flags: flags("PLACENTA_PREVIA_OR_ACCRETA") }), "PPH").actions).toContain(
      "PREVIA_PLANNED_ADMISSION",
    );
  });

  it("needs one major or three minor growth-restriction factors (pp. 40, 55)", () => {
    expect(group(profile({ ageYears: 41 }), "FGR")).toMatchObject({
      level: "HIGH",
      actions: ["SERIAL_GROWTH_SCANS_FROM_26_28"],
    });
    const threeMinor = profile({ ageYears: 36, parity: 0, bmi: 27 });
    expect(group(threeMinor, "FGR")).toMatchObject({
      level: "HIGH",
      matched: ["AGE_OVER_35", "NULLIPARITY", "BMI_UNDER_20_OR_25_TO_35"],
      actions: ["GROWTH_SCAN_20_24"],
    });
    expect(group(profile({ ageYears: 36, parity: 0 }), "FGR").level).toBe("LOW");
  });

  it("is not assessed without the parity or the age, and counts a caesarean as a scar", () => {
    expect(riskGroupsFor({ riskFactors: {}, ageYears: 30, latestHbGL: null })).toBeNull();
    expect(riskGroupsFor({ riskFactors: { parity: 1 }, ageYears: null, latestHbGL: null })).toBe(
      null,
    );
    const groups = riskGroupsFor({
      riskFactors: { parity: 1, previousCesarean: true },
      ageYears: 30,
      latestHbGL: 120,
    });
    expect(groups?.find((g) => g.scale === "PPH")?.matched).toEqual(["UTERINE_SCAR"]);
  });

  it("gives the levels the domain pack expects for its 25 synthetic patients", () => {
    interface PackPatient {
      externalReference: string;
      dateOfBirth: string;
      riskFactors: { parity: number; bmi?: number; flags: string[] };
      riskGroups: Record<RiskScale, RiskGroupLevel>;
      visits: { measurements: { type: string; value?: number }[] }[];
    }
    const pack = JSON.parse(
      readFileSync(new URL("../../data-pack/synthetic-seed.json", import.meta.url), "utf8"),
    ) as { referenceDate: string; patients: PackPatient[] };
    const at = new Date(`${pack.referenceDate}T00:00:00Z`);
    expect(pack.patients).toHaveLength(25);

    for (const p of pack.patients) {
      const latestHb = p.visits
        .flatMap((v) => v.measurements)
        .filter((m) => m.type === "HEMOGLOBIN")
        .at(-1)?.value;
      const groups = assessRiskGroups({
        ageYears: ageInYears(p.dateOfBirth, at) ?? 0,
        parity: p.riskFactors.parity,
        flags: new Set(RiskFlag.array().parse(p.riskFactors.flags)),
        ...(p.riskFactors.bmi !== undefined ? { bmi: p.riskFactors.bmi } : {}),
        ...(latestHb !== undefined ? { latestHbGL: latestHb } : {}),
      });
      const levels = Object.fromEntries(groups.map((g) => [g.scale, g.level]));
      expect({ ref: p.externalReference, levels }).toEqual({
        ref: p.externalReference,
        levels: p.riskGroups,
      });
    }
  });
});
