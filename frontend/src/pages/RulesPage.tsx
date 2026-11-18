import { useSession, useStrings } from "../app/session";
import { ZoneBadge } from "../components/ZoneBadge";
import { citationText, citationTitles, ruleLabel, weeksText } from "../i18n/format";
import { useRuleSet } from "../services/queries";

/** Transparency page: every rule the engine can apply, with its source (brief sections 6.1–6.2). */
export function RulesPage() {
  const s = useStrings();
  const { lang } = useSession();
  const ruleSet = useRuleSet();

  if (ruleSet.isPending) return <p className="text-slate-500">{s.common.loading}</p>;
  if (ruleSet.isError) return <p className="text-red-700">{s.common.loadError}</p>;
  const info = ruleSet.data;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{s.rules.title}</h1>
        <p className="mt-1 font-mono text-xs text-slate-500">
          {info.version} · {info.kind}
        </p>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">{s.rules.subtitle}</p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">{s.rules.colRule}</th>
              <th className="px-4 py-2.5 font-medium">{s.rules.colZone}</th>
              <th className="px-4 py-2.5 font-medium">{s.rules.colSource}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 align-top">
            {info.rules.map((rule) => (
              <tr key={rule.id}>
                <td className="px-4 py-3">
                  <div className="font-medium">{ruleLabel(rule.id, lang, rule.description)}</div>
                  <div className="mt-0.5 text-slate-600">{rule.description}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[11px] text-slate-400">
                    <span>
                      {rule.id} · {s.rules.kind[rule.kind]}
                    </span>
                    {rule.gestationalWeeks ? (
                      <span className="rounded bg-sky-50 px-1.5 py-0.5 font-sans text-xs text-sky-800">
                        {weeksText(rule.gestationalWeeks, lang)}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {rule.zone ? (
                    <ZoneBadge zone={rule.zone} />
                  ) : (
                    <span className="text-xs text-slate-500">{s.rules.reportOnly}</span>
                  )}
                </td>
                <td className="max-w-md px-4 py-3 text-xs text-slate-600">
                  {rule.source.citations ? (
                    <div
                      className="mb-1 font-medium text-slate-800"
                      title={citationTitles(rule.source.citations)}
                    >
                      {citationText(rule.source.citations, lang)}
                    </div>
                  ) : null}
                  <span className="mr-1 rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-900">
                    {rule.source.status}
                  </span>
                  {rule.source.ref}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
