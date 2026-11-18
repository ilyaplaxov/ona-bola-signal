import type { RiskZone } from "@ona-bola/shared";
import { useStrings } from "../app/session";

const STYLE: Record<RiskZone | "NONE", string> = {
  RED: "bg-red-600 text-white ring-red-700",
  YELLOW: "bg-amber-300 text-amber-950 ring-amber-500",
  GREEN: "bg-emerald-700 text-white ring-emerald-800", // emerald-600 gave only 3.8:1 with white
  NONE: "bg-slate-200 text-slate-700 ring-slate-300",
};

/** The zone exactly as the backend set it. Green with data gaps says so, never plain Green. */
export function ZoneBadge({
  zone,
  incomplete = false,
  large = false,
}: {
  zone: RiskZone | null;
  incomplete?: boolean;
  large?: boolean;
}) {
  const s = useStrings();
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap ring-1 ring-inset ${
        large ? "px-3.5 py-1 text-base" : "px-2.5 py-0.5 text-xs"
      } ${STYLE[zone ?? "NONE"]}`}
    >
      <span className={`rounded-full bg-current opacity-60 ${large ? "h-2 w-2" : "h-1.5 w-1.5"}`} />
      {s.zone[zone ?? "NOT_ASSESSED"]}
      {incomplete && zone === "GREEN" ? (
        <span className="font-normal opacity-90">· {s.zone.incomplete}</span>
      ) : null}
    </span>
  );
}
