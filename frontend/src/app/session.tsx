import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { STRINGS, type Lang, type Strings } from "../i18n/strings";
import { setApiActor } from "../services/api";

// Viewer settings: interface language and, only while the TEMP(auth) fallback in auth.tsx is in
// use, the demo user id sent in the demo-actor header. Who is signed in is answered by auth.tsx.
// Kept in localStorage as a convenience only; the app works when storage is unavailable.

interface Session {
  lang: Lang;
  setLang: (lang: Lang) => void;
  actorId: string | null;
  setActorId: (id: string | null) => void;
}

const SessionContext = createContext<Session | null>(null);

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the setting simply does not survive a reload.
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [lang, setLangState] = useState<Lang>(() => {
    const stored = readStored("ona-bola.lang");
    return stored === "ru" || stored === "en" ? stored : "uz";
  });
  const [actorId, setActorState] = useState<string | null>(() => {
    const stored = readStored("ona-bola.actor");
    setApiActor(stored);
    return stored;
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
    actorId,
    setActorId: (id) => {
      setApiActor(id);
      setActorState(id);
      writeStored("ona-bola.actor", id);
      // Each user sees a different set of patients: drop what the previous one loaded.
      void queryClient.invalidateQueries();
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
