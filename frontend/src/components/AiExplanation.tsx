import type { ExplainRiskResponse } from "@ona-bola/shared";
import { useState } from "react";
import { useCan } from "../app/auth";
import { useSession, useStrings } from "../app/session";
import { formatDateTime } from "../i18n/format";
import { useAiEnabled, useExplainRisk } from "../services/queries";
import { AiBadge } from "./AiBadge";

/**
 * Plain-language explanation of the current assessment, written by Claude on request. It sits
 * under the engine's own reasons, is labelled as AI text, and never shows or changes a zone.
 */
export function AiExplanation({
  patientId,
  assessmentId,
}: {
  patientId: string;
  assessmentId: string;
}) {
  const s = useStrings();
  const { lang } = useSession();
  const allowed = useCan("AI_USE") && useAiEnabled();
  const explain = useExplainRisk(patientId);
  const [results, setResults] = useState<Record<string, ExplainRiskResponse>>({});
  const shown = results[`${assessmentId}:${lang}`];

  const run = () => {
    const language = lang;
    explain.mutate(
      { language },
      {
        onSuccess: (r) => setResults((all) => ({ ...all, [`${r.assessmentId}:${language}`]: r })),
      },
    );
  };

  if (shown) {
    return (
      <div aria-live="polite" className="rounded-lg border border-violet-200 bg-violet-50 p-3">
        <p className="flex items-center gap-2 text-xs text-violet-900">
          <AiBadge />
          {s.ai.explainNote}
        </p>
        <p className="mt-2 text-sm text-slate-800">{shown.summary}</p>
        {shown.keyPoints.length > 0 ? (
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-slate-700">
            {shown.keyPoints.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        ) : null}
        <p className="mt-2 text-[11px] text-slate-500">
          {s.ai.model}: {shown.model} · {formatDateTime(shown.generatedAt, lang)}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        id="ai-explain"
        onClick={run}
        disabled={!allowed || explain.isPending}
        title={allowed ? undefined : s.ai.offShort}
        className="inline-flex items-center gap-2 rounded-md border border-violet-300 bg-white px-3 py-1.5 text-sm font-semibold text-violet-800 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <AiBadge />
        {explain.isPending ? s.ai.explaining : s.ai.explain}
      </button>
      {explain.isError ? (
        <p role="alert" className="text-sm text-slate-600">
          {s.ai.explainUnavailable}
        </p>
      ) : null}
    </div>
  );
}
