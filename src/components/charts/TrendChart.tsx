import { MONTHS_SHORT } from "@/lib/types";
import { formatMoney } from "@/lib/utils";

interface Series {
  faturamento: number;
  despesas: number;
  lucro: number;
}

export function TrendChart({ series, highlight }: { series: Series[]; highlight?: number }) {
  const w = 640;
  const h = 240;
  const pad = 36;
  const max = Math.max(1000, ...series.flatMap((s) => [s.faturamento, s.lucro, s.despesas]));
  const x = (i: number) => pad + (i * (w - pad * 2)) / 11;
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2);

  function path(key: keyof Series) {
    return series.map((s, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(s[key])}`).join(" ");
  }

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full">
      <rect width={w} height={h} rx="16" fill="#0F172A" />
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <line
          key={t}
          x1={pad}
          x2={w - pad}
          y1={y(max * t)}
          y2={y(max * t)}
          stroke="#334155"
          strokeWidth="1"
        />
      ))}
      <path d={path("faturamento")} fill="none" stroke="#7B2CF5" strokeWidth="2.5" />
      <path d={path("lucro")} fill="none" stroke="#22C55E" strokeWidth="2.5" />
      <path d={path("despesas")} fill="none" stroke="#F97316" strokeWidth="2.5" />
      {series.map((s, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(s.faturamento)} r={highlight === i ? 5 : 3} fill="#7B2CF5" />
          <text x={x(i)} y={h - 12} textAnchor="middle" fill="#94A3B8" fontSize="10">
            {MONTHS_SHORT[i]}
          </text>
        </g>
      ))}
      <text x={pad} y={18} fill="#94A3B8" fontSize="11">
        Faturamento {formatMoney(max)} máx. · roxo faturamento · verde lucro · laranja despesas
      </text>
    </svg>
  );
}
