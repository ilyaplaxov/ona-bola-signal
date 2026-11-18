import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { STRINGS, type Lang, type Strings } from "../i18n/strings";

// Viewer settings: the interface language. Who is signed in is answered by auth.tsx.
// Kept in localStorage as a convenience only; the app works when storage is unavailable.

interface Session {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

const SessionContext = createContext<Session | null>(null);

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the setting simply does not survive a reload.
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const stored = readStored("ona-bola.lang");
    return stored === "ru" || stored === "en" ? stored : "uz";
  });

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value: Session = {
    lang,
    setLang: (next) => {
      setLangState(next);
      writeStored("ona-bola.lang", next);
    },
  };
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside SessionProvider");
  return session;
}

export function useStrings(): Strings {
  return STRINGS[useSession().lang];
}
