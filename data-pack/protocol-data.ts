export interface ScheduledCheck {
  id: string;
  title: string;
  atWeeks: ReadonlyArray<"FIRST_VISIT" | readonly [number, number]>;
  appliesTo?: string;
  page: string;
}

export const LAB_SCHEDULE: readonly ScheduledCheck[] = [
  { id: "CBC", title: "Общий анализ крови (Hb)", atWeeks: ["FIRST_VISIT", [26, 26]], page: "АУ с.20, с.50" },
  { id: "URINALYSIS", title: "Общий анализ мочи", atWeeks: ["FIRST_VISIT", [26, 26]], page: "АУ с.21, с.50" },
  { id: "FASTING_GLUCOSE", title: "Глюкоза венозной плазмы натощак", atWeeks: ["FIRST_VISIT"], page: "АУ с.20" },
  { id: "OGTT_75G", title: "ПГТТ 75 г", atWeeks: [[26, 28]], page: "АУ с.20–21" },
  { id: "OGTT_75G_EARLY", title: "ПГТТ 75 г (группа риска ГСД)", atWeeks: ["FIRST_VISIT"], appliesTo: "GDM risk", page: "АУ с.20, с.53" },
  { id: "BLOOD_GROUP_RH", title: "Группа крови и резус", atWeeks: ["FIRST_VISIT"], page: "АУ с.19" },
  { id: "RH_ANTIBODIES", title: "Антирезусные антитела", atWeeks: ["FIRST_VISIT", [26, 28]], appliesTo: "Rh-negative", page: "АУ с.19, с.56" },
  { id: "ANTI_D", title: "Антирезус-иммуноглобулин", atWeeks: [[28, 30]], appliesTo: "Rh-negative, no antibodies", page: "АУ с.28, с.56" },
  { id: "HIV", title: "ВИЧ", atWeeks: ["FIRST_VISIT", [30, 30]], page: "АУ с.19" },
  { id: "HBSAG", title: "HBsAg", atWeeks: ["FIRST_VISIT", [30, 30]], page: "АУ с.19" },
  { id: "ANTI_HCV", title: "Anti-HCV", atWeeks: ["FIRST_VISIT", [30, 30]], page: "АУ с.19" },
  { id: "SYPHILIS", title: "Сифилис", atWeeks: ["FIRST_VISIT", [30, 30]], page: "АУ с.20" },
  { id: "URINE_CULTURE", title: "Посев мочи (бессимптомная бактериурия)", atWeeks: [[12, 16]], page: "АУ с.20, с.51" },
  { id: "US_T1", title: "УЗИ + скрининг 1-го триместра (ТВП, ХГ, PAPP-A)", atWeeks: [[11, 13.86]], page: "АУ с.22–23" },
  { id: "US_T2", title: "УЗИ 2-го триместра + длина шейки матки", atWeeks: [[18, 20.86]], page: "АУ с.22" },
];

export interface MonitoringRule {
  group: string;
  rule: string;
  everyDays?: number;
  page: string;
}

export const RISK_GROUP_MONITORING: readonly MonitoringRule[] = [
  { group: "АГ, плохо контролируемая", rule: "Визит не реже 2 раз в неделю", everyDays: 4, page: "АУ с.35" },
  { group: "АГ, хорошо контролируемая", rule: "Визит 1 раз в неделю", everyDays: 7, page: "АУ с.35" },
  { group: "АГ любая", rule: "УЗИ роста плода, ОПВ, допплер артерии пуповины каждые 2–4 нед", everyDays: 28, page: "АУ с.35" },
  { group: "СД любой формы", rule: "Контакт с клиникой и эндокринологом каждые 1–2 нед", everyDays: 14, page: "АУ с.32" },
  { group: "Высокий риск ПЭ", rule: "Протеинурия при каждом визите, ежедневный самоконтроль АД", page: "АУ с.34" },
  { group: "Высокий риск ЗРП (≥1 большой фактор)", rule: "УЗ-фетометрия + допплер каждые 3 нед с 26–28 нед", everyDays: 21, page: "АУ с.40" },
  { group: "Риск ЗРП (≥3 малых фактора)", rule: "УЗ-фетометрия + допплер в 20–24 нед, при норме — в 30–34 нед", page: "АУ с.40" },
  { group: "ЖДА", rule: "ОАК: I триместр, ежемесячно во II, дважды в III", everyDays: 30, page: "ЖДА с.14" },
  { group: "ЖДА на пероральном железе", rule: "Контроль Hb через 2 нед (ожидается +10 г/л)", everyDays: 14, page: "ЖДА с.18–19" },
  { group: "После курса железа", rule: "Hb ежемесячно в течение года", everyDays: 30, page: "ЖДА с.21" },
  { group: "ПР в анамнезе", rule: "Длина шейки с 14–16 до 24 нед: каждые 2 нед при ≥30 мм, еженедельно при 25–29 мм", page: "АУ с.22–23" },
  { group: "Все", rule: "ВДМ при каждом визите после 20 нед, не чаще раза в 2 нед", page: "АУ с.17" },
  { group: "Все", rule: "Переоценка риска ВТЭО и ПРК при каждом визите", page: "АУ с.38" },
];

export const ALARM_SIGNS: readonly { id: string; ru: string }[] = [
  { id: "VOMITING_OVER_5", ru: "Чрезмерная рвота (более 5 раз)" },
  { id: "VAGINAL_BLEEDING", ru: "Кровянистые выделения из половых путей" },
  { id: "WATERY_DISCHARGE", ru: "Обильные жидкие выделения из влагалища" },
  { id: "HEADACHE_VISION", ru: "Постоянная головная боль, нарушение зрения (пятна, вспышки)" },
  { id: "SUDDEN_EDEMA", ru: "Внезапный и быстро нарастающий отёк рук или лица" },
  { id: "FEVER_38", ru: "Температура 38 °C и выше" },
  { id: "VAGINAL_ITCH", ru: "Сильный зуд и жжение во влагалище, усилившиеся выделения" },
  { id: "DYSURIA", ru: "Жжение и боль при мочеиспускании" },
  { id: "ABDOMINAL_PAIN", ru: "Сильная не стихающая боль в животе, даже в покое" },
  { id: "CONTRACTIONS", ru: "Более 4–5 схваток в течение часа" },
  { id: "ABDOMINAL_TRAUMA", ru: "Ушиб живота (падение, авария, удар)" },
  { id: "FETAL_MOVEMENT_CHANGE", ru: "Слишком бурное или слабое шевеление плода после 24 нед" },
  { id: "AMNIOTIC_LEAK", ru: "Излитие или подтекание околоплодных вод" },
];
export const ALARM_SIGNS_PAGE = "АУ с.30, с.60";

export const SEVERE_PREECLAMPSIA_SIGNS: readonly { id: string; ru: string; threshold?: string }[] = [
  { id: "REPEATED_SEVERE_HTN", ru: "Повторные эпизоды ≥160/110 несмотря на 3 класса препаратов" },
  { id: "THROMBOCYTOPENIA", ru: "Тромбоциты", threshold: "<150 000/мкл" },
  { id: "HEMOLYSIS", ru: "Гемолиз, ЛДГ", threshold: ">600 МЕ/л" },
  { id: "LIVER_ENZYMES", ru: "Печёночные ферменты", threshold: ">40 МЕ/л" },
  { id: "RUQ_PAIN", ru: "Постоянная боль в правом подреберье / эпигастрии" },
  { id: "NAUSEA_VOMITING", ru: "Тошнота, рвота" },
  { id: "CREATININE", ru: "Креатинин сыворотки", threshold: ">90 мкмоль/л" },
  { id: "OLIGURIA", ru: "Олигурия", threshold: "<80 мл за 4 ч" },
  { id: "HEADACHE", ru: "Головная боль, не купируемая анальгетиками" },
  { id: "VISUAL", ru: "Нарушение зрения (мушки, скотома)" },
  { id: "PULMONARY_EDEMA", ru: "Отёк лёгких" },
];
export const SEVERE_PREECLAMPSIA_PAGE = "АУ с.36";

export const QUALITY_CRITERIA: readonly string[] = [
  "Срок беременности и родов определён при 1-м визите",
  "АД измерено при каждом визите",
  "ВДМ измерена при каждом визите и ведётся гравидограмма после 20 нед",
  "ЧСС плода определена при каждом визите после 20 нед (стетоскоп) или после 12 нед (допплер)",
  "Оценён риск ПЭ, акушерских кровотечений, ВТЭО, ГСД, ЗРП",
  "ВИЧ при 1-м визите и в 30 нед",
  "HBsAg при 1-м визите и в 30 нед",
  "Сифилис при 1-м визите и в 30 нед",
  "Посев мочи на бактериурию при 1-м визите",
  "Группа крови и резус при 1-м визите",
  "Rh-отрицательным: антитела при 1-м визите и в 26–28 нед",
  "ОАК при 1-м визите и в 26 нед",
  "Глюкоза при 1-м визите и ПГТТ 75 г в 26–28 нед",
  "ОАМ при 1-м визите и в 26 нед",
  "УЗИ и скрининг 1-го триместра в 11–13+6 нед",
  "Фолиевая кислота 400 мкг до 12 нед",
  "Анти-D иммуноглобулин в 28–30 нед Rh-отрицательным без антител",
  "Препараты железа 30–60 мг/сут всю беременность",
];
export const QUALITY_CRITERIA_PAGE = "АУ с.42–44";
