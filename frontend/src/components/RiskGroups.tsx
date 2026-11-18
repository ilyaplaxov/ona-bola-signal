import type { RiskGroup } from "@ona-bola/shared";
import { useSession, useStrings } from "../app/session";
import { citationText, citationTitles, riskFactorLabel } from "../i18n/format";

// Risk groups from the anamnesis (antenatal protocol, pp. 33–41), worked out by the server.
// Deliberately blue, never red, amber or green: a profile, not a zone.

const raisedOnly = (groups: RiskGroup[]) => groups.filter((g) => g.level !== "LOW");

/** Small chips for the patient header: one per raised risk group. */
export function RiskGroupChips({ groups }: { groups: RiskGroup[] | null | undefined }) {
  const s = useStrings();
  if (!groups) return null;
  const raised = raisedOnly(groups);
  if (raised.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {raised.map((g) => (
        <span
          key={g.scale}
          className="rounded-full border border-sky-300 bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-900"
        >
          {s.riskGroups.scale[g.scale]}: {s.riskGroups.level[g.level]}
        </span>
      ))}
    </div>
  );
}

/** The raised groups with their factors, the protocol's actions and the pages they come from. */
export function RiskGroups({ groups }: { groups: RiskGroup[] | null | undefined }) {
  const s = useStrings();
  const { lang } = useSession();
  if (groups === undefined) return null;
  if (groups === null) return <p className="text-sm text-slate-600">{s.riskGroups.notRecorded}</p>;
  const raised = raisedOnly(groups);

  return (
    <div className="space-y-3">
      {raised.length === 0 ? (
        <p className="text-sm text-slate-600">{s.riskGroups.noneRaised}</p>
      ) : (
        <ul className="space-y-3">
          {raised.map((g) => {
            const citations = g.source.citations;
            return (
              <li key={g.scale} className="rounded-lg border border-sky-200 bg-sky-50/60 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-900">{s.riskGroups.scale[g.scale]}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      g.level === "HIGH" ? "bg-sky-800 text-white" : "bg-sky-200 text-sky-900"
                    }`}
                  >
                    {s.riskGroups.level[g.level]}
                    {g.score !== undefined ? ` · ${g.score} ${s.riskGroups.points}` : ""}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-600">
                  {s.riskGroups.factors}:{" "}
                  {g.matched.map((f) => riskFactorLabel(f, lang)).join(", ")}
                </div>
                <p className="mt-1.5 text-xs font-medium text-slate-500">
                  {s.riskGroups.actionsLabel}
                </p>
                <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-sm text-slate-800">
                  {g.actions.map((a) => (
                    <li key={a}>{s.riskGroups.action[a]}</li>
                  ))}
                </ul>
                {citations ? (
                  <div className="mt-1.5 text-xs text-slate-500" title={citationTitles(citations)}>
                    {s.patient.source}: {citationText(citations, lang)}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-slate-400">{s.riskGroups.note}</p>
    </div>
  );
}
