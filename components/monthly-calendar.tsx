'use client';

import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { usePortfolio } from '@/context/portfolio-context';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface DayTrades {
  date: Date;
  pnl: number;
}

export function MonthlyCalendar() {
  const { positions, pnlDailyStats } = usePortfolio();
  const [currentDate, setCurrentDate] = useState(new Date());

  const dayData = useMemo(() => {
    const dateMap = new Map<string, DayTrades>();

    if (Array.isArray(pnlDailyStats) && pnlDailyStats.length > 0) {
      let previousCumulative = 0;
      [...pnlDailyStats]
        .sort((a, b) => a.ts_ms - b.ts_ms)
        .forEach((item) => {
          const date = new Date(item.ts_ms);
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const cumulative = parseFloat(item.pnl || '0');
          const dailyPnl = cumulative - previousCumulative;
          previousCumulative = cumulative;
          dateMap.set(`${year}-${month}-${day}`, { date, pnl: dailyPnl });
        });
      return dateMap;
    }

    if (!positions || positions.length === 0) {
      return dateMap;
    }

    positions.forEach((position) => {
      const posDate = new Date(position.created_at);
      const year = posDate.getFullYear();
      const month = String(posDate.getMonth() + 1).padStart(2, '0');
      const day = String(posDate.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;
      const existing = dateMap.get(dateKey);
      const pnl = position.realizedPnlValue || 0;
      if (existing) {
        existing.pnl += pnl;
      } else {
        dateMap.set(dateKey, { date: posDate, pnl });
      }
    });
    return dateMap;
  }, [positions, pnlDailyStats]);

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    // Previous month filler days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.unshift({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }

    // Next month filler days
    const totalSlots = days.length > 35 ? 42 : 35;
    let nextDay = 1;
    while (days.length < totalSlots) {
      days.push({ date: new Date(year, month + 1, nextDay++), isCurrentMonth: false });
    }

    return days;
  }, [currentDate]);

  const getDayPnL = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return dayData.get(`${year}-${month}-${day}`) || null;
  };

  const weekDays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  const monthStats = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthKeyPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;

    let totalPnL = 0, activeDays = 0, winDays = 0, loseDays = 0, bestDay = 0, worstDay = 0, maxAbs = 1;

    dayData.forEach((d, key) => {
      if (key.startsWith(monthKeyPrefix)) {
        totalPnL += d.pnl;
        if (d.pnl !== 0) activeDays++;
        if (d.pnl > 0) winDays++;
        if (d.pnl < 0) loseDays++;
        bestDay = Math.max(bestDay, d.pnl);
        worstDay = Math.min(worstDay, d.pnl);
        maxAbs = Math.max(maxAbs, Math.abs(d.pnl));
      }
    });
    const winRate = activeDays > 0 ? (winDays / activeDays) * 100 : 0;
    return { totalPnL, activeDays, winDays, loseDays, bestDay, worstDay, winRate, maxAbs };
  }, [dayData, currentDate]);

  const formatPnL = (value: number, decimals = 0) => {
    const sign = value >= 0 ? '+' : '-';
    return `${sign}$${Math.abs(value).toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`;
  };

  const getDayStyle = (pnl: number) => {
    const intensity = Math.min(0.34, 0.08 + (Math.abs(pnl) / monthStats.maxAbs) * 0.26);
    const borderAlpha = Math.min(0.5, 0.16 + (Math.abs(pnl) / monthStats.maxAbs) * 0.34);
    const color = pnl >= 0 ? '34, 197, 94' : '239, 68, 68';

    return {
      backgroundColor: `rgba(${color}, ${intensity})`,
      borderColor: `rgba(${color}, ${borderAlpha})`,
    };
  };

  return (
    <Card className="overflow-hidden rounded-[2rem] border border-black/8 bg-white text-foreground shadow-[0_20px_60px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-black dark:text-white dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
      <div className="border-b border-black/8 p-4 dark:border-white/10 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-black/35 dark:text-white/35">Daily PnL</p>
            <h3 className="mt-1 select-none text-2xl font-semibold tracking-[-0.04em] text-foreground sm:text-3xl">
              {currentDate.toLocaleDateString('en-US', { month: 'long' })} {currentDate.getFullYear()}
            </h3>
          </div>

          <div className="flex w-fit items-center gap-2 rounded-2xl border border-black/10 bg-black/[0.03] p-1 dark:border-white/10 dark:bg-white/[0.03]">
            <button
              onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
              className="rounded-xl p-2 text-black/55 transition-all hover:bg-black/[0.06] hover:text-black active:scale-90 dark:text-white/55 dark:hover:bg-white/[0.06] dark:hover:text-white"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="mx-1 h-4 w-px bg-black/10 dark:bg-white/10" />
            <button
              onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
              className="rounded-xl p-2 text-black/55 transition-all hover:bg-black/[0.06] hover:text-black active:scale-90 dark:text-white/55 dark:hover:bg-white/[0.06] dark:hover:text-white"
              aria-label="Next month"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-5">
          {[
            { label: 'Net', value: formatPnL(monthStats.totalPnL), tone: monthStats.totalPnL >= 0 ? 'text-green-500' : 'text-red-500' },
            { label: 'Win rate', value: `${monthStats.winRate.toFixed(0)}%`, tone: 'text-foreground' },
            { label: 'Active', value: `${monthStats.activeDays} days`, tone: 'text-foreground' },
            { label: 'Best', value: formatPnL(monthStats.bestDay), tone: 'text-green-500' },
            { label: 'Worst', value: formatPnL(monthStats.worstDay), tone: 'text-red-500' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-black/8 bg-black/[0.025] p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-black/35 dark:text-white/35">{stat.label}</p>
              <p className={`mt-1 truncate text-sm font-semibold tracking-[-0.03em] ${stat.tone}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-6">
        <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:overflow-visible sm:px-0">
          <div className="min-w-[620px] sm:min-w-0">
            <div className="mb-2 grid grid-cols-7 gap-2">
              {weekDays.map((d) => (
                <div key={d} className="py-2 text-center text-[9px] font-semibold uppercase tracking-[0.18em] text-black/35 dark:text-white/35">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((dayObj, idx) => {
                const { date, isCurrentMonth } = dayObj;
                const dayTrades = isCurrentMonth ? getDayPnL(date) : null;
                const hasActivity = !!dayTrades && dayTrades.pnl !== 0;
                const isPositive = hasActivity && (dayTrades?.pnl ?? 0) > 0;

                const now = new Date();
                const isToday =
                  isCurrentMonth &&
                  date.getDate() === now.getDate() &&
                  date.getMonth() === now.getMonth() &&
                  date.getFullYear() === now.getFullYear();

                const baseCell =
                  'relative flex aspect-[1.22/1] flex-col justify-between rounded-2xl border p-2.5 transition-all duration-200';
                const mutedCell = !isCurrentMonth
                  ? 'border-black/6 bg-black/[0.015] opacity-35 dark:border-white/6 dark:bg-white/[0.015]'
                  : isToday
                    ? 'border-orange-500/35 bg-orange-500/8'
                    : 'border-black/8 bg-black/[0.02] hover:bg-black/[0.045] dark:border-white/8 dark:bg-white/[0.02] dark:hover:bg-white/[0.045]';

                return (
                  <div
                    key={idx}
                    className={`${baseCell} ${hasActivity && isCurrentMonth ? 'shadow-sm' : mutedCell}`}
                    style={hasActivity && isCurrentMonth && dayTrades ? getDayStyle(dayTrades.pnl) : undefined}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className={`text-sm font-semibold leading-none ${isCurrentMonth ? 'text-foreground' : 'text-muted-foreground/45'}`}>
                        {date.getDate()}
                      </span>
                      {hasActivity && (
                        <span className={`h-1.5 w-1.5 rounded-full ${isPositive ? 'bg-green-500' : 'bg-red-500'}`} />
                      )}
                    </div>
                    {hasActivity && isCurrentMonth && dayTrades && (
                      <p className={`truncate text-right text-[10px] font-bold tabular-nums ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                        {formatPnL(dayTrades.pnl, Math.abs(dayTrades.pnl) >= 100 ? 0 : 2)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
