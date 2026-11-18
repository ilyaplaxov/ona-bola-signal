import type { ChatMessage } from "@ona-bola/shared";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useCan } from "../app/auth";
import { useSession, useStrings } from "../app/session";
import { useAiChat, useAiEnabled } from "../services/queries";

/** The API accepts up to 12 messages; older turns are dropped in pairs so the chat starts with a question. */
const MAX_SENT = 11;

/**
 * A short chat with Claude about this patient's record. The browser keeps the conversation (it is
 * never stored); the server sends Claude only de-identified data and audits that a question was
 * answered, not its text. Answers are labelled as AI and never set or change a zone.
 */
export function AiChat({ patientId }: { patientId: string }) {
  const s = useStrings();
  const { lang } = useSession();
  const roleOk = useCan("AI_USE");
  const allowed = roleOk && useAiEnabled();
  const chat = useAiChat(patientId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [messages, chat.isPending]);

  function ask(question: string) {
    const text = question.trim();
    if (!text || chat.isPending) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setDraft("");
    chat.mutate(
      { messages: next.slice(-MAX_SENT), language: lang },
      {
        onSuccess: (r) => setMessages([...next, { role: "assistant", content: r.answer }]),
        onError: () => {
          setMessages(messages);
          setDraft(text);
        },
      },
    );
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    ask(draft);
  };

  return (
    <div>
      {/* the panel around it (AiPanel) carries the title and the AI mark */}
      <p className="text-sm text-violet-900">{s.ai.chatHint}</p>
      {messages.length > 0 ? (
        <div className="mt-1 flex justify-end">
          <button
            type="button"
            onClick={() => {
              setMessages([]);
              chat.reset();
            }}
            className="text-sm text-slate-500 hover:text-slate-800"
          >
            {s.ai.chatClear}
          </button>
        </div>
      ) : null}

      <div className="mt-3 max-h-80 space-y-2 overflow-y-auto" aria-live="polite">
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "ml-8 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-900"
                : "mr-8 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm whitespace-pre-line text-slate-800"
            }
          >
            <span className="mb-0.5 block text-[11px] font-semibold text-slate-500">
              {m.role === "user" ? s.ai.chatYou : "AI"}
            </span>
            {m.content}
          </div>
        ))}
        {chat.isPending ? <p className="text-sm text-violet-800">{s.ai.chatThinking}</p> : null}
        <div ref={end} />
      </div>

      {messages.length === 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {s.ai.chatSuggestions.map((q) => (
            <button
              key={q}
              type="button"
              disabled={!allowed || chat.isPending}
              onClick={() => ask(q)}
              className="rounded-full border border-violet-300 bg-white px-3 py-1 text-xs font-medium text-violet-800 hover:bg-violet-50 disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      ) : null}

      {chat.isError ? (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {s.ai.chatUnavailable}
        </p>
      ) : null}
      {!roleOk ? <p className="mt-2 text-sm text-amber-800">{s.ai.noPermission}</p> : null}

      <form onSubmit={onSubmit} className="mt-3 flex gap-2">
        <input
          id="ai-chat-input"
          value={draft}
          maxLength={2000}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={s.ai.chatPlaceholder}
          aria-label={s.ai.chatPlaceholder}
          className="min-w-0 flex-1 rounded-md border border-violet-200 px-2.5 py-1.5 text-sm focus:border-violet-600 focus:ring-1 focus:ring-violet-600 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!allowed || chat.isPending || draft.trim() === ""}
          className="rounded-md bg-violet-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {s.ai.chatSend}
        </button>
      </form>
    </div>
  );
}
