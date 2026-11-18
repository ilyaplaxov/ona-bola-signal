import { formatNumber } from "../i18n/format";

/**
 * Small line chart of one indicator over time. Display only: it draws values, never thresholds,
 * because only the backend decides what is risky.
 */
export function TrendChart({
  title,
  unit,
  points,
}: {
  title: string;
  unit: string;
  points: { at: string; value: number }[];
}) {
  if (points.length < 2) return null;
  const width = 320;
  const height = 96;
  const pad = 18;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => pad + (i * (width - 2 * pad)) / (points.length - 1);
  const y = (v: number) => height - pad - ((v - min) / span) * (height - 2 * pad);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join(" ");

  return (
    <figure className="rounded-lg border border-slate-200 bg-white p-3">
      <figcaption className="text-xs font-medium text-slate-500">
        {title}, {unit}
      </figcaption>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-1 h-24 w-full"
        role="img"
        aria-label={`${title}: ${values.map(formatNumber).join(", ")} ${unit}`}
      >
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="text-rose-700"
        />
        {points.map((p, i) => (
          <g key={`${p.at}-${i}`}>
            <circle cx={x(i)} cy={y(p.value)} r={3.5} className="fill-rose-700" />
            <text
              x={x(i)}
              y={y(p.value) - 7}
              textAnchor="middle"
              className="fill-slate-600 text-[10px] font-medium"
            >
              {formatNumber(p.value)}
            </text>
          </g>
        ))}
      </svg>
    </figure>
  );
}
