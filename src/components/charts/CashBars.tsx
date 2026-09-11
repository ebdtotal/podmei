import { useId, useMemo, useState } from "react";
import { MONTHS_SHORT } from "@/lib/types";
import { formatMoney } from "@/lib/utils";

type Point = { label: string; entradas: number; saidas: number; saldo?: number };

function compactMoney(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? "-" : ""}R$ ${(abs / 1_000_000).toFixed(1)} mi`;
  if (abs >= 1_000) return `${n < 0 ? "-" : ""}R$ ${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1)} mil`;
  return formatMoney(n);
}

/** Gráfico moderno: barras + linha de saldo, tooltip e tipografia do app. */
export function CashBars({ points, title }: { points: Point[]; title?: string }) {
  const gid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);

  const w = 720;
  const h = 280;
  const padL = 52;
  const padR = 20;
  const padT = 36;
  const padB = 44;

  const { max, hasSaldo, saldoMin, saldoMax } = useMemo(() => {
    const barMax = Math.max(100, ...points.flatMap((p) => [p.entradas, p.saidas]));
    const saldos = points.map((p) => p.saldo).filter((v): v is number => v != null);
    const has = saldos.length > 0;
    const sMin = has ? Math.min(0, ...saldos) : 0;
    const sMax = has ? Math.max(barMax, ...saldos) : barMax;
    return { max: barMax, hasSaldo: has, saldoMin: sMin, saldoMax: Math.max(sMax, 100) };
  }, [points]);

  const n = Math.max(1, points.length);
  const slot = (w - padL - padR) / n;
  const barW = Math.min(22, Math.max(8, slot * 0.28));
  const chartH = h - padT - padB;
  const yBar = (v: number) => padT + (1 - Math.min(v, max) / max) * chartH;
  const ySaldo = (v: number) => {
    const span = saldoMax - saldoMin || 1;
    return padT + (1 - (v - saldoMin) / span) * chartH;
  };

  const saldoPath = hasSaldo
    ? points
        .map((p, i) => {
          const cx = padL + slot * i + slot / 2;
          const val = p.saldo ?? 0;
          return `${i === 0 ? "M" : "L"} ${cx} ${ySaldo(val)}`;
        })
        .join(" ")
    : "";

  const active = hover != null ? points[hover] : null;
  const tipX =
    hover != null ? Math.min(w - 168, Math.max(padL, padL + slot * hover + slot / 2 - 80)) : 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-paper shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/80 px-4 py-3">
        <div>
          {title ? <p className="text-sm font-semibold text-ink">{title}</p> : null}
          <p className="text-[11px] text-mute">Entradas × saídas{hasSaldo ? " · linha = saldo" : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] font-medium">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green/10 px-2.5 py-1 text-green">
            <span className="size-2 rounded-full bg-green" />
            Entradas
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-orange/10 px-2.5 py-1 text-orange">
            <span className="size-2 rounded-full bg-orange" />
            Saídas
          </span>
          {hasSaldo ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-navy/10 px-2.5 py-1 text-navy">
              <span className="h-0.5 w-3 rounded-full bg-navy" />
              Saldo
            </span>
          ) : null}
        </div>
      </div>

      <div className="relative px-1 pb-1 pt-2 sm:px-2">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="h-auto w-full"
          role="img"
          aria-label={title || "Fluxo de caixa"}
        >
          <defs>
            <linearGradient id={`${gid}-in`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4ade80" />
              <stop offset="100%" stopColor="#16a34a" />
            </linearGradient>
            <linearGradient id={`${gid}-out`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fb923c" />
              <stop offset="100%" stopColor="#ea580c" />
            </linearGradient>
            <linearGradient id={`${gid}-area`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7b2cf5" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#7b2cf5" stopOpacity="0" />
            </linearGradient>
            <filter id={`${gid}-soft`} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#0f172a" floodOpacity="0.12" />
            </filter>
          </defs>

          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <g key={t}>
              <line
                x1={padL}
                x2={w - padR}
                y1={yBar(max * t)}
                y2={yBar(max * t)}
                stroke="#e5e7eb"
                strokeDasharray={t === 0 ? undefined : "4 6"}
                strokeWidth="1"
              />
              <text x={padL - 8} y={yBar(max * t) + 3} textAnchor="end" fill="#94a3b8" fontSize="10">
                {compactMoney(max * t)}
              </text>
            </g>
          ))}

          {hasSaldo && saldoPath ? (
            <>
              <path
                d={`${saldoPath} L ${padL + slot * (n - 1) + slot / 2} ${padT + chartH} L ${padL + slot / 2} ${padT + chartH} Z`}
                fill={`url(#${gid}-area)`}
              />
              <path
                d={saldoPath}
                fill="none"
                stroke="#7b2cf5"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          ) : null}

          {points.map((p, i) => {
            const cx = padL + slot * i + slot / 2;
            const eH = Math.max(p.entradas > 0 ? 4 : 0, (chartH * p.entradas) / max);
            const sH = Math.max(p.saidas > 0 ? 4 : 0, (chartH * p.saidas) / max);
            const isActive = hover === i;
            return (
              <g
                key={`${p.label}-${i}`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                className="cursor-pointer"
              >
                <rect
                  x={cx - slot / 2 + 2}
                  y={padT}
                  width={Math.max(slot - 4, 1)}
                  height={chartH}
                  fill={isActive ? "#7b2cf5" : "transparent"}
                  opacity={isActive ? 0.06 : 0}
                />
                <rect
                  x={cx - barW - 3}
                  y={yBar(p.entradas)}
                  width={barW}
                  height={eH}
                  rx={Math.min(8, barW / 2)}
                  fill={`url(#${gid}-in)`}
                  filter={isActive ? `url(#${gid}-soft)` : undefined}
                  opacity={hover == null || isActive ? 1 : 0.45}
                  className="transition-opacity"
                />
                <rect
                  x={cx + 3}
                  y={yBar(p.saidas)}
                  width={barW}
                  height={sH}
                  rx={Math.min(8, barW / 2)}
                  fill={`url(#${gid}-out)`}
                  filter={isActive ? `url(#${gid}-soft)` : undefined}
                  opacity={hover == null || isActive ? 1 : 0.45}
                  className="transition-opacity"
                />
                {hasSaldo ? (
                  <circle
                    cx={cx}
                    cy={ySaldo(p.saldo ?? 0)}
                    r={isActive ? 4.5 : 3.2}
                    fill="#fff"
                    stroke="#7b2cf5"
                    strokeWidth="2"
                  />
                ) : null}
                <text
                  x={cx}
                  y={h - 16}
                  textAnchor="middle"
                  fill={isActive ? "#0f172a" : "#64748b"}
                  fontSize="11"
                  fontWeight={isActive ? 600 : 500}
                >
                  {p.label}
                </text>
              </g>
            );
          })}

          {active && hover != null ? (
            <g transform={`translate(${tipX}, 8)`} pointerEvents="none">
              <rect width="160" height="72" rx="12" fill="#0f172a" opacity="0.92" />
              <text x="12" y="20" fill="#f8fafc" fontSize="11" fontWeight="600">
                {active.label}
              </text>
              <text x="12" y="38" fill="#4ade80" fontSize="10">
                Entradas {formatMoney(active.entradas)}
              </text>
              <text x="12" y="52" fill="#fb923c" fontSize="10">
                Saídas {formatMoney(active.saidas)}
              </text>
              {active.saldo != null ? (
                <text x="12" y="66" fill="#c4b5fd" fontSize="10">
                  Saldo {formatMoney(active.saldo)}
                </text>
              ) : null}
            </g>
          ) : null}
        </svg>
      </div>
    </div>
  );
}

export function TrendLines({
  series,
}: {
  series: Array<{ label: string; faturamento: number; despesas: number; lucro: number }>;
}) {
  const gid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const w = 720;
  const h = 260;
  const pad = 44;
  const max = Math.max(1000, ...series.flatMap((s) => [s.faturamento, s.lucro, s.despesas]));
  const x = (i: number) => pad + (i * (w - pad * 2)) / Math.max(1, series.length - 1);
  const y = (v: number) => h - pad - (Math.max(0, v) / max) * (h - pad * 2);

  function path(key: "faturamento" | "despesas" | "lucro") {
    return series.map((s, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(s[key])}`).join(" ");
  }

  function area(key: "faturamento" | "despesas" | "lucro") {
    if (!series.length) return "";
    const line = path(key);
    return `${line} L ${x(series.length - 1)} ${h - pad} L ${x(0)} ${h - pad} Z`;
  }

  const active = hover != null ? series[hover] : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-paper shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/80 px-4 py-3">
        <p className="text-sm font-semibold text-ink">Tendência</p>
        <div className="flex flex-wrap gap-2 text-[11px] font-medium">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-navy/10 px-2.5 py-1 text-navy">
            Faturamento
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green/10 px-2.5 py-1 text-green">
            Lucro
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-orange/10 px-2.5 py-1 text-orange">
            Despesas
          </span>
        </div>
      </div>
      <div className="px-1 pb-1 pt-2 sm:px-2">
        <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label="Tendência">
          <defs>
            <linearGradient id={`${gid}-fat`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7b2cf5" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#7b2cf5" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <g key={t}>
              <line
                x1={pad}
                x2={w - pad}
                y1={y(max * t)}
                y2={y(max * t)}
                stroke="#e5e7eb"
                strokeDasharray={t === 0 ? undefined : "4 6"}
              />
              <text x={pad - 8} y={y(max * t) + 3} textAnchor="end" fill="#94a3b8" fontSize="10">
                {compactMoney(max * t)}
              </text>
            </g>
          ))}
          <path d={area("faturamento")} fill={`url(#${gid}-fat)`} />
          <path d={path("faturamento")} fill="none" stroke="#7b2cf5" strokeWidth="2.5" strokeLinecap="round" />
          <path d={path("lucro")} fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" />
          <path d={path("despesas")} fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" />
          {series.map((s, i) => (
            <g
              key={i}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              className="cursor-pointer"
            >
              <circle
                cx={x(i)}
                cy={y(s.faturamento)}
                r={hover === i ? 5 : 3.5}
                fill="#fff"
                stroke="#7b2cf5"
                strokeWidth="2"
              />
              <text
                x={x(i)}
                y={h - 16}
                textAnchor="middle"
                fill={hover === i ? "#0f172a" : "#64748b"}
                fontSize="10"
                fontWeight={hover === i ? 600 : 500}
              >
                {s.label || MONTHS_SHORT[i] || ""}
              </text>
            </g>
          ))}
          {active && hover != null ? (
            <g
              transform={`translate(${Math.min(w - 180, Math.max(pad, x(hover) - 70))}, 12)`}
              pointerEvents="none"
            >
              <rect width="168" height="70" rx="12" fill="#0f172a" opacity="0.92" />
              <text x="12" y="20" fill="#f8fafc" fontSize="11" fontWeight="600">
                {active.label || MONTHS_SHORT[hover]}
              </text>
              <text x="12" y="38" fill="#c4b5fd" fontSize="10">
                Fat. {formatMoney(active.faturamento)}
              </text>
              <text x="12" y="52" fill="#4ade80" fontSize="10">
                Lucro {formatMoney(active.lucro)}
              </text>
              <text x="12" y="66" fill="#fb923c" fontSize="10">
                Desp. {formatMoney(active.despesas)}
              </text>
            </g>
          ) : null}
        </svg>
      </div>
    </div>
  );
}
