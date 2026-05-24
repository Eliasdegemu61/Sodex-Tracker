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

      let previousCumulative = 0;
      return [...pnlDailyStats]
        .sort((a, b) => a.ts_ms - b.ts_ms)
        .map((item) => {
          const cumulative = parseFloat(item.pnl || '0');
          const dailyPnl = cumulative - previousCumulative;
          previousCumulative = cumulative;

          return {
            ts: item.ts_ms,
            date: new Date(item.ts_ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }),
            pnl: dailyPnl,
            cumulative,
            waterfall: [cumulative - dailyPnl, cumulative],
          };
        })
        .filter((item) => timePeriod === 'all' || item.ts >= startDate.getTime());
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
    const initialValue = 10000; // Starting value for percentage calculation
    const percentageChange = ((totalPnL / initialValue) * 100).toFixed(2);
    const isPositive = totalPnL >= 0;

    // Format display value - use K only if value > 999
    let displayValue: string;
    if (Math.abs(totalPnL) > 999) {
      displayValue = `$${(totalPnL / 1000).toFixed(1)}K`;
    } else {
      displayValue = `$${totalPnL.toFixed(2)}`;
    }

    return { totalPnL, percentageChange, isPositive, displayValue };
  }, [chartData]);

  const getBarColor = (value: number) => {
    return value >= 0 ? '#10b98166' : '#ef444466'; // Semi-transparent green for positive, red for negative
  };

  const hasData = chartData.length > 0;
  const axisColor = theme === 'dark' ? '#ffffff45' : 'rgba(0,0,0,0.45)';
  const tooltipBg = theme === 'dark' ? '#050505' : '#ffffff';
  const tooltipBorder = theme === 'dark' ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)';
  const tooltipText = theme === 'dark' ? '#fff' : '#111';
  const cursorColor = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const lineColor = theme === 'dark' ? '#ffffff' : '#111111';

  // Daily bars and cumulative line intentionally share one scale.
  const domains = useMemo(() => {
    if (!hasData) return { pnl: [0, 0] };

    const values = chartData.flatMap(d => [d.pnl, d.cumulative]);
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 0);
    const abs = Math.max(Math.abs(min), Math.abs(max)) * 1.15 || 1;

    return { pnl: [-abs, abs] };
  }, [chartData, hasData]);

  return (
    <Card className="flex h-full flex-col rounded-[2rem] border border-black/8 bg-white p-3 text-foreground shadow-[0_20px_60px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-black dark:text-white dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:p-5">
      <div className="mb-6 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-black/35 dark:text-white/35">
            {title}
          </h3>
          <Select value={timePeriod} onValueChange={(value: any) => setTimePeriod(value)}>
            <SelectTrigger className="h-9 w-28 rounded-xl border-black/10 bg-black/[0.03] text-[10px] font-semibold text-foreground dark:border-white/10 dark:bg-white/[0.03] dark:text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-black/10 bg-white text-foreground dark:border-white/10 dark:bg-[#090909] dark:text-white">
              <SelectItem value="all" className="text-[10px]">All Time</SelectItem>
              <SelectItem value="1w" className="text-[10px]">1 Week</SelectItem>
              <SelectItem value="1m" className="text-[10px]">1 Month</SelectItem>
              <SelectItem value="3m" className="text-[10px]">3 Months</SelectItem>
              <SelectItem value="1y" className="text-[10px]">1 Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-baseline gap-2">
          <p className={`text-3xl font-semibold tracking-[-0.04em] ${stats.isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {stats.displayValue}
          </p>
          <p className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${stats.isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {stats.isPositive ? '+' : ''}{stats.percentageChange}%
          </p>
        </div>
      </div>

      <div className="relative flex min-h-[360px] flex-1 items-center justify-center">
        {!hasData ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-black/10 bg-black/[0.02] transition-colors dark:border-white/10 dark:bg-white/[0.02]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-black/30 dark:text-white/30">No data available</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis
                dataKey="date"
                stroke={cursorColor}
                tick={{ fill: axisColor, fontSize: 9, fontWeight: 700 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="pnl-axis"
                domain={domains.pnl}
                stroke={cursorColor}
                tick={{ fill: axisColor, fontSize: 9, fontWeight: 700 }}
                tickFormatter={(value) => value.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                axisLine={false}
                tickLine={false}
                orientation="left"
                hide={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: tooltipBg,
                  border: tooltipBorder,
                  borderRadius: '12px',
                  color: tooltipText,
                  fontSize: '10px',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                  backdropFilter: 'blur(10px)'
                }}
                itemStyle={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: tooltipText }}
                labelStyle={{ color: axisColor, marginBottom: '4px', fontSize: '9px' }}
                cursor={{ stroke: cursorColor, strokeWidth: 1 }}
                formatter={(value: any, name: any, props: any) => {
                  const numValue = value as number;
                  const displayValue = Math.abs(numValue) > 999
                    ? `$${(numValue / 1000).toFixed(1)}K`
                    : `$${numValue.toFixed(2)}`;

                  if (name === 'cumulative') {
                    return [displayValue, 'Cumulative PnL'];
                  }
                  return [displayValue, 'Daily PnL'];
                }}
              />
              <ReferenceLine yAxisId="pnl-axis" y={0} stroke={cursorColor} strokeWidth={1} strokeDasharray="4 4" />
              <Bar
                yAxisId="pnl-axis"
                dataKey="pnl"
                radius={[4, 4, 0, 0]}
                barSize={8}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getBarColor(entry.pnl)} />
                ))}
              </Bar>
              <Line
                yAxisId="pnl-axis"
                type="monotone"
                dataKey="cumulative"
                stroke={lineColor}
                strokeWidth={3}
                dot={false}
                isAnimationActive={true}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
