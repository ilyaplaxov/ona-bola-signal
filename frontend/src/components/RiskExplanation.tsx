import type { RiskAssessment, RuleInfo } from "@ona-bola/shared";
import { useSession, useStrings } from "../app/session";
import {
  capitalize,
  citationText,
  citationTitles,
  formatDateTime,
  observedText,
  ruleLabel,
  trendPath,
} from "../i18n/format";
import { MEASURE_LABELS, type Lang, type Strings } from "../i18n/strings";
import { useRuleSet } from "../services/queries";
import { ZoneBadge } from "./ZoneBadge";

/** "Manba: «Антенатальный уход» milliy protokoli, 34-bet" under a reason, from the rule's citations. */
function SourceLine({
  rule,
  lang,
  s,
  className,
}: {
  rule: RuleInfo | undefined;
  lang: Lang;
  s: Strings;
  className: string;
}) {
  if (!rule) return null;
  const citations = rule.source.citations;
  return (
    <div className={className} title={citations ? citationTitles(citations) : undefined}>
      {s.patient.source}: {citations ? citationText(citations, lang) : s.patient.noProtocolSource}
    </div>
  );
}

/** Brief section 5.4: never show a zone without the reasons, data gaps and trends behind it. */
export function RiskExplanation({ assessment }: { assessment: RiskAssessment }) {
  const s = useStrings();
  const { lang } = useSession();
  // Sources come from the active rule set (GET /api/ruleset), matched by rule id. Until it loads,
  // or for a rule it no longer has, the reason simply shows no source line.
  const ruleSet = useRuleSet();
  const rules = new Map((ruleSet.data?.rules ?? []).map((r) => [r.id, r]));
  const cited = assessment.reasons.some((r) => rules.get(r.ruleId)?.source.citations);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <ZoneBadge zone={assessment.zone} incomplete={assessment.dataWarnings.length > 0} large />
        <span className="text-sm text-slate-500">
          {s.patient.assessedAt}: {formatDateTime(assessment.assessedAt, lang)}
        </span>
        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">
          {s.patient.ruleSet} {assessment.ruleSetVersion}
          {assessment.ruleSetKind === "ILLUSTRATIVE" ? ` · ${s.patient.illustrative}` : ""}
        </span>
      </div>

      <section>
        <h3 className="text-sm font-semibold text-slate-700">{s.patient.reasons}</h3>
        {assessment.reasons.length === 0 ? (
          <p className="mt-1 text-sm text-slate-600">{s.patient.noReasons}</p>
        ) : (
          <>
            <ul className="mt-2 space-y-2">
              {assessment.reasons.map((reason) => (
                <li
                  key={reason.ruleId}
                  className={`rounded-lg border-l-4 bg-white px-3 py-2 text-sm shadow-sm ${
                    reason.zone === "RED" ? "border-red-600" : "border-amber-400"
                  }`}
                >
                  <div className="font-medium text-slate-900">
                    {ruleLabel(reason.ruleId, lang, reason.text)}
                  </div>
                  <div className="mt-0.5 text-slate-600">
                    {reason.observed.map((o) => observedText(o, lang)).join(" · ")}
                  </div>
                  <SourceLine
                    rule={rules.get(reason.ruleId)}
                    lang={lang}
                    s={s}
                    className="mt-1 text-xs text-slate-500"
                  />
                  <div className="mt-0.5 font-mono text-[11px] text-slate-400">{reason.ruleId}</div>
                </li>
              ))}
            </ul>
            {cited ? (
              <p className="mt-2 text-xs text-slate-400">{s.patient.protocolsNote}</p>
            ) : null}
          </>
        )}
      </section>

      {assessment.dataWarnings.length > 0 ? (
        <section>
          <h3 className="text-sm font-semibold text-slate-700">{s.patient.warnings}</h3>
          <ul className="mt-2 space-y-1 text-sm text-amber-900">
            {assessment.dataWarnings.map((w, i) => {
              const rule = w.ruleId ? rules.get(w.ruleId) : undefined;
              return (
                <li key={`${w.ruleId ?? "x"}-${i}`} className="flex gap-2">
                  <span aria-hidden>⚠</span>
                  <div>
                    <div>{ruleLabel(w.ruleId, lang, w.text)}</div>
                    {rule?.source.citations ? (
                      <SourceLine
                        rule={rule}
                        lang={lang}
                        s={s}
                        className="text-xs text-amber-800/70"
                      />
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {assessment.trendFindings.length > 0 ? (
        <section>
          <h3 className="text-sm font-semibold text-slate-700">{s.patient.trends}</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {assessment.trendFindings.map((f) => {
              const measure = capitalize(MEASURE_LABELS[f.measure][lang]);
              const status =
                f.status === "INSUFFICIENT_HISTORY"
                  ? s.patient.insufficient
                  : f.status === "TRIGGERED"
                    ? f.text.includes(" fell ")
                      ? s.patient.falling
                      : s.patient.rising
                    : s.patient.stable;
              return (
                <li
                  key={f.ruleId}
                  className={f.status === "TRIGGERED" ? "text-slate-900" : "text-slate-500"}
                >
                  <span className="font-medium">{measure}</span>: {status}
                  {f.status === "INSUFFICIENT_HISTORY" ? "" : ` (${trendPath(f.text, lang)})`}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
