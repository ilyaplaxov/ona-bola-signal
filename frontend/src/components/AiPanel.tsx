import { useStrings } from "../app/session";
import { useAiEnabled } from "../services/queries";
import { AiChat } from "./AiChat";
import { AiExplanation } from "./AiExplanation";
import { AiOffNotice } from "./AiOffNotice";

/**
 * Everything Claude does for a patient, in one violet panel: the plain-language explanation of the
 * current assessment and the chat. The Risk Engine card next to it is green and says it alone sets
 * the zone; this panel says it never does. Both facts are on screen, so a doctor never has to guess
 * which part is a rule and which part is a model.
 */
export function AiPanel({
  patientId,
  assessmentId,
}: {
  patientId: string;
  assessmentId: string | null;
}) {
  const s = useStrings();
  const on = useAiEnabled();
  return (
    <section
      aria-labelledby="ai-panel-title"
      className="overflow-hidden rounded-2xl border border-violet-200 bg-white"
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-violet-700 px-5 py-3 text-white">
        <span className="rounded bg-white/20 px-2 py-0.5 text-xs font-bold tracking-wider">AI</span>
        <h2 id="ai-panel-title" className="text-lg font-semibold">
          {s.ai.chatTitle}
        </h2>
        <span
          data-ai-state={on ? "on" : "off"}
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${on ? "bg-white text-violet-800" : "bg-violet-900/40 text-violet-100"}`}
        >
          {on ? s.ai.statusOn : s.ai.statusOff}
        </span>
        <p className="text-sm text-violet-100 sm:ml-auto">{s.engine.aiNote}</p>
      </header>
      <div className="space-y-5 bg-gradient-to-b from-violet-50/70 to-white p-5">
        {on ? null : <AiOffNotice />}
        {assessmentId ? <AiExplanation patientId={patientId} assessmentId={assessmentId} /> : null}
        <AiChat key={patientId} patientId={patientId} />
      </div>
    </section>
  );
}
