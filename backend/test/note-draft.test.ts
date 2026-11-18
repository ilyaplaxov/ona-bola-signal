import type { NoteExtractionOutput } from "@ona-bola/shared";
import { describe, expect, it } from "vitest";
import { draftTime, toNoteDraft, unitKey } from "../src/services/note-draft";

const NOW = new Date("2026-11-18T06:00:00Z"); // 11:00 in Tashkent

const empty: NoteExtractionOutput = {
  measuredAt: null,
  bloodPressure: null,
  hemoglobin: null,
  proteinuria: null,
  glucose: null,
  missingOrUnclear: [],
};

const draft = (extraction: Partial<NoteExtractionOutput>, language: "uz" | "ru" | "en" = "en") =>
  toNoteDraft({ ...empty, ...extraction }, { language, now: NOW });

describe("toNoteDraft", () => {
  it("keeps values that are already in the canonical units, without warnings", () => {
    const result = draft({
      bloodPressure: { systolic: 148, diastolic: 96, unitAsWritten: "mmHg" },
      hemoglobin: { value: 112, unitAsWritten: "g/L" },
      proteinuria: { value: 0, unitAsWritten: "g/l" },
      glucose: { value: 5.4, unitAsWritten: "mmol/L" },
    });
    expect(result.draft.measurements).toEqual([
      { type: "BLOOD_PRESSURE", systolic: 148, diastolic: 96, unit: "mmHg" },
      { type: "HEMOGLOBIN", value: 112, unit: "g/L" },
      { type: "PROTEINURIA", value: 0, unit: "g/L" },
      { type: "GLUCOSE", value: 5.4, unit: "mmol/L" },
    ]);
    expect(result.warnings).toEqual([]);
  });

  it("reads Cyrillic and Uzbek unit spellings", () => {
    const result = draft({
      bloodPressure: { systolic: 120, diastolic: 80, unitAsWritten: "мм рт. ст." },
      hemoglobin: { value: 104, unitAsWritten: "г/л" },
      glucose: { value: 4.9, unitAsWritten: "ммоль/л" },
    });
    expect(result.draft.measurements.map((m) => m.type)).toEqual([
      "BLOOD_PRESSURE",
      "HEMOGLOBIN",
      "GLUCOSE",
    ]);
    expect(
      draft({ bloodPressure: { systolic: 120, diastolic: 80, unitAsWritten: "mm sim. ust." } })
        .draft.measurements,
    ).toHaveLength(1);
    expect(unitKey("мм рт. ст.")).toBe("ммртст");
  });

  it("converts other units in code and says so", () => {
    const result = draft({
      hemoglobin: { value: 11.2, unitAsWritten: "g/dL" },
      proteinuria: { value: 30, unitAsWritten: "mg/dl" },
      glucose: { value: 92, unitAsWritten: "мг/дл" },
    });
    expect(result.draft.measurements).toEqual([
      { type: "HEMOGLOBIN", value: 112, unit: "g/L" },
      { type: "PROTEINURIA", value: 0.3, unit: "g/L" },
      { type: "GLUCOSE", value: 5.1, unit: "mmol/L" },
    ]);
    expect(result.warnings).toHaveLength(3);
    expect(result.warnings[0]).toBe(
      "Haemoglobin 11.2 g/dL was converted to 112 g/L. Check it before saving.",
    );
  });

  it("never guesses a missing unit (except mmHg for blood pressure)", () => {
    const result = draft({
      bloodPressure: { systolic: 150, diastolic: 95, unitAsWritten: null },
      hemoglobin: { value: 11.2, unitAsWritten: null },
    });
    expect(result.draft.measurements).toEqual([
      { type: "BLOOD_PRESSURE", systolic: 150, diastolic: 95, unit: "mmHg" },
    ]);
    expect(result.warnings).toEqual([
      "Haemoglobin 11.2: the note gives no unit, so it was left out. Check the unit and enter it by hand.",
    ]);
  });

  it("leaves out unknown units and values that fail the form checks", () => {
    const result = draft({
      bloodPressure: { systolic: 90, diastolic: 120, unitAsWritten: "mmHg" },
      proteinuria: { value: 0.5, unitAsWritten: "g/24h" },
      glucose: { value: -1, unitAsWritten: "mmol/l" },
    });
    expect(result.draft.measurements).toEqual([]);
    expect(result.warnings).toEqual([
      "Blood pressure: the value failed the form checks, so it was left out.",
      "Urine protein 0.5 g/24h: this unit is not supported, so it was left out. Enter it by hand.",
      "Glucose: the value failed the form checks, so it was left out.",
    ]);
  });

  it("writes its warnings in Russian when asked", () => {
    const result = draft({ hemoglobin: { value: 11.2, unitAsWritten: "g/dL" } }, "ru");
    expect(result.warnings).toEqual([
      "Гемоглобин 11.2 g/dL пересчитано в 112 g/L. Проверьте перед сохранением.",
    ]);
  });

  it("writes its warnings in Uzbek when asked, and appends Claude's own notes", () => {
    const result = draft(
      {
        hemoglobin: { value: 11.2, unitAsWritten: null },
        missingOrUnclear: ['Oqsil faqat "++" deb yozilgan', "  "],
      },
      "uz",
    );
    expect(result.warnings).toEqual([
      "Gemoglobin 11.2: izohda oʻlchov birligi yozilmagan, shuning uchun qoʻshilmadi. Birlikni tekshirib, qoʻlda kiriting.",
      'Oqsil faqat "++" deb yozilgan',
    ]);
  });
});

describe("draftTime", () => {
  it("adds seconds and the Tashkent offset to a local time", () => {
    expect(draftTime("2026-11-18T09:30", NOW)).toEqual({
      measuredAt: "2026-11-18T09:30:00+05:00",
    });
    expect(draftTime("2026-11-18T04:30:00Z", NOW)).toEqual({ measuredAt: "2026-11-18T04:30:00Z" });
  });

  it("asks for a time when the note gives only a date", () => {
    expect(draftTime("2026-11-18", NOW)).toEqual({ measuredAt: null, problem: "dateOnly" });
  });

  it("rejects malformed and future times", () => {
    expect(draftTime("yesterday morning", NOW)).toEqual({ measuredAt: null, problem: "badTime" });
    expect(draftTime("2026-11-18T12:00", NOW)).toEqual({ measuredAt: null, problem: "badTime" });
    expect(draftTime(null, NOW)).toEqual({ measuredAt: null });
  });
});
