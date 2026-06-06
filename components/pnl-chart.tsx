'use client';

import { Card } from '@/components/ui/card';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Area, ReferenceLine } from 'recharts';
import { usePortfolio } from '@/context/portfolio-context';
import { useMemo, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTheme } from '@/app/providers';

interface PnLChartProps {
  title?: string;
}

export function PnLChart({ title = 'Profit & Loss' }: PnLChartProps) {
  const { positions, pnlDailyStats } = usePortfolio();
  const { theme } = useTheme();
  const [timePeriod, setTimePeriod] = useState<'all' | '1w' | '1m' | '3m' | '1y'>('all');

  const getFilteredPositions = useMemo(() => {
    if (!Array.isArray(positions) || positions.length === 0) {
      return [];
    }

    const now = new Date();
    let startDate = new Date(0); // Default: all time

    switch (timePeriod) {
      case '1w':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '1m':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '3m':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
      default:
        startDate = new Date(0);
    }

    return positions.filter((pos) => new Date(pos.created_at) >= startDate);
  }, [positions, timePeriod]);

  const chartData = useMemo(() => {
    if (Array.isArray(pnlDailyStats) && pnlDailyStats.length > 0) {
      const now = new Date();
      let startDate = new Date(0);

      switch (timePeriod) {
        case '1w':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '1m':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '3m':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case '1y':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
      }

      // Sort all rows and compute running daily deltas from the full history
      const allRows = [...pnlDailyStats]
        .sort((a, b) => a.ts_ms - b.ts_ms);

      let previousCumulative = 0;
      const allMapped = allRows.map((item) => {
        const cumulative = parseFloat(item.pnl || '0');
        const dailyPnl = cumulative - previousCumulative;
        previousCumulative = cumulative;
        return {
          ts: item.ts_ms,
          date: new Date(item.ts_ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }),
          dailyPnl,
          cumulativeAbsolute: cumulative,
        };
      });

      // Filter to the selected window
      const filtered = timePeriod === 'all'
        ? allMapped
        : allMapped.filter((item) => item.ts >= startDate.getTime());

      // Re-baseline: cumulative starts at 0 from the first visible day
      let runningCumulative = 0;
      return filtered.map((item) => {
        runningCumulative += item.dailyPnl;
        return {
          ts: item.ts,
          date: item.date,
          pnl: item.dailyPnl,
          cumulative: runningCumulative,
          waterfall: [runningCumulative - item.dailyPnl, runningCumulative],
        };
      });
    }

    if (!getFilteredPositions || getFilteredPositions.length === 0) {
      return [];
    }

    // Group positions by day using ISO date key for proper sorting
    const dayMap = new Map<string, { pnl: number; fullDate: string }>();
    getFilteredPositions.forEach((position) => {
      const date = new Date(position.created_at);
      const isoDateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD for sorting
      const displayDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });

      const current = dayMap.get(isoDateKey) || { pnl: 0, fullDate: displayDate };
      dayMap.set(isoDateKey, {
        pnl: current.pnl + position.realizedPnlValue,
        fullDate: displayDate,
      });
    });

    // Convert to array and sort by ISO date
    const sortedData = Array.from(dayMap.entries())
      .sort((a, b) => {
        // Sort by ISO date key (YYYY-MM-DD)
        return a[0].localeCompare(b[0]);
      })
      .map(([dateKey, { pnl, fullDate }]) => ({
        date: fullDate,
        pnl,
      }));

    // Calculate cumulative PnL
    let cumulativePnL = 0;
    return sortedData.map((day) => {
      const prevCumulative = cumulativePnL;
      cumulativePnL += day.pnl;
      return {
        ...day,
        cumulative: cumulativePnL,
        waterfall: [prevCumulative, cumulativePnL],
      };
    });
  }, [getFilteredPositions, pnlDailyStats, timePeriod]);

  const stats = useMemo(() => {
    if (chartData.length === 0) {
      return { totalPnL: 0, percentageChange: '0', isPositive: true, displayValue: '$0' };
    }

    const totalPnL = chartData[chartData.length - 1].cumulative;
    const initialValue = 10000;
    const percentageChange = ((totalPnL / initialValue) * 100).toFixed(2);
    const isPositive = totalPnL >= 0;

    let displayValue: string;
    if (Math.abs(totalPnL) > 999) {
      displayValue = `$${(totalPnL / 1000).toFixed(1)}K`;
    } else {
      displayValue = `$${totalPnL.toFixed(2)}`;
    }

    return { totalPnL, percentageChange, isPositive, displayValue };
  }, [chartData]);

  const sideStats = useMemo(() => {
    if (chartData.length === 0) return null;
    const dailyPnls = chartData.map(d => d.pnl);
    const positive = dailyPnls.filter(v => v > 0);
    const negative = dailyPnls.filter(v => v < 0);
    const bestDay = Math.max(...dailyPnls);
    const worstDay = Math.min(...dailyPnls);
    const avg = dailyPnls.reduce((a, b) => a + b, 0) / dailyPnls.length;
    const winRate = Math.round((positive.length / dailyPnls.length) * 100);

    const fmt = (n: number) => Math.abs(n) > 999 ? `$${(n / 1000).toFixed(1)}K` : `$${n.toFixed(1)}`;
    return {
      totalPnL: stats.totalPnL,
      isPositive: stats.isPositive,
      bestDay,
      worstDay,
      avgDaily: avg,
      winRate,
      positiveDays: positive.length,
      negativeDays: negative.length,
      totalDays: dailyPnls.length,
      fmt,
    };
  }, [chartData, stats]);

  const getBarColor = (value: number) => {
    return value >= 0 ? '#10b98166' : '#ef444466'; // Semi-transparent green for positive, red for negative
  };

  const hasData = chartData.length > 0;
  const axisColor = theme === 'dark' ? '#ffffff45' : 'rgba(0,0,0,0.45)';
  const tooltipBg = theme === 'dark' ? '#050505' : '#ffffff';
  const tooltipBorder = theme === 'dark' ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)';
  const tooltipText = theme === 'dark' ? '#fff' : '#111';
  const cursorColor = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const lineColor = theme === 'dark' ? 'var(--primary)' : 'var(--foreground)';

  // Daily bars and cumulative line intentionally share one scale.
  const domains = useMemo(() => {
    if (!hasData) return { pnl: [0, 0] };

    const values = chartData.flatMap(d => [d.pnl, d.cumulative]);
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 0);
    const abs = Math.max(Math.abs(min), Math.abs(max)) * 1.15 || 1;

    return { pnl: [-abs, abs] };
  }, [chartData, hasData]);

  // Calculate the gradient split offset (0 is green, 1 is red, boundary is 'off')
  const off = useMemo(() => {
    if (!hasData) return 0.5;
    const values = chartData.map((d) => d.cumulative);
    const max = Math.max(...values);
    const min = Math.min(...values);

    if (max <= 0) return 0;
    if (min >= 0) return 1;
    return max / (max - min);
  }, [chartData, hasData]);

  return (
    <div className="flex flex-col lg:flex-row border border-border bg-card text-foreground overflow-hidden" style={{ borderRadius: 'var(--radius-md)' }}>
      {/* Left — Chart */}
      <div className="flex flex-col flex-1 min-h-0">
        <div className="p-4 sm:p-5 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[9px] font-bold uppercase tracking-[0.22em] text-muted-foreground">{title}</h3>
            <Select value={timePeriod} onValueChange={(value: any) => setTimePeriod(value)}>
              <SelectTrigger className="h-7 w-24 border border-border bg-transparent text-[9px] font-bold uppercase tracking-widest text-muted-foreground" style={{ borderRadius: 'var(--radius-sm)' }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border border-border bg-card text-foreground" style={{ borderRadius: 'var(--radius-sm)' }}>
                <SelectItem value="all" className="text-[10px]">All Time</SelectItem>
                <SelectItem value="1w" className="text-[10px]">1 Week</SelectItem>
                <SelectItem value="1m" className="text-[10px]">1 Month</SelectItem>
                <SelectItem value="3m" className="text-[10px]">3 Months</SelectItem>
                <SelectItem value="1y" className="text-[10px]">1 Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-baseline gap-2">
            <p className={`text-3xl font-bold tracking-[-0.04em] ${stats.isPositive ? 'text-[var(--success)]' : 'text-[var(--destructive)]'}`}>
              {stats.displayValue}
            </p>
            <p className={`text-[10px] font-bold uppercase tracking-[0.18em] ${stats.isPositive ? 'text-[var(--success)]' : 'text-[var(--destructive)]'}`}>
              {stats.isPositive ? '+' : ''}{stats.percentageChange}%
            </p>
          </div>
        </div>

        <div className="relative w-full h-48 sm:h-56 lg:h-auto lg:flex-1 px-4 pb-4 sm:px-5 sm:pb-5">
          {!hasData ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center border border-dashed border-border bg-secondary/5 transition-colors m-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/45">No data available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="pnlSplit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--success)" stopOpacity={0.25} />
                    <stop offset={off} stopColor="var(--success)" stopOpacity={0.02} />
                    <stop offset={off} stopColor="var(--destructive)" stopOpacity={0.02} />
                    <stop offset="100%" stopColor="var(--destructive)" stopOpacity={0.25} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke={cursorColor} tick={{ fill: axisColor, fontSize: 9, fontWeight: 700 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="pnl-axis" domain={domains.pnl} stroke={cursorColor} tick={{ fill: axisColor, fontSize: 9, fontWeight: 700 }} tickFormatter={(value) => value.toLocaleString('en-US', { maximumFractionDigits: 0 })} axisLine={false} tickLine={false} orientation="left" hide={false} />
                <Tooltip contentStyle={{ backgroundColor: tooltipBg, border: tooltipBorder, borderRadius: '12px', color: tooltipText, fontSize: '10px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)' }} itemStyle={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: tooltipText }} labelStyle={{ color: axisColor, marginBottom: '4px', fontSize: '9px' }} cursor={{ stroke: cursorColor, strokeWidth: 1 }} formatter={(value: any, name: any, props: any) => { const numValue = value as number; const displayValue = Math.abs(numValue) > 999 ? `$${(numValue / 1000).toFixed(1)}K` : `$${numValue.toFixed(2)}`; if (name === 'cumulative') return [displayValue, 'Cumulative PnL']; return [displayValue, 'Daily PnL']; }} />
                <ReferenceLine yAxisId="pnl-axis" y={0} stroke={cursorColor} strokeWidth={1} strokeDasharray="4 4" />
                <Area yAxisId="pnl-axis" type="monotone" dataKey="cumulative" stroke="none" fill="url(#pnlSplit)" isAnimationActive={true} />
                <Bar yAxisId="pnl-axis" dataKey="pnl" radius={[4, 4, 0, 0]} barSize={8}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getBarColor(entry.pnl)} />
                  ))}
                </Bar>
                <Line yAxisId="pnl-axis" type="monotone" dataKey="cumulative" stroke={lineColor} strokeWidth={2.5} dot={false} isAnimationActive={true} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Right — Timeframe stats */}
      {sideStats && (
        <div className="border-t lg:border-t-0 lg:border-l border-border p-4 sm:p-5 flex flex-col gap-3 shrink-0 lg:min-w-[180px] lg:max-w-[220px]">
          <span className="text-[8px] font-bold uppercase tracking-[0.22em] text-muted-foreground/50">Period Stats</span>

          <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">Total PnL</span>
              <span className={`text-sm lg:text-lg font-bold tracking-tight ${sideStats.isPositive ? 'text-[var(--success)]' : 'text-[var(--destructive)]'}`}>
                {sideStats.isPositive ? '+' : ''}{sideStats.fmt(sideStats.totalPnL)}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">Win Rate</span>
              <span className="text-sm font-bold tracking-tight text-foreground">{sideStats.winRate}%</span>
              <span className="text-[9px] font-bold text-muted-foreground/50">{sideStats.positiveDays}W / {sideStats.negativeDays}L · {sideStats.totalDays}D</span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">Best Day</span>
              <span className="text-sm font-bold tracking-tight text-[var(--success)]">+{sideStats.fmt(sideStats.bestDay)}</span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">Worst Day</span>
              <span className="text-sm font-bold tracking-tight text-[var(--destructive)]">{sideStats.fmt(sideStats.worstDay)}</span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">Avg Daily</span>
              <span className={`text-sm font-bold tracking-tight ${sideStats.avgDaily >= 0 ? 'text-[var(--success)]' : 'text-[var(--destructive)]'}`}>
                {sideStats.avgDaily >= 0 ? '+' : ''}{sideStats.fmt(sideStats.avgDaily)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
