import { useStrings } from "../app/session";
import { AiBadge } from "./AiBadge";

/** Shown where an AI control is, when the server has AI turned off: the place stays visible. */
export function AiOffNotice() {
  const s = useStrings();
  return (
    <p
      data-ai-off
      className="flex items-start gap-2 rounded-lg border border-dashed border-violet-300 bg-violet-50/60 px-3 py-2 text-sm text-violet-900"
    >
      <AiBadge />
      <span>{s.ai.offNotice}</span>
    </p>
  );
}
