import { SignalKind, type SendSignalResponse, type SignalInstruction } from "@ona-bola/shared";
import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import { useSession, useStrings } from "../app/session";
import { LangSwitch } from "../components/LangSwitch";
import { LogoMark } from "./home/icons";
import { ApiError } from "../services/api";
import { redeemSignalCode, sendPatientSignal } from "../services/queries";

const TOKEN_KEY = "ona-bola.signal-token";

const readToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null; // storage blocked: the patient enters the code again next time
  }
};
const saveToken = (token: string | null) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // not remembered; the page still works for this visit
  }
};

const INSTRUCTION_TONE: Record<SignalInstruction, string> = {
  SEEK_CARE_NOW: "border-red-400 bg-red-50 text-red-950",
  LABOUR: "border-red-400 bg-red-50 text-red-950",
  DOCTOR_WILL_CALL: "border-emerald-400 bg-emerald-50 text-emerald-950",
};

/**
 * The patient's page (TEAM_PLAN item 7): no sign-in, no doctor shell. First visit: the code from
 * the doctor and consent. After that: one big button per sign, and the answer at once.
 * Not for emergencies: the page says so, and every answer repeats 103.
 */
export function SignalPage() {
  const s = useStrings();
  const { lang } = useSession();
  const [params] = useSearchParams();
  const [token, setToken] = useState<string | null>(readToken);
  const [code, setCode] = useState((params.get("code") ?? "").toUpperCase());
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [answer, setAnswer] = useState<SendSignalResponse | null>(null);
  const page = s.signal.page;

  async function link(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setProblem(null);
    try {
      const { token: issued } = await redeemSignalCode(code.replace(/\s/g, "").toUpperCase(), lang);
      saveToken(issued);
      setToken(issued);
    } catch {
      setProblem(page.invalidCode);
    } finally {
      setBusy(false);
    }
  }

  async function send(kind: SignalKind) {
    if (!token) return;
    setBusy(true);
    setProblem(null);
    try {
      setAnswer(await sendPatientSignal(token, kind));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        saveToken(null); // the code was withdrawn: ask for a new one
        setToken(null);
      }
      setProblem(page.sendFailed);
    } finally {
      setBusy(false);
    }
  }

  const big = "w-full rounded-2xl px-5 py-4 text-lg font-semibold leading-snug disabled:opacity-60";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <span className="block h-9 w-9 text-rose-800">
          <LogoMark />
        </span>
        <span className="text-lg font-extrabold text-rose-800">Ona-Bola Signal</span>
        <span className="ml-auto">
          <LangSwitch />
        </span>
      </header>

      <main className="mx-auto max-w-xl space-y-5 px-4 py-6">
        <h1 className="text-2xl font-bold">{page.title}</h1>
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 font-semibold text-red-900">
          {page.call103}
        </p>

        {answer ? (
          <div id="signal-answer" className="space-y-4">
            <div
              className={`rounded-2xl border-2 p-5 text-xl font-semibold leading-snug ${INSTRUCTION_TONE[answer.instruction]}`}
            >
              <p className="mb-2 text-base font-bold">{page.sent} ✓</p>
              {s.signal.instruction[answer.instruction]}
            </div>
            <a
              href="tel:103"
              className="block rounded-2xl bg-red-700 px-5 py-4 text-center text-lg font-bold text-white"
            >
              103
            </a>
            <button
              type="button"
              onClick={() => setAnswer(null)}
              className={`${big} border border-slate-300 bg-white text-center text-slate-800`}
            >
              {page.another}
            </button>
          </div>
        ) : token ? (
          <div className="space-y-3">
            <p className="text-lg">{page.choose}</p>
            {SignalKind.options.map((kind) => (
              <button
                key={kind}
                type="button"
                data-signal-kind={kind}
                disabled={busy}
                onClick={() => void send(kind)}
                className={`${big} border-2 border-rose-800 bg-white text-left text-rose-950 active:bg-rose-100`}
              >
                {s.signal.kinds[kind]}
              </button>
            ))}
            {problem ? (
              <p role="alert" className="text-red-800">
                {problem}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => {
                saveToken(null);
                setToken(null);
              }}
              className="text-base text-slate-500 underline"
            >
              {page.forget}
            </button>
          </div>
        ) : (
          <form onSubmit={(e) => void link(e)} className="space-y-4">
            <label className="block text-lg font-medium">
              {page.codeLabel}
              <input
                id="signal-code-input"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={12}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                className="mt-2 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 py-4 text-center font-mono text-3xl tracking-widest focus:border-rose-700"
              />
            </label>
            <label className="flex items-start gap-3 text-lg">
              <input
                id="signal-consent"
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 h-6 w-6 shrink-0"
              />
              <span>
                {page.consent} <strong>{page.agree}</strong>
              </span>
            </label>
            {problem ? (
              <p role="alert" className="text-red-800">
                {problem}
              </p>
            ) : null}
            <button
              type="submit"
              id="signal-next"
              disabled={busy || !agreed || code.replace(/\s/g, "").length < 8}
              className={`${big} bg-rose-800 text-center text-white disabled:bg-slate-300 disabled:text-slate-600`}
            >
              {page.next}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
