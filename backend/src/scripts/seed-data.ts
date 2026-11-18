import type {
  MeasurementReading,
  RiskFactors,
  RiskFlag,
  Specialty,
  UserRole,
} from "@ona-bola/shared";
import { seedId } from "./seed-ids";

// SYNTHETIC DEMO DATA. Every person here is invented; district names are real places only.
// Values are chosen to show each kind of case under the illustrative demo rules.

export interface SeedUser {
  key: string;
  displayName: string;
  role: UserRole;
  district: string | null;
  /** Login name; every demo account signs in with DEMO_PASSWORD. */
  username: string;
  specialty?: Specialty;
  facility?: string;
}

/**
 * Shared password of the synthetic demo accounts. Not a secret: it is shown on the login page
 * while DEMO_ACCOUNTS is on, and there is no real data behind it.
 */
export const DEMO_PASSWORD = "demo2026";

export const SEED_USERS: SeedUser[] = [
  {
    key: "doctor-chilonzor",
    displayName: "Dr. Aziza Karimova",
    role: "DOCTOR",
    district: "Chilonzor",
    username: "karimova",
    facility: "Oilaviy poliklinika 12",
  },
  {
    key: "doctor-yunusobod",
    displayName: "Dr. Bobur Toshmatov",
    role: "DOCTOR",
    district: "Yunusobod",
    username: "toshmatov",
    facility: "Oilaviy poliklinika 27",
  },
  {
    key: "doctor-mirzo",
    displayName: "Dr. Dilfuza Ergasheva",
    role: "DOCTOR",
    district: "Mirzo Ulugʻbek",
    username: "ergasheva",
    facility: "Oilaviy poliklinika 41",
  },
  {
    key: "nurse-chilonzor",
    displayName: "Nilufar Saidova",
    role: "NURSE",
    district: "Chilonzor",
    username: "saidova",
    facility: "Oilaviy poliklinika 12",
  },
  {
    key: "specialist",
    displayName: "Dr. Kamola Rasulova",
    role: "SPECIALIST",
    district: null,
    username: "rasulova",
  },
  {
    key: "endocrinologist",
    displayName: "Dr. Malika Yusupova",
    role: "SPECIALIST",
    district: null,
    username: "yusupova",
    specialty: "ENDOCRINOLOGIST",
    facility: "Shahar endokrinologiya markazi",
  },
  {
    key: "cardiologist",
    displayName: "Dr. Sardor Nazarov",
    role: "SPECIALIST",
    district: null,
    username: "nazarov",
    specialty: "CARDIOLOGIST",
    facility: "Shahar kardiologiya markazi",
  },
  {
    key: "manager",
    displayName: "Jamshid Aliyev",
    role: "MANAGER",
    district: null,
    username: "aliyev",
  },
];

export const userId = (key: string) => seedId(`user:${key}`);

const DISTRICTS = {
  chilonzor: {
    name: "Chilonzor",
    facility: "Oilaviy poliklinika 12",
    doctor: "doctor-chilonzor",
    recorder: "nurse-chilonzor",
  },
  yunusobod: {
    name: "Yunusobod",
    facility: "Oilaviy poliklinika 27",
    doctor: "doctor-yunusobod",
    recorder: "doctor-yunusobod",
  },
  mirzo: {
    name: "Mirzo Ulugʻbek",
    facility: "Oilaviy poliklinika 41",
    doctor: "doctor-mirzo",
    recorder: "doctor-mirzo",
  },
} as const;

export type Scenario =
  | "stable"
  | "hb-second-trimester"
  | "anaemia"
  | "anaemia-third-trimester"
  | "hypertension"
  | "severe-hypertension"
  | "pre-eclampsia"
  | "severe-anaemia"
  | "gdm-range"
  | "previous-cesarean"
  | "missing-labs"
  | "not-assessed"
  | "stale-bp"
  | "demo";

export interface SeedPatient {
  ref: string;
  displayName: string;
  ageYears: number;
  /** Completed weeks of pregnancy on the day of the reset. */
  week: number;
  district: keyof typeof DISTRICTS;
  scenario: Scenario;
}

/** The patient used in the live demo: Green with a rising pressure trend. Find her as OB-DEMO-01. */
export const DEMO_PATIENT_REF = "OB-DEMO-01";

export const SEED_PATIENTS: SeedPatient[] = [
  {
    ref: "OB-0001",
    displayName: "Dilnoza Rahimova",
    ageYears: 27,
    week: 24,
    district: "chilonzor",
    scenario: "hb-second-trimester",
  },
  {
    ref: "OB-0002",
    displayName: "Gulnora Tursunova",
    ageYears: 31,
    week: 29,
    district: "chilonzor",
    scenario: "anaemia-third-trimester",
  },
  {
    ref: "OB-0003",
    displayName: "Malika Nazarova",
    ageYears: 24,
    week: 18,
    district: "chilonzor",
    scenario: "stable",
  },
  {
    ref: "OB-0004",
    displayName: "Shahnoza Ismoilova",
    ageYears: 34,
    week: 33,
    district: "chilonzor",
    scenario: "hypertension",
  },
  {
    ref: "OB-0005",
    displayName: "Zarina Qodirova",
    ageYears: 29,
    week: 22,
    district: "chilonzor",
    scenario: "previous-cesarean",
  },
  {
    ref: "OB-0006",
    displayName: "Madina Xolmatova",
    ageYears: 22,
    week: 14,
    district: "chilonzor",
    scenario: "stable",
  },
  {
    ref: "OB-0007",
    displayName: "Feruza Mirzayeva",
    ageYears: 26,
    week: 30,
    district: "chilonzor",
    scenario: "severe-anaemia",
  },
  {
    ref: "OB-0008",
    displayName: "Kamola Abdullayeva",
    ageYears: 33,
    week: 27,
    district: "chilonzor",
    scenario: "gdm-range",
  },
  {
    ref: "OB-0009",
    displayName: "Nodira Yusupova",
    ageYears: 28,
    week: 26,
    district: "yunusobod",
    scenario: "stable",
  },
  {
    ref: "OB-0010",
    displayName: "Sevara Karimova",
    ageYears: 36,
    week: 34,
    district: "yunusobod",
    scenario: "pre-eclampsia",
  },
  {
    ref: "OB-0011",
    displayName: "Mohira Saidova",
    ageYears: 25,
    week: 20,
    district: "yunusobod",
    scenario: "stable",
  },
  {
    ref: "OB-0012",
    displayName: "Nargiza Tojiboyeva",
    ageYears: 32,
    week: 31,
    district: "yunusobod",
    scenario: "previous-cesarean",
  },
  {
    ref: "OB-0013",
    displayName: "Umida Ortiqova",
    ageYears: 30,
    week: 28,
    district: "yunusobod",
    scenario: "hypertension",
  },
  {
    ref: "OB-0014",
    displayName: "Lola Hamidova",
    ageYears: 23,
    week: 16,
    district: "yunusobod",
    scenario: "missing-labs",
  },
  {
    ref: "OB-0015",
    displayName: "Zulfiya Boboyeva",
    ageYears: 27,
    week: 23,
    district: "yunusobod",
    scenario: "stable",
  },
  {
    ref: "OB-0016",
    displayName: "Barno Sultonova",
    ageYears: 21,
    week: 10,
    district: "yunusobod",
    scenario: "not-assessed",
  },
  {
    ref: "OB-0017",
    displayName: "Hilola Joʻrayeva",
    ageYears: 29,
    week: 25,
    district: "mirzo",
    scenario: "stable",
  },
  {
    ref: "OB-0018",
    displayName: "Gulchehra Rustamova",
    ageYears: 38,
    week: 35,
    district: "mirzo",
    scenario: "severe-hypertension",
  },
  {
    ref: "OB-0019",
    displayName: "Munisa Olimova",
    ageYears: 24,
    week: 21,
    district: "mirzo",
    scenario: "anaemia",
  },
  {
    ref: "OB-0020",
    displayName: "Sabina Fayzullayeva",
    ageYears: 35,
    week: 29,
    district: "mirzo",
    scenario: "gdm-range",
  },
  {
    ref: "OB-0021",
    displayName: "Ozoda Valiyeva",
    ageYears: 26,
    week: 30,
    district: "mirzo",
    scenario: "stale-bp",
  },
  {
    ref: "OB-0022",
    displayName: "Durdona Ahmedova",
    ageYears: 31,
    week: 32,
    district: "mirzo",
    scenario: "previous-cesarean",
  },
  {
    ref: "OB-0023",
    displayName: "Nilufar Qosimova",
    ageYears: 28,
    week: 19,
    district: "mirzo",
    scenario: "stable",
  },
  {
    ref: DEMO_PATIENT_REF,
    displayName: "Malika Yusupova",
    ageYears: 29,
    week: 32,
    district: "chilonzor",
    scenario: "demo",
  },
];

export const districtOf = (p: SeedPatient) => DISTRICTS[p.district];

export interface SeedVisit {
  daysAgo: number;
  readings: MeasurementReading[];
}

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

/**
 * Anamnesis for the risk-group badges: previous births, body-mass index before pregnancy and the
 * findings recorded as present. OB-0014 (missing labs) and OB-0016 (just registered) have none, so
 * their cards say the risk groups are not assessed. Raised groups in this data:
 * - OB-DEMO-01: first birth and pre-eclampsia in the family, so high pre-eclampsia risk;
 * - OB-0005, OB-0012, OB-0022: previous caesarean (uterine scar), so postpartum-haemorrhage risk;
 * - OB-0007: haemoglobin below 90 g/L, so postpartum-haemorrhage risk;
 * - OB-0008, OB-0020: diabetes in the family or gestational diabetes before, so diabetes risk;
 * - OB-0010, OB-0018, OB-0020: thromboembolism points; OB-0010: three minor growth factors.
 */
const ANAMNESIS: Record<string, { parity: number; bmi: number; flags?: RiskFlag[] }> = {
  "OB-0001": { parity: 1, bmi: 22.4 },
  "OB-0002": { parity: 1, bmi: 23.1 },
  "OB-0003": { parity: 0, bmi: 21.0 },
  "OB-0004": { parity: 1, bmi: 27.2 },
  "OB-0005": { parity: 1, bmi: 24.3 },
  "OB-0006": { parity: 0, bmi: 20.6 },
  "OB-0007": { parity: 2, bmi: 21.5 },
  "OB-0008": { parity: 1, bmi: 28.9, flags: ["FAMILY_HISTORY_DIABETES"] },
  "OB-0009": { parity: 2, bmi: 22.8 },
  "OB-0010": { parity: 0, bmi: 27.4 },
  "OB-0011": { parity: 1, bmi: 23.5 },
  "OB-0012": { parity: 2, bmi: 26.1 },
  "OB-0013": { parity: 0, bmi: 24.2 },
  "OB-0015": { parity: 1, bmi: 22.1 },
  "OB-0017": { parity: 2, bmi: 23.9 },
  "OB-0018": { parity: 3, bmi: 29.0 },
  "OB-0019": { parity: 0, bmi: 20.4 },
  "OB-0020": { parity: 2, bmi: 31.2, flags: ["PREVIOUS_GDM"] },
  "OB-0021": { parity: 1, bmi: 23.0 },
  "OB-0022": { parity: 1, bmi: 25.0 },
  "OB-0023": { parity: 1, bmi: 22.2 },
  [DEMO_PATIENT_REF]: { parity: 0, bmi: 23.4, flags: ["FAMILY_HISTORY_PREECLAMPSIA"] },
};

/** Risk factors as recorded at registration. The missing-labs patient has none recorded on purpose. */
export function riskFactorsFor(p: SeedPatient): RiskFactors {
  if (p.scenario === "missing-labs") return {};
  const history = ANAMNESIS[p.ref];
  return {
    previousCesarean: p.scenario === "previous-cesarean",
    gestationalDiabetes: false,
    ...(history ? { parity: history.parity, bmi: history.bmi, flags: history.flags ?? [] } : {}),
  };
}

/** Visits, oldest first. `i` varies the values slightly between otherwise similar patients. */
export function visitsFor(p: SeedPatient, i: number): SeedVisit[] {
  const s = i % 5;
  const routine = (
    daysAgo: number,
    systolic: number,
    diastolic: number,
    extra: MeasurementReading[] = [],
  ) => ({
    daysAgo,
    readings: [bp(systolic, diastolic), ...extra],
  });

  switch (p.scenario) {
    case "stable":
    case "previous-cesarean":
      return p.week >= 20
        ? [
            routine(70, 110 + s, 70 + s, [hb(120 + s), protein(0), glucose(4.5 + s / 10)]),
            routine(42, 113 + s, 72 + s),
            routine(14, 112 + s, 71 + s, [hb(119 + s), protein(0)]),
          ]
        : [
            routine(28, 108 + s, 68 + s, [hb(122 + s), protein(0), glucose(4.4 + s / 10)]),
            routine(7, 110 + s, 70 + s),
          ];
    // Haemoglobin 107 g/L is normal in the second trimester (threshold 105) and anaemia in the
    // third (threshold 110): OB-0001 at 22 weeks stays Green, OB-0002 at 28 weeks is Yellow.
    case "hb-second-trimester":
      return [
        routine(70, 110 + s, 70 + s, [hb(120), protein(0), glucose(4.5)]),
        routine(42, 113 + s, 72 + s),
        routine(14, 112 + s, 71 + s, [hb(107), protein(0)]),
      ];
    case "anaemia":
      return [
        routine(63, 112, 72, [hb(116), protein(0), glucose(4.6)]),
        routine(35, 114, 74, [hb(104)]),
        routine(7, 113, 73, [hb(100), protein(0)]),
      ];
    case "anaemia-third-trimester":
      return [
        routine(63, 112, 72, [hb(116), protein(0), glucose(4.6)]),
        routine(35, 114, 74, [hb(104)]),
        routine(7, 113, 73, [hb(107), protein(0)]),
      ];
    case "hypertension":
      return [
        routine(56, 124, 80, [hb(121), protein(0), glucose(4.7)]),
        routine(28, 136, 86),
        routine(5, 144, 92, [protein(0.1)]),
      ];
    case "severe-hypertension":
      return [
        routine(49, 138, 88, [hb(118), protein(0.1), glucose(4.8)]),
        routine(21, 150, 96, [protein(0.2)]),
        routine(2, 164, 112),
      ];
    case "pre-eclampsia":
      return [
        routine(42, 128, 82, [hb(117), protein(0), glucose(4.9)]),
        routine(14, 132, 84, [protein(0.1)]),
        routine(3, 146, 94, [protein(0.6)]),
      ];
    case "severe-anaemia":
      return [
        routine(56, 108, 68, [hb(96), protein(0), glucose(4.4)]),
        routine(28, 110, 70, [hb(82)]),
        routine(4, 109, 69, [hb(66)]),
      ];
    case "gdm-range":
      return [
        routine(56, 118, 76, [hb(122), protein(0), glucose(4.9)]),
        routine(6, 120, 78, [glucose(5.6)]),
      ];
    case "missing-labs":
      return [routine(30, 118, 76), routine(9, 120, 77)];
    case "not-assessed":
      return [];
    case "stale-bp":
      return [
        routine(98, 116, 74, [hb(121), protein(0), glucose(4.6)]),
        routine(70, 118, 75, [hb(120)]),
      ];
    case "demo":
      return [
        routine(56, 116, 74, [hb(118), protein(0), glucose(4.7)]),
        routine(28, 121, 78, [hb(117)]),
        routine(7, 128, 82, [hb(117), protein(0)]),
      ];
  }
}
