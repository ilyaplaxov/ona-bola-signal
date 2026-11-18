import type { AnalyzeNoteResponse } from "@ona-bola/shared";
import { useState } from "react";
import { useCan } from "../app/auth";
import { useSession, useStrings } from "../app/session";
import { ApiError } from "../services/api";
import { useAiEnabled, useAnalyzeNote } from "../services/queries";
import { AiBadge } from "./AiBadge";
import { AiOffNotice } from "./AiOffNotice";

/**
 * Free-text note → Claude → values in the measurement form. Units are converted on the server,
 * in code. Nothing is saved here: the clinician checks the values and presses Save.
 */
export function AiNotePanel({
  patientId,
  onDraft,
}: {
  patientId: string;
  onDraft: (draft: AnalyzeNoteResponse["draft"]) => void;
}) {
  const s = useStrings();
  const { lang } = useSession();
  const aiOn = useAiEnabled();
  const allowed = useCan("AI_USE") && aiOn;
  const analyze = useAnalyzeNote(patientId);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");

  const run = () =>
    analyze.mutate({ note: note.trim(), language: lang }, { onSuccess: (r) => onDraft(r.draft) });

  const error =
    analyze.error instanceof ApiError && analyze.error.code === "ACTOR_REQUIRED"
      ? s.ai.noPermission
      : analyze.error
        ? s.ai.unavailable
        : null;
  const result = analyze.data;

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50 p-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="ai-note-body"
        className="flex w-full items-center justify-between gap-2 text-left text-sm font-semibold text-violet-900"
      >
        <span className="flex items-center gap-2">
          <AiBadge />
          {s.ai.noteToggle}
        </span>
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>

      {open ? (
        <div id="ai-note-body" className="mt-2 space-y-2">
          {aiOn ? null : <AiOffNotice />}
          <textarea
            id="ai-note"
            rows={3}
            maxLength={4000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={s.ai.notePlaceholder}
            aria-label={s.ai.noteToggle}
            className="w-full rounded-md border border-violet-200 bg-white px-2.5 py-1.5 text-sm focus:border-violet-600 focus:ring-1 focus:ring-violet-600 focus:outline-none"
          />
          <p className="text-xs text-violet-900/80">{s.ai.noteHint}</p>
          <button
            type="button"
            onClick={run}
            disabled={!allowed || note.trim() === "" || analyze.isPending}
            className="rounded-md bg-violet-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {analyze.isPending ? s.ai.analyzing : s.ai.analyze}
          </button>

          {error ? (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          ) : null}

          {result && !analyze.isPending ? (
            <div aria-live="polite" className="space-y-1 text-sm">
              <p className="font-medium text-violet-900">
                {result.draft.measurements.length > 0 ? s.ai.draftReady : s.ai.nothingFound}
              </p>
              {result.warnings.length > 0 ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5">
                  <p className="text-xs font-semibold text-amber-900">{s.ai.checkThese}:</p>
                  <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-xs text-amber-900">
                    {result.warnings.map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <p className="text-[11px] text-slate-500">
                {s.ai.model}: {result.model}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
