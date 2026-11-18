import { writeFileSync } from "node:fs";
import { addDays, ageInYears, bmi, gestationalAge, trimester } from "./formulas.ts";
import { assessRiskGroups } from "./risk-scales.ts";
import type { RiskFlag } from "./risk-scales.ts";
import { DEMO_RULES } from "./demo-rules.ts";
import type { Measure, Zone } from "./demo-rules.ts";
import { assessVisit } from "./reference-assess.ts";
import type { VisitValues } from "./reference-assess.ts";

const NOW = new Date("2026-11-18T00:00:00Z");
const DEMO_MEASURED_AT = "2026-11-18T10:30:00+05:00";

function mulberry32(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20261118);
const between = (a: number, b: number) => a + (b - a) * rng();
const int = (a: number, b: number) => Math.floor(between(a, b + 1));
const r0 = (x: number) => Math.round(x);
const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;

function uuid(): string {
  const h = Array.from({ length: 32 }, () => Math.floor(rng() * 16).toString(16));
  h[12] = "4";
  h[16] = ((parseInt(h[16], 16) & 3) | 8).toString(16);
  const s = h.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

type Scenario =
  | "NORMAL"
  | "STALE"
  | "MILD_ANEMIA"
  | "MODERATE_ANEMIA_NO_RESPONSE"
  | "GDM"
  | "GEST_HTN"
  | "SEVERE_PE"
  | "SEVERE_ANEMIA"
  | "NO_DATA"
  | "DEMO";

type GlucoseContext = "FASTING" | "OGTT_1H" | "OGTT_2H";
type Item =
  | { type: "BLOOD_PRESSURE"; systolic: number; diastolic: number; unit: "mmHg" }
  | { type: "HEMOGLOBIN"; value: number; unit: "g/L" }
  | { type: "PROTEINURIA"; value: number; unit: "g/L" }
  | { type: "GLUCOSE"; value: number; unit: "mmol/L"; context: GlucoseContext };

interface Visit {
  submissionId: string;
  measuredAt: string;
  gestationalWeeks: number;
  measurements: Item[];
}

interface Spec {
  scenario: Scenario;
  gaNow: number;
  age: number;
  parity: number;
  heightCm: number;
  weightKg: number;
  flags: RiskFlag[];
  rhNegative?: boolean;
  districtIndex: number;
}

const DISTRICTS = [
  { district: "Ishtixon tumani", region: "Samarqand viloyati", facility: "Ishtixon tumani 2-son oilaviy poliklinika", doctor: "u-doctor-1" },
  { district: "Qibray tumani", region: "Toshkent viloyati", facility: "Qibray tumani 1-son oilaviy poliklinika", doctor: "u-doctor-2" },
  { district: "Quva tumani", region: "Farg'ona viloyati", facility: "Quva tumani 3-son oilaviy poliklinika", doctor: "u-doctor-1" },
];

const USERS = [
  { ref: "u-doctor-1", displayName: "Aziza Musayeva", role: "DOCTOR", district: "Ishtixon tumani" },
  { ref: "u-doctor-2", displayName: "Ra'no Ahmedova", role: "DOCTOR", district: "Qibray tumani" },
  { ref: "u-nurse-1", displayName: "Gulnoza Tojiyeva", role: "NURSE", district: "Ishtixon tumani" },
  { ref: "u-specialist-1", displayName: "Dilfuza Hasanova", role: "SPECIALIST", district: "Ishtixon tumani" },
  { ref: "u-manager-1", displayName: "Sherzod Qosimov", role: "MANAGER", district: "Ishtixon tumani" },
];

const FIRST = ["Dilnoza", "Madina", "Gulnora", "Shahnoza", "Nilufar", "Zarina", "Malika", "Feruza", "Sevara", "Kamola", "Mohira", "Dildora", "Munisa", "Sarvinoz", "Mavluda", "Lola", "Umida", "Yulduz", "Barno", "Nargiza", "Ozoda", "Hilola", "Rayhona", "Sabina", "Gulbahor"];
const LAST = ["Karimova", "Rahimova", "Yusupova", "Tursunova", "Abdullayeva", "Ergasheva", "Nazarova", "Saidova", "Xolmatova", "Qodirova", "Mirzayeva", "Aliyeva", "Usmonova", "Sobirova", "Jo'rayeva", "Hamidova", "Ismoilova", "Murodova", "Sultonova", "Valiyeva", "Zokirova", "Normatova", "Bakirova", "Raxmonova", "Fayzullayeva"];

const normalGa = [12.4, 14.2, 17.1, 20.3, 23.5, 25.2, 27.4, 29.3, 31.6, 33.1, 35.4, 37.2, 39.1];
const normalFlags: RiskFlag[][] = [[], ["UTERINE_SCAR"], [], ["VARICOSE_VEINS"], [], ["UTERINE_SCAR"], ["FAMILY_HISTORY_DIABETES"], [], [], ["UTERINE_SCAR"], [], ["SMOKING"], []];

const SPECS: Spec[] = [
  ...normalGa.map((gaNow, i) => ({
    scenario: "NORMAL" as const,
    gaNow,
    age: int(20, 34),
    parity: i % 3 === 0 ? 0 : int(1, 3),
    heightCm: int(152, 168),
    weightKg: int(50, 72),
    flags: normalFlags[i],
    rhNegative: i === 4,
    districtIndex: i % 3,
  })),
  { scenario: "STALE", gaNow: 33.2, age: 27, parity: 2, heightCm: 158, weightKg: 60, flags: [], districtIndex: 2 },
  { scenario: "MILD_ANEMIA", gaNow: 22.3, age: 24, parity: 1, heightCm: 160, weightKg: 55, flags: [], districtIndex: 0 },
  { scenario: "MILD_ANEMIA", gaNow: 28.6, age: 31, parity: 3, heightCm: 155, weightKg: 58, flags: ["UTERINE_SCAR"], districtIndex: 1 },
  { scenario: "MODERATE_ANEMIA_NO_RESPONSE", gaNow: 29.1, age: 29, parity: 3, heightCm: 157, weightKg: 54, flags: ["PREGNANCY_INTERVAL_UNDER_6_OR_OVER_60_MONTHS"], districtIndex: 0 },
  { scenario: "GDM", gaNow: 31.0, age: 34, parity: 2, heightCm: 160, weightKg: 82, flags: ["PREVIOUS_GDM"], districtIndex: 1 },
  { scenario: "GDM", gaNow: 27.5, age: 38, parity: 1, heightCm: 162, weightKg: 84, flags: ["FAMILY_HISTORY_DIABETES"], districtIndex: 2 },
  { scenario: "GEST_HTN", gaNow: 33.5, age: 23, parity: 0, heightCm: 163, weightKg: 66, flags: ["FAMILY_HISTORY_PREECLAMPSIA"], districtIndex: 0 },
  { scenario: "SEVERE_PE", gaNow: 32.6, age: 33, parity: 1, heightCm: 158, weightKg: 70, flags: ["PREVIOUS_HYPERTENSION_IN_PREGNANCY"], districtIndex: 0 },
  { scenario: "SEVERE_ANEMIA", gaNow: 31.0, age: 36, parity: 4, heightCm: 154, weightKg: 52, flags: ["PREGNANCY_INTERVAL_UNDER_6_OR_OVER_60_MONTHS"], districtIndex: 2 },
  { scenario: "NO_DATA", gaNow: 9.1, age: 22, parity: 0, heightCm: 161, weightKg: 54, flags: [], districtIndex: 1 },
  { scenario: "NO_DATA", gaNow: 16.4, age: 30, parity: 2, heightCm: 156, weightKg: 63, flags: ["UTERINE_SCAR"], rhNegative: true, districtIndex: 2 },
  { scenario: "DEMO", gaNow: 32.3, age: 40, parity: 0, heightCm: 159, weightKg: 64, flags: [], districtIndex: 0 },
];

const SCHEDULE = [10, 19, 26, 30, 34, 36, 38];

function visitWeeks(s: Spec): number[] {
  if (s.scenario === "NO_DATA") return [];
  let weeks = SCHEDULE.filter((w) => w <= s.gaNow - 0.4);
  if (s.scenario === "STALE") weeks = weeks.filter((w) => w <= 19);
  if (["MODERATE_ANEMIA_NO_RESPONSE", "SEVERE_ANEMIA"].includes(s.scenario) && s.gaNow > 28.6) weeks.push(28);
  if (["GEST_HTN", "SEVERE_PE"].includes(s.scenario) && s.gaNow > 32.4) weeks.push(32);
  return weeks
    .sort((a, b) => a - b)
    .map((w) => Math.min(r1(w + between(-0.3, 0.3)), s.gaNow - 0.2));
}

function bp(s: Spec, ga: number): Item {
  const noise = () => between(-2, 2);
  let sys: number;
  let dia: number;
  if (s.scenario === "GEST_HTN") {
    [sys, dia] = ga < 20 ? [116, 74] : ga < 28 ? [122, 78] : ga < 31 ? [134, 86] : [146, 94];
  } else if (s.scenario === "SEVERE_PE") {
    [sys, dia] = ga < 25 ? [118, 76] : ga < 29 ? [124, 80] : ga < 31 ? [138, 88] : [164, 108];
  } else if (s.scenario === "DEMO") {
    [sys, dia] = [114 + between(-2, 3), 73 + between(-2, 2)];
  } else {
    const dip = ga >= 18 && ga < 28 ? 4 : 0;
    sys = Math.min(132, 111 + between(-6, 8) - dip);
    dia = Math.min(84, 71 + between(-5, 6) - dip);
  }
  return { type: "BLOOD_PRESSURE", systolic: r0(sys + noise()), diastolic: r0(dia + noise()), unit: "mmHg" };
}

function hb(s: Spec, ga: number): number {
  const t = trimester(ga);
  switch (s.scenario) {
    case "MILD_ANEMIA":
      return ga < 14 ? 113 : t === 2 ? int(100, 102) : int(103, 105);
    case "MODERATE_ANEMIA_NO_RESPONSE":
      return ga < 14 ? 108 : ga < 22 ? 98 : ga < 27 ? 88 : 89;
    case "SEVERE_ANEMIA":
      return ga < 14 ? 104 : ga < 22 ? 92 : ga < 27 ? 78 : ga < 29 ? 72 : 66;
    default: {
      const base = t === 1 ? 124 : t === 2 ? 115 : 117;
      return Math.max(t === 2 ? 107 : 112, r0(base + between(-4, 4)));
    }
  }
}

function needsHb(s: Spec, ga: number, i: number): boolean {
  if (i === 0 || (ga >= 25 && ga < 27.5)) return true;
  return ["MILD_ANEMIA", "MODERATE_ANEMIA_NO_RESPONSE", "SEVERE_ANEMIA"].includes(s.scenario) && ga >= 18;
}

const isOgttWindow = (ga: number) => ga >= 25.5 && ga < 28.5;

function glucose(s: Spec, i: number, ogttVisit: boolean): Item[] {
  const g = (value: number, context: GlucoseContext): Item => ({ type: "GLUCOSE", value: r1(value), unit: "mmol/L", context });
  const gdm = s.scenario === "GDM";
  if (i === 0) return [g(gdm ? between(5.2, 5.6) : between(4.2, 4.8), "FASTING")];
  if (ogttVisit) {
    return gdm
      ? [g(between(5.2, 5.5), "FASTING"), g(between(10.1, 10.8), "OGTT_1H"), g(between(8.8, 9.4), "OGTT_2H")]
      : [g(between(4.2, 4.8), "FASTING"), g(between(6.5, 8.6), "OGTT_1H"), g(between(5.4, 7.2), "OGTT_2H")];
  }
  return [];
}

function proteinuria(s: Spec, ga: number, i: number, highPeRisk: boolean): Item[] {
  const p = (value: number): Item => ({ type: "PROTEINURIA", value: r2(value), unit: "g/L" });
  if (s.scenario === "SEVERE_PE" && ga >= 31) return [p(1.0)];
  if (s.scenario === "SEVERE_PE" && ga >= 29) return [p(0.12)];
  if (i === 0 || (ga >= 25 && ga < 27.5) || highPeRisk) return [p(rng() < 0.6 ? 0 : between(0.02, 0.09))];
  return [];
}

const ZONE_RANK: Record<Zone, number> = { GREEN: 0, YELLOW: 1, RED: 2 };

function valuesOf(items: Item[]): VisitValues {
  const v: VisitValues = {};
  for (const it of items) {
    if (it.type === "BLOOD_PRESSURE") {
      v["BLOOD_PRESSURE.systolic"] = it.systolic;
      v["BLOOD_PRESSURE.diastolic"] = it.diastolic;
    } else if (it.type === "GLUCOSE") v[`GLUCOSE.${it.context}` as Measure] = it.value;
    else v[`${it.type}.value` as Measure] = it.value;
  }
  return v;
}

function expectedAssessment(visits: Visit[]): { zone: Zone | null; ruleIds: string[] } {
  if (visits.length === 0) return { zone: null, ruleIds: [] };
  const latest = new Map<Measure, { value: number; ga: number }>();
  for (const v of visits) {
    for (const [m, value] of Object.entries(valuesOf(v.measurements))) {
      latest.set(m as Measure, { value: value as number, ga: v.gestationalWeeks });
    }
  }
  const last = visits[visits.length - 1];
  const results = [
    assessVisit(valuesOf(last.measurements), last.gestationalWeeks, DEMO_RULES),
    ...[...latest].map(([m, { value, ga }]) => assessVisit({ [m]: value }, ga, DEMO_RULES)),
  ];
  const zone = results.reduce<Zone>((z, r) => (ZONE_RANK[r.zone] > ZONE_RANK[z] ? r.zone : z), "GREEN");
  return { zone, ruleIds: [...new Set(results.flatMap((r) => r.triggered.map((t) => t.id)))] };
}

const EXPECTED_DYNAMIC: Partial<Record<Scenario, string>> = {
  STALE: "Пропущены визиты 26 и 30 нед: ожидаются MISS-BP-LATE, MISS-HB-26W, MISS-OGTT → «Green · неполные данные»",
  MILD_ANEMIA: "При ≥2 значениях Hb с интервалом ≥14 дней без роста на 10 г/л — TR-HB-NORESPONSE",
  MODERATE_ANEMIA_NO_RESPONSE: "Hb 88 → 89 за 14 дней: TR-HB-NORESPONSE",
  SEVERE_ANEMIA: "Падение Hb ≥10 г/л между визитами: TR-HB-DROP",
  GEST_HTN: "Рост систолического ≥15 от исходного: TR-BP-RISE; разовое ≥140/90 — нужен повтор через 4 ч",
  SEVERE_PE: "Рост систолического: TR-BP-RISE",
  NO_DATA: "Нет измерений: зона «Не оценено», не зелёная",
};

function localIso(date: Date, hour: number, minute: number): string {
  const d = date.toISOString().slice(0, 10);
  return `${d}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+05:00`;
}

const patients = SPECS.map((s, i) => {
  const ref = `OB-${String(i + 1).padStart(4, "0")}`;
  const district = DISTRICTS[s.districtIndex];
  const edd = addDays(NOW, Math.round(280 - s.gaNow * 7));
  const dob = addDays(NOW, -Math.round(s.age * 365.25 + between(20, 300)));
  const bmiValue = bmi(s.weightKg, s.heightCm);
  const flags = new Set(s.flags);
  const peHigh = assessRiskGroups({ ageYears: s.age, bmi: bmiValue, parity: s.parity, flags })[0].level === "HIGH";
  const weeks = visitWeeks(s);
  const ogttIdx = weeks.findIndex(isOgttWindow);
  const visits: Visit[] = weeks.map((ga, idx) => {
    const date = addDays(edd, -Math.round(280 - ga * 7));
    const items: Item[] = [bp(s, ga)];
    if (needsHb(s, ga, idx)) items.push({ type: "HEMOGLOBIN", value: hb(s, ga), unit: "g/L" });
    items.push(...glucose(s, idx, idx > 0 && idx === ogttIdx), ...proteinuria(s, ga, idx, peHigh));
    return {
      submissionId: uuid(),
      measuredAt: localIso(date, int(9, 12), int(0, 59)),
      gestationalWeeks: r1(gestationalAge(edd, date).decimalWeeks),
      measurements: items,
    };
  });
  const latestHb = [...visits].reverse().flatMap((v) => v.measurements).find((m) => m.type === "HEMOGLOBIN");
  const riskGroups = assessRiskGroups({
    ageYears: ageInYears(dob, NOW),
    bmi: bmiValue,
    parity: s.parity,
    latestHbGL: latestHb && latestHb.type === "HEMOGLOBIN" ? latestHb.value : undefined,
    flags,
  });
  const expected = expectedAssessment(visits);
  return {
    externalReference: ref,
    displayName: `${FIRST[i]} ${LAST[i]}`,
    dateOfBirth: dob.toISOString().slice(0, 10),
    region: district.region,
    district: district.district,
    facility: district.facility,
    estimatedDueDate: edd.toISOString().slice(0, 10),
    assignedUserRef: district.doctor,
    riskFactors: {
      flags: s.flags,
      parity: s.parity,
      heightCm: s.heightCm,
      prePregnancyWeightKg: s.weightKg,
      bmi: r1(bmiValue),
      rhNegative: s.rhNegative ?? false,
    },
    riskGroups: Object.fromEntries(riskGroups.map((r) => [r.scale, r.level])),
    scenario: s.scenario,
    expectedZone: expected.zone,
    expectedRuleIds: expected.ruleIds,
    expectedDynamicRules: EXPECTED_DYNAMIC[s.scenario] ?? null,
    visits,
  };
});

const demo = patients.find((p) => p.scenario === "DEMO")!;
const demoItems: Item[] = [
  { type: "BLOOD_PRESSURE", systolic: 164, diastolic: 112, unit: "mmHg" },
  { type: "PROTEINURIA", value: 0.6, unit: "g/L" },
];
const demoGa = r1(gestationalAge(new Date(demo.estimatedDueDate + "T00:00:00Z"), NOW).decimalWeeks);
const demoResult = assessVisit(valuesOf(demoItems), demoGa, DEMO_RULES);
const altItems: Item[] = [{ type: "BLOOD_PRESSURE", systolic: 146, diastolic: 92, unit: "mmHg" }];

const zoneCounts = patients.reduce<Record<string, number>>((acc, p) => {
  const key = p.expectedZone ?? "NOT_ASSESSED";
  acc[key] = (acc[key] ?? 0) + 1;
  return acc;
}, {});

const seed = {
  generatedFor: "Ona-Bola Signal demo, synthetic data only",
  referenceDate: NOW.toISOString().slice(0, 10),
  ruleSetVersion: DEMO_RULES.version,
  notes: [
    "All people are fictional. Names are random combinations.",
    "expectedZone assumes the engine evaluates the latest value of each measure at the gestational age it was taken, and combination rules within one visit.",
    "Trend, response and missing-data rules are not evaluated here; see expectedDynamicRules.",
    "Glucose items carry a context field (FASTING, OGTT_1H, OGTT_2H); add it to the measurement contract or split the type.",
  ],
  zoneCounts,
  users: USERS,
  patients,
  demoScenario: {
    patientRef: demo.externalReference,
    story: "Пациентка группы высокого риска ПЭ (40 лет, первородящая) с ровной зелёной историей. Новое измерение на демо переводит её в красную зону и создаёт алерт специалисту.",
    measuredAt: DEMO_MEASURED_AT,
    gestationalWeeks: demoGa,
    measurements: demoItems,
    expectedZone: demoResult.zone,
    expectedRuleIds: demoResult.triggered.map((t) => t.id),
    alternativeYellowMeasurements: altItems,
  },
};

writeFileSync(new URL("./synthetic-seed.json", import.meta.url), JSON.stringify(seed, null, 2) + "\n", "utf8");
console.log(JSON.stringify({ patients: patients.length, zoneCounts, demo: { zone: demoResult.zone, rules: seed.demoScenario.expectedRuleIds } }));
