/**
 * DashboardView - Fava-inspired financial dashboard with SVG charts.
 */

import * as React from "react";
import { t, tAccount } from "../i18n";
import { formatNum, currencyLabel } from "../format";
import { LedgerData } from "../types";
import {
  generateDashboardData,
  DashboardData,
  MonthlySummary,
  NetWorthPoint,
  ExpenseCategory,
} from "../core/reports";

interface DashboardViewProps {
  ledger: LedgerData;
  dateFrom: string;
  dateTo: string;
  currency: string;
  decimals: number;
}

/** Short month label: "2024-01" -> "1月" or "Jan" */
function shortMonth(month: string): string {
  const m = parseInt(month.split("-")[1], 10);
  return `${m}`;
}

export function DashboardView({ ledger, dateFrom, dateTo, currency, decimals }: DashboardViewProps) {
  const data = React.useMemo(
    () => generateDashboardData(ledger, dateFrom, dateTo, currency),
    [ledger, dateFrom, dateTo, currency]
  );

  const netIncome = data.totalIncome - data.totalExpenses;

  return (
    <div className="accounting-report">
      <h3>{t("report.dashboard")} ({dateFrom} ~ {dateTo})</h3>

      {/* Summary cards */}
      <div className="accounting-dashboard-cards">
        <div className="accounting-dashboard-card">
          <span className="accounting-dashboard-card-label">{t("account.income")}</span>
          <span className="accounting-dashboard-card-value accounting-color-income">
            {formatNum(data.totalIncome, decimals)} {currencyLabel(currency)}
          </span>
        </div>
        <div className="accounting-dashboard-card">
          <span className="accounting-dashboard-card-label">{t("account.expenses")}</span>
          <span className="accounting-dashboard-card-value accounting-color-expenses">
            {formatNum(data.totalExpenses, decimals)} {currencyLabel(currency)}
          </span>
        </div>
        <div className="accounting-dashboard-card">
          <span className="accounting-dashboard-card-label">{t("report.netIncome")}</span>
          <span className={`accounting-dashboard-card-value ${netIncome < 0 ? "accounting-negative" : "accounting-color-income"}`}>
            {formatNum(netIncome, decimals)} {currencyLabel(currency)}
          </span>
        </div>
        <div className="accounting-dashboard-card">
          <span className="accounting-dashboard-card-label">{t("dashboard.netWorth")}</span>
          <span className={`accounting-dashboard-card-value ${data.currentNetWorth < 0 ? "accounting-negative" : "accounting-color-assets"}`}>
            {formatNum(data.currentNetWorth, decimals)} {currencyLabel(currency)}
          </span>
        </div>
      </div>

      {/* Monthly income vs expenses bar chart */}
      {data.monthlySummary.length > 0 && (
        <div className="accounting-report-section">
          <h4>{t("dashboard.incomeExpenses")}</h4>
          <BarChart data={data.monthlySummary} decimals={decimals} currency={currency} />
        </div>
      )}

      {/* Net worth trend */}
      {data.netWorth.length > 1 && (
        <div className="accounting-report-section">
          <h4>{t("dashboard.netWorthTrend")}</h4>
          <LineChart data={data.netWorth} decimals={decimals} currency={currency} />
        </div>
      )}

      {/* Expense breakdown */}
      {data.expenseBreakdown.length > 0 && (
        <div className="accounting-report-section">
          <h4>{t("dashboard.expenseBreakdown")}</h4>
          <DonutChart data={data.expenseBreakdown} decimals={decimals} currency={currency} />
        </div>
      )}
    </div>
  );
}

// ─── Bar Chart ──────────────────────────────────────────────────────────────

const BAR_COLORS = { income: "#6ee7b7", expenses: "#fbbf24" };

function BarChart({
  data,
  decimals,
  currency,
}: {
  data: MonthlySummary[];
  decimals: number;
  currency: string;
}) {
  const [hover, setHover] = React.useState<{ idx: number; type: "income" | "expenses" } | null>(null);

  const W = 600;
  const H = 260;
  const padL = 64;
  const padR = 16;
  const padT = 16;
  const padB = 32;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const maxVal = Math.max(...data.flatMap((d) => [d.income, d.expenses]), 1);
  const barGroupW = chartW / data.length;
  const barW = Math.max(Math.min(barGroupW * 0.35, 28), 4);
  const gap = Math.max(barW * 0.15, 2);

  // Y-axis ticks
  const ticks = niceYTicks(maxVal, 5);
  const yMax = ticks[ticks.length - 1];

  const yScale = (v: number) => padT + chartH - (v / yMax) * chartH;
  const xCenter = (i: number) => padL + barGroupW * i + barGroupW / 2;

  return (
    <div className="accounting-chart-container">
      <svg viewBox={`0 0 ${W} ${H}`} className="accounting-chart-svg">
        {/* Grid lines */}
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={padL} y1={yScale(tick)} x2={W - padR} y2={yScale(tick)}
              stroke="#333" strokeWidth="1"
            />
            <text x={padL - 8} y={yScale(tick) + 4} textAnchor="end" fill="#888" fontSize="10">
              {formatCompact(tick)}
            </text>
          </g>
        ))}

        {/* Bars */}
        {data.map((d, i) => {
          const cx = xCenter(i);
          const incomeH = (d.income / yMax) * chartH;
          const expenseH = (d.expenses / yMax) * chartH;
          return (
            <g key={d.month}>
              {/* Income bar */}
              <rect
                x={cx - barW - gap / 2} y={yScale(d.income)}
                width={barW} height={incomeH}
                fill={BAR_COLORS.income}
                rx="2"
                opacity={hover && !(hover.idx === i && hover.type === "income") ? 0.4 : 1}
                onMouseEnter={() => setHover({ idx: i, type: "income" })}
                onMouseLeave={() => setHover(null)}
              />
              {/* Expenses bar */}
              <rect
                x={cx + gap / 2} y={yScale(d.expenses)}
                width={barW} height={expenseH}
                fill={BAR_COLORS.expenses}
                rx="2"
                opacity={hover && !(hover.idx === i && hover.type === "expenses") ? 0.4 : 1}
                onMouseEnter={() => setHover({ idx: i, type: "expenses" })}
                onMouseLeave={() => setHover(null)}
              />
              {/* Month label */}
              <text
                x={cx} y={H - padB + 16}
                textAnchor="middle" fill="#888" fontSize="10"
              >
                {shortMonth(d.month)}
              </text>
            </g>
          );
        })}

        {/* Baseline */}
        <line x1={padL} y1={yScale(0)} x2={W - padR} y2={yScale(0)} stroke="#555" strokeWidth="1" />
      </svg>

      {/* Tooltip */}
      {hover && (
        <div className="accounting-chart-tooltip">
          <strong>{data[hover.idx].month}</strong>
          <br />
          {hover.type === "income" ? t("account.income") : t("account.expenses")}:{" "}
          {formatNum(hover.type === "income" ? data[hover.idx].income : data[hover.idx].expenses, decimals)} {currencyLabel(currency)}
        </div>
      )}

      {/* Legend */}
      <div className="accounting-chart-legend">
        <span className="accounting-chart-legend-item">
          <span className="accounting-chart-legend-dot" style={{ background: BAR_COLORS.income }} />
          {t("account.income")}
        </span>
        <span className="accounting-chart-legend-item">
          <span className="accounting-chart-legend-dot" style={{ background: BAR_COLORS.expenses }} />
          {t("account.expenses")}
        </span>
      </div>
    </div>
  );
}

// ─── Line Chart ─────────────────────────────────────────────────────────────

function LineChart({
  data,
  decimals,
  currency,
}: {
  data: NetWorthPoint[];
  decimals: number;
  currency: string;
}) {
  const [hoverIdx, setHoverIdx] = React.useState<number | null>(null);

  const W = 600;
  const H = 240;
  const padL = 64;
  const padR = 16;
  const padT = 16;
  const padB = 32;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const values = data.map((d) => d.netWorth);
  const minVal = Math.min(...values, 0);
  const maxVal = Math.max(...values, 0);

  const ticks = niceYTicks(Math.max(Math.abs(minVal), Math.abs(maxVal)), 5);
  const yMin = minVal < 0 ? -ticks[ticks.length - 1] : 0;
  const yMaxTick = ticks[ticks.length - 1];
  const yRange = yMaxTick - yMin;

  const yScale = (v: number) => padT + chartH - ((v - yMin) / yRange) * chartH;
  const xScale = (i: number) => padL + (i / Math.max(data.length - 1, 1)) * chartW;

  // Build path
  const points = data.map((d, i) => `${xScale(i)},${yScale(d.netWorth)}`);
  const linePath = `M${points.join("L")}`;
  const areaPath = `${linePath}L${xScale(data.length - 1)},${yScale(0)}L${xScale(0)},${yScale(0)}Z`;

  // All y-ticks (positive and negative), always include 0
  const allTicks = minVal < 0
    ? [...ticks.map((v) => -v).reverse(), 0, ...ticks]
    : [0, ...ticks];

  return (
    <div className="accounting-chart-container">
      <svg viewBox={`0 0 ${W} ${H}`} className="accounting-chart-svg">
        {/* Grid */}
        {allTicks.map((tick) => {
          if (tick < yMin || tick > yMaxTick) return null;
          return (
            <g key={tick}>
              <line
                x1={padL} y1={yScale(tick)} x2={W - padR} y2={yScale(tick)}
                stroke={tick === 0 ? "#555" : "#333"} strokeWidth="1"
              />
              <text x={padL - 8} y={yScale(tick) + 4} textAnchor="end" fill="#888" fontSize="10">
                {formatCompact(tick)}
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        <path d={areaPath} fill="#93c5fd" opacity="0.12" />
        {/* Line */}
        <path d={linePath} fill="none" stroke="#93c5fd" strokeWidth="2" />

        {/* Data points & hover targets */}
        {data.map((d, i) => (
          <g key={d.month}>
            <circle
              cx={xScale(i)} cy={yScale(d.netWorth)} r={hoverIdx === i ? 5 : 3}
              fill="#93c5fd" stroke="#1e1e1e" strokeWidth="2"
            />
            {/* Invisible hover target */}
            <rect
              x={xScale(i) - (chartW / data.length) / 2}
              y={padT} width={chartW / data.length} height={chartH}
              fill="transparent"
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
            />
          </g>
        ))}

        {/* X-axis labels */}
        {data.map((d, i) => {
          // Show every label if few months, otherwise skip
          const step = data.length > 12 ? Math.ceil(data.length / 12) : 1;
          if (i % step !== 0 && i !== data.length - 1) return null;
          return (
            <text
              key={d.month} x={xScale(i)} y={H - padB + 16}
              textAnchor="middle" fill="#888" fontSize="10"
            >
              {shortMonth(d.month)}
            </text>
          );
        })}
      </svg>

      {/* Tooltip */}
      {hoverIdx !== null && (
        <div className="accounting-chart-tooltip">
          <strong>{data[hoverIdx].month}</strong>
          <br />
          {t("dashboard.netWorth")}: {formatNum(data[hoverIdx].netWorth, decimals)} {currencyLabel(currency)}
        </div>
      )}
    </div>
  );
}

// ─── Donut Chart ────────────────────────────────────────────────────────────

const DONUT_COLORS = [
  "#fbbf24", "#f87171", "#34d399", "#60a5fa", "#a78bfa",
  "#fb923c", "#f472b6", "#2dd4bf", "#818cf8", "#facc15",
  "#4ade80", "#38bdf8", "#c084fc", "#fb7185", "#fcd34d",
];

function DonutChart({
  data,
  decimals,
  currency,
}: {
  data: ExpenseCategory[];
  decimals: number;
  currency: string;
}) {
  const [hoverIdx, setHoverIdx] = React.useState<number | null>(null);

  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 80;
  const innerR = 50;

  const total = data.reduce((s, d) => s + d.amount, 0);

  // Build arcs
  let startAngle = -Math.PI / 2;
  const arcs = data.map((d, i) => {
    const fraction = total > 0 ? d.amount / total : 0;
    // Cap at just under 2*PI to avoid SVG arc full-circle rendering as nothing
    const angle = Math.min(fraction * Math.PI * 2, Math.PI * 2 - 0.001);
    const endAngle = startAngle + angle;

    const x1 = cx + outerR * Math.cos(startAngle);
    const y1 = cy + outerR * Math.sin(startAngle);
    const x2 = cx + outerR * Math.cos(endAngle);
    const y2 = cy + outerR * Math.sin(endAngle);
    const ix1 = cx + innerR * Math.cos(endAngle);
    const iy1 = cy + innerR * Math.sin(endAngle);
    const ix2 = cx + innerR * Math.cos(startAngle);
    const iy2 = cy + innerR * Math.sin(startAngle);

    const largeArc = angle > Math.PI ? 1 : 0;

    const path = [
      `M${x1},${y1}`,
      `A${outerR},${outerR} 0 ${largeArc} 1 ${x2},${y2}`,
      `L${ix1},${iy1}`,
      `A${innerR},${innerR} 0 ${largeArc} 0 ${ix2},${iy2}`,
      "Z",
    ].join(" ");

    startAngle = endAngle;
    return { path, color: DONUT_COLORS[i % DONUT_COLORS.length] };
  });

  return (
    <div className="accounting-donut-container">
      <div className="accounting-donut-chart">
        <svg viewBox={`0 0 ${size} ${size}`} className="accounting-chart-svg accounting-donut-svg">
          {arcs.map((arc, i) => (
            <path
              key={i}
              d={arc.path}
              fill={arc.color}
              opacity={hoverIdx !== null && hoverIdx !== i ? 0.35 : 1}
              stroke="#1a1a1a"
              strokeWidth="1.5"
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
            />
          ))}
          {/* Center text */}
          <text x={cx} y={cy - 6} textAnchor="middle" fill="#888" fontSize="9">
            {t("report.total")}
          </text>
          <text x={cx} y={cy + 10} textAnchor="middle" fill="#e0e0e0" fontSize="12" fontWeight="600">
            {formatCompact(total)}
          </text>
        </svg>

        {hoverIdx !== null && (
          <div className="accounting-chart-tooltip">
            <strong>{tAccount(data[hoverIdx].account)}</strong>
            <br />
            {formatNum(data[hoverIdx].amount, decimals)} {currencyLabel(currency)} ({data[hoverIdx].percentage.toFixed(1)}%)
          </div>
        )}
      </div>

      <div className="accounting-donut-legend">
        {data.map((d, i) => (
          <div
            key={d.account}
            className={`accounting-donut-legend-row ${hoverIdx === i ? "accounting-donut-legend-active" : ""}`}
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
          >
            <span
              className="accounting-chart-legend-dot"
              style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
            />
            <span className="accounting-donut-legend-name">{tAccount(d.account)}</span>
            <span className="accounting-donut-legend-value">
              {formatNum(d.amount, decimals)} <span className="accounting-donut-legend-pct">({d.percentage.toFixed(1)}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Utilities ──────────────────────────────────────────────────────────────

/** Generate nice y-axis tick values */
function niceYTicks(maxVal: number, count: number): number[] {
  if (maxVal <= 0) return [1];
  const rough = maxVal / count;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const nice = rough / pow;
  let step: number;
  if (nice <= 1) step = pow;
  else if (nice <= 2) step = 2 * pow;
  else if (nice <= 5) step = 5 * pow;
  else step = 10 * pow;

  const ticks: number[] = [];
  for (let v = step; v <= maxVal + step * 0.5; v += step) {
    ticks.push(Math.round(v));
  }
  return ticks.length > 0 ? ticks : [Math.ceil(maxVal)];
}

/** Compact number format (e.g., 1,234,567 -> "1.2M") */
function formatCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${sign}${(abs / 1_000).toFixed(0)}K`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}K`;
  return `${sign}${abs}`;
}
