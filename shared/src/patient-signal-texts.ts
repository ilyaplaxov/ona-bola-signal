import type { Language } from "./common";
import type { SignalInstruction, SignalKind } from "./patient-signal";

// What the patient reads, in the Telegram bot and on the /signal page: one source for both.
// The 13 alarm signs follow the protocol's list (АУ с. 30); the wording is shortened for a button.
// Uzbek and Russian need a native speaker's check (TEAM_PLAN, participant 3).

export interface SignalTexts {
  kinds: Record<SignalKind, string>;
  instructions: Record<SignalInstruction, string>;
  /** Shown before linking; the patient must agree. */
  consent: string;
  agree: string;
  linked: string;
  menu: string;
  /** For an unknown, used or expired code. */
  badCode: string;
  /** For a chat that is not linked yet. */
  notLinked: string;
  tooMany: string;
}

export const SIGNAL_TEXTS: Record<Language, SignalTexts> = {
  uz: {
    kinds: {
      VOMITING_OVER_5: "5 martadan koʻp qusish",
      VAGINAL_BLEEDING: "Qindan qonli ajralma",
      WATERY_DISCHARGE: "Qindan koʻp suyuq ajralma",
      HEADACHE_VISION: "Doimiy bosh ogʻrigʻi, koʻz oldida dogʻlar",
      SUDDEN_EDEMA: "Qoʻl yoki yuz toʻsatdan shishdi",
      FEVER_38: "Harorat 38 °C va undan yuqori",
      VAGINAL_ITCH: "Qinda kuchli qichishish va achishish",
      DYSURIA: "Siyishda achishish va ogʻriq",
      ABDOMINAL_PAIN: "Qorinda kuchli, toʻxtamaydigan ogʻriq",
      CONTRACTIONS: "Bir soatda 4–5 dan ortiq toʻlgʻoq",
      ABDOMINAL_TRAUMA: "Qoringa zarba (yiqilish, avariya)",
      FETAL_MOVEMENT_CHANGE: "Bola juda kuchli yoki juda sust qimirlayapti",
      AMNIOTIC_LEAK: "Qogʻonoq suvi ketyapti",
      LABOUR_ONSET: "Tugʻruq boshlandi",
      CALL_BACK: "Boshqa savol — menga qoʻngʻiroq qiling",
    },
    instructions: {
      SEEK_CARE_NOW:
        "Zudlik bilan tibbiy yordamga murojaat qiling. Ahvolingiz ogʻir boʻlsa — 103 ga qoʻngʻiroq qiling. Shifokoringiz signalni oldi.",
      LABOUR: "103 ga qoʻngʻiroq qiling yoki tugʻruqxonaga boring. Shifokoringiz signalni oldi.",
      DOCTOR_WILL_CALL:
        "Signal qabul qilindi. Shifokoringiz siz bilan bogʻlanadi. Ahvolingiz yomonlashsa — 103 ga qoʻngʻiroq qiling.",
    },
    consent:
      "Signalingizni shifokoringiz koʻradi. Xabarlar internet orqali oʻtadi. Bu xizmat tez yordam oʻrnini bosmaydi: hayotingiz xavf ostida boʻlsa, 103 ga qoʻngʻiroq qiling.",
    agree: "Roziman",
    linked: "Ulandingiz. Biror narsa bezovta qilsa, quyidagi tugmani bosing.",
    menu: "Nima bezovta qilyapti?",
    badCode: "Kod notoʻgʻri yoki muddati oʻtgan. Shifokoringizdan yangi kod soʻrang.",
    notLinked: "Avval shifokoringiz bergan havola yoki kod orqali ulaning.",
    tooMany: "Signallar juda koʻp. Ahvolingiz ogʻir boʻlsa — 103 ga qoʻngʻiroq qiling.",
  },
  ru: {
    kinds: {
      VOMITING_OVER_5: "Рвота более 5 раз",
      VAGINAL_BLEEDING: "Кровянистые выделения",
      WATERY_DISCHARGE: "Обильные жидкие выделения",
      HEADACHE_VISION: "Постоянная головная боль, «мушки» в глазах",
      SUDDEN_EDEMA: "Внезапный отёк рук или лица",
      FEVER_38: "Температура 38 °C и выше",
      VAGINAL_ITCH: "Сильный зуд и жжение во влагалище",
      DYSURIA: "Жжение и боль при мочеиспускании",
      ABDOMINAL_PAIN: "Сильная боль в животе, не стихает",
      CONTRACTIONS: "Более 4–5 схваток за час",
      ABDOMINAL_TRAUMA: "Ушиб живота (падение, авария, удар)",
      FETAL_MOVEMENT_CHANGE: "Ребёнок шевелится слишком сильно или слабо",
      AMNIOTIC_LEAK: "Подтекают околоплодные воды",
      LABOUR_ONSET: "Начались роды",
      CALL_BACK: "Другой вопрос — перезвоните мне",
    },
    instructions: {
      SEEK_CARE_NOW:
        "Немедленно обратитесь за медицинской помощью. Если состояние тяжёлое — звоните 103. Ваш врач получил сигнал.",
      LABOUR: "Звоните 103 или поезжайте в родильный дом. Ваш врач получил сигнал.",
      DOCTOR_WILL_CALL: "Сигнал принят. Ваш врач свяжется с вами. Если станет хуже — звоните 103.",
    },
    consent:
      "Ваш сигнал увидит ваш врач. Сообщения передаются через интернет. Сервис не заменяет скорую помощь: при угрозе жизни звоните 103.",
    agree: "Согласна",
    linked: "Вы подключены. Если что-то беспокоит, нажмите кнопку ниже.",
    menu: "Что вас беспокоит?",
    badCode: "Код неверный или устарел. Попросите у врача новый.",
    notLinked: "Сначала подключитесь по ссылке или коду от вашего врача.",
    tooMany: "Слишком много сигналов. Если состояние тяжёлое — звоните 103.",
  },
  en: {
    kinds: {
      VOMITING_OVER_5: "Vomiting more than 5 times",
      VAGINAL_BLEEDING: "Bloody vaginal discharge",
      WATERY_DISCHARGE: "Heavy watery discharge",
      HEADACHE_VISION: "Constant headache, spots or flashes",
      SUDDEN_EDEMA: "Sudden swelling of hands or face",
      FEVER_38: "Temperature 38 °C or higher",
      VAGINAL_ITCH: "Strong vaginal itching and burning",
      DYSURIA: "Burning and pain when passing urine",
      ABDOMINAL_PAIN: "Severe belly pain that does not stop",
      CONTRACTIONS: "More than 4–5 contractions an hour",
      ABDOMINAL_TRAUMA: "Blow to the belly (fall, accident)",
      FETAL_MOVEMENT_CHANGE: "Baby moves far more or far less",
      AMNIOTIC_LEAK: "Waters leaking or broken",
      LABOUR_ONSET: "Labour has started",
      CALL_BACK: "Another question — call me back",
    },
    instructions: {
      SEEK_CARE_NOW:
        "Seek medical help immediately. If you feel very unwell, call 103. Your doctor has your signal.",
      LABOUR: "Call 103 or go to the maternity hospital. Your doctor has your signal.",
      DOCTOR_WILL_CALL:
        "Signal received. Your doctor will contact you. If you feel worse, call 103.",
    },
    consent:
      "Your doctor will see your signal. Messages travel over the internet. This does not replace an ambulance: if your life is in danger, call 103.",
    agree: "I agree",
    linked: "You are connected. If something worries you, press a button below.",
    menu: "What worries you?",
    badCode: "The code is wrong or has expired. Ask your doctor for a new one.",
    notLinked: "First connect with the link or code from your doctor.",
    tooMany: "Too many signals. If you feel very unwell, call 103.",
  },
};
