import {
  Language,
  SIGNAL_BUTTON_ORDER,
  SIGNAL_TEXTS,
  SignalKind,
  SignalLinkCode,
  type SignalTexts,
} from "@ona-bola/shared";
import type { Database } from "../db/client";
import {
  bindingForChat,
  bindingNames,
  receiveSignal,
  redeemLinkCode,
  revokeBinding,
  setBindingLanguage,
  TooManySignalsError,
} from "../services/signal.service";

// Telegram bot for patient signals (TEAM_PLAN section 2a). Long polling over the Bot API with
// fetch: no public server and no extra dependency. Buttons only; the bot never asks for a name or
// phone number and never sends a diagnosis, a zone or a lab value.

/** The few Bot API shapes the bot reads. */
export interface TelegramUpdate {
  update_id: number;
  message?: {
    chat: { id: number; type: string };
    from?: { language_code?: string };
    text?: string;
  };
  callback_query?: {
    id: string;
    from: { language_code?: string };
    message?: { chat: { id: number; type: string } };
    data?: string;
  };
}

export interface TelegramApi {
  call<T = unknown>(
    method: string,
    body?: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<T>;
}

/** Bot API client. The token is only in the URL and never logged. */
export function telegramApi(token: string, fetchImpl: typeof fetch = fetch): TelegramApi {
  return {
    async call<T>(method: string, body: Record<string, unknown> = {}, signal?: AbortSignal) {
      const response = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        result?: T;
        description?: string;
      } | null;
      if (!json?.ok) {
        throw new Error(
          `Telegram ${method} failed (${response.status}): ${json?.description ?? "no body"}`,
        );
      }
      return json.result as T;
    },
  };
}

const LANGUAGE_BUTTONS = [
  { text: "Oʻzbekcha", callback_data: "lang:uz" },
  { text: "Русский", callback_data: "lang:ru" },
];

function menuKeyboard(t: SignalTexts) {
  return {
    inline_keyboard: [
      ...SIGNAL_BUTTON_ORDER.map((kind) => [{ text: t.kinds[kind], callback_data: `sig:${kind}` }]),
      LANGUAGE_BUTTONS,
    ],
  };
}

/** uz unless Telegram says the user's app is in Russian or English. */
export function languageFrom(code: string | undefined): Language {
  if (code?.startsWith("ru")) return "ru";
  if (code?.startsWith("en")) return "en";
  return "uz";
}

/**
 * The bot's profile and command menu in each language (Telegram shows the one matching the
 * user's app language; Uzbek is the default). Run at startup; changes only this bot's settings.
 */
export async function configureBot(api: TelegramApi): Promise<void> {
  for (const language of Language.options) {
    const t = SIGNAL_TEXTS[language];
    const scope = language === "uz" ? {} : { language_code: language };
    await api.call("setMyCommands", {
      commands: [
        { command: "menu", description: t.commands.menu },
        { command: "stop", description: t.commands.stop },
      ],
      ...scope,
    });
    await api.call("setMyDescription", { description: t.botDescription, ...scope });
    await api.call("setMyShortDescription", {
      short_description: t.botShortDescription,
      ...scope,
    });
  }
}

/** Handles one update. Exported for tests, which feed updates and read the calls made. */
export function createBotHandler(deps: { db: Database; api: TelegramApi; clock: () => Date }) {
  const { db, api, clock } = deps;
  const send = (chatId: number, text: string, extra: Record<string, unknown> = {}) =>
    api.call("sendMessage", { chat_id: chatId, text, ...extra });
  const showMenu = (chatId: number, t: SignalTexts, header?: string) =>
    send(chatId, header ? `${header}\n\n${t.menu}` : t.menu, { reply_markup: menuKeyboard(t) });
  /** "Hello, <her name>! Your doctor: <name>." for a linked chat. */
  const greet = async (patientId: string, t: SignalTexts) => {
    const { patientName, doctorName } = await bindingNames(db, patientId);
    return patientName ? t.greeting(patientName, doctorName) : undefined;
  };

  async function onMessage(msg: NonNullable<TelegramUpdate["message"]>): Promise<void> {
    if (msg.chat.type !== "private") return;
    const chatId = msg.chat.id;
    const binding = await bindingForChat(db, String(chatId));
    const t = SIGNAL_TEXTS[binding?.language ?? languageFrom(msg.from?.language_code)];
    const [command, argument] = (msg.text ?? "").trim().split(/\s+/, 2);

    if (command === "/start" && argument) {
      const code = SignalLinkCode.safeParse(argument);
      if (!code.success) return void (await send(chatId, t.badCode));
      // Consent first; the code is redeemed only when she agrees.
      await send(chatId, t.consent, {
        reply_markup: {
          inline_keyboard: [[{ text: t.agree, callback_data: `agree:${code.data}` }]],
        },
      });
      return;
    }
    if (command === "/stop") {
      if (binding) {
        await revokeBinding(db, binding, clock());
        await send(chatId, t.unlinked);
      } else await send(chatId, t.notLinked);
      return;
    }
    // /start without a code, /menu, or any text: greeting and the buttons again.
    if (binding) await showMenu(chatId, t, await greet(binding.patientId, t));
    else await send(chatId, t.notLinked);
  }

  async function onCallback(cb: NonNullable<TelegramUpdate["callback_query"]>): Promise<void> {
    const chat = cb.message?.chat;
    await api.call("answerCallbackQuery", { callback_query_id: cb.id });
    if (!chat || chat.type !== "private") return;
    const chatId = chat.id;
    const [action, value] = (cb.data ?? "").split(":", 2);
    const binding = await bindingForChat(db, String(chatId));
    const language = binding?.language ?? languageFrom(cb.from.language_code);
    const t = SIGNAL_TEXTS[language];

    if (action === "agree" && value) {
      const result = await redeemLinkCode(db, {
        code: value,
        channel: "TELEGRAM",
        telegramChatId: String(chatId),
        language,
        now: clock(),
      });
      if (!result) return void (await send(chatId, t.badCode));
      const hello = await greet(result.binding.patientId, t);
      await send(chatId, hello ? `${hello}\n\n${t.linked}` : t.linked);
      await showMenu(chatId, t);
      return;
    }

    if (!binding) return void (await send(chatId, t.notLinked));

    if (action === "lang") {
      const next = Language.safeParse(value);
      if (!next.success) return;
      await setBindingLanguage(db, binding.id, next.data);
      const nt = SIGNAL_TEXTS[next.data];
      await showMenu(chatId, nt, await greet(binding.patientId, nt));
      return;
    }

    if (action === "sig") {
      const kind = SignalKind.safeParse(value);
      if (!kind.success) return;
      try {
        const result = await receiveSignal(db, { binding, kind: kind.data, now: clock() });
        const { doctorName } = await bindingNames(db, binding.patientId);
        const lines = [t.kinds[kind.data], "", t.instructions[result.instruction]];
        if (doctorName) lines.push(t.doctorLine(doctorName));
        await send(chatId, lines.join("\n"));
      } catch (error) {
        if (error instanceof TooManySignalsError) await send(chatId, t.tooMany);
        else throw error;
      }
    }
  }

  return async function handle(update: TelegramUpdate): Promise<void> {
    if (update.message) await onMessage(update.message);
    else if (update.callback_query) await onCallback(update.callback_query);
  };
}

/**
 * Polls getUpdates until stopped. A failing update is logged and skipped (one bad message must
 * not stop the bot); a failing poll waits 5 seconds and retries.
 */
export function startPolling(deps: {
  api: TelegramApi;
  handle: (update: TelegramUpdate) => Promise<void>;
  log?: (message: string) => void;
}): { stop: () => void } {
  const log = deps.log ?? ((m: string) => console.warn(m));
  const controller = new AbortController();
  let offset = 0;

  void (async () => {
    while (!controller.signal.aborted) {
      try {
        const updates = await deps.api.call<TelegramUpdate[]>(
          "getUpdates",
          { offset, timeout: 25, allowed_updates: ["message", "callback_query"] },
          controller.signal,
        );
        for (const update of updates) {
          offset = update.update_id + 1;
          try {
            await deps.handle(update);
          } catch (error) {
            log(`Telegram bot: update ${update.update_id} failed: ${(error as Error).message}`);
          }
        }
      } catch (error) {
        if (controller.signal.aborted) break;
        log(`Telegram bot: polling failed: ${(error as Error).message}; retrying in 5 s`);
        await new Promise((r) => setTimeout(r, 5_000));
      }
    }
  })();

  return { stop: () => controller.abort() };
}
