import { useSession } from "../app/session";

const LANGS = ["uz", "ru", "en"] as const;

/** UZ / RU / EN switch, shared by the app header and the sign-in page. */
export function LangSwitch() {
  const { lang, setLang } = useSession();
  return (
    <div className="flex overflow-hidden rounded-lg border border-slate-300 bg-white" role="group">
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`px-3 text-sm font-semibold ${
            lang === l ? "bg-rose-800 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
