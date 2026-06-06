'use client'

import { Card } from '@/components/ui/card'
import { formatNumber } from '@/lib/format-number'
import { useDexData } from '@/context/dex-data-context'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function VolumeRangeCard() {
  const { overallStats, isLoading } = useDexData()
  const volumeRangeData = overallStats?.chart_data || []

  if (isLoading) {
    return (
      <Card className="p-8 bg-card border border-border animate-pulse" style={{ borderRadius: 'var(--radius-md)' }}>
        <h3 className="text-xs font-semibold text-muted-foreground/60 mb-8">Aggregating Flow</h3>
        <div className="space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-10 bg-secondary/10" style={{ borderRadius: 'var(--radius-sm)' }} />
          ))}
        </div>
      </Card>
    )
  }

  if (volumeRangeData.length === 0) {
    return (
      <Card className="p-8 bg-card border border-border" style={{ borderRadius: 'var(--radius-md)' }}>
        <h3 className="text-xs font-semibold text-muted-foreground/60 mb-2">Volume Analysis</h3>
        <p className="text-[11px] text-muted-foreground/30 font-bold uppercase ">No cohort data synchronized</p>
      </Card>
    )
  }

  // Find max absolute value for scaling the bars
  const maxAbsPnl = Math.max(...volumeRangeData.map(d => Math.abs(d.avg_pnl)), 1)

  return (
    <TooltipProvider>
      <Card className="p-8 bg-card border border-border flex flex-col" style={{ borderRadius: 'var(--radius-md)' }}>
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-xs font-semibold text-muted-foreground/80 dark:text-muted-foreground/60">Avg PNL by Volume range</h3>
        </div>

        <div className="space-y-2">
          {volumeRangeData.map((entry, index) => {
            const isPositive = entry.avg_pnl >= 0
            const barWidth = (Math.abs(entry.avg_pnl) / maxAbsPnl) * 50 // 50% max because it's double sided

            return (
              <Tooltip key={index}>
                <TooltipTrigger asChild>
                  <div className="group flex items-center gap-6 p-3 bg-muted/30 border border-border/10 hover:bg-muted transition-colors duration-150" style={{ borderRadius: 'var(--radius-sm)' }}>
                    {/* Range Label */}
                    <div className="w-16 md:w-24 shrink-0">
                      <span className="text-[10px] font-bold text-muted-foreground/70 dark:text-muted-foreground/40   group-hover:text-foreground/60 transition-colors">
                        {entry.range}
                      </span>
                    </div>

                    {/* Bar Area */}
                    <div className="relative flex-1 h-3 min-w-[100px]">
                      {/* Center Line */}
                      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border/20 z-10" />

                      {/* The Bar */}
                      <div
                        className={`absolute top-0 bottom-0 transition-all duration-1000 ease-out
                          ${isPositive
                            ? 'left-1/2 bg-foreground/20'
                            : 'right-1/2 bg-muted-foreground/30'
                          }`}
                        style={{
                          width: `${barWidth}%`,
                        }}
                      />
                    </div>

                    {/* PnL Value */}
                    <div className="w-16 md:w-24 text-right shrink-0">
                      <span className={`text-[12px] font-bold tracking-tight ${isPositive ? 'text-[var(--success)]' : 'text-destructive'}`}>
                        {isPositive ? '+' : '-'}${formatNumber(Math.abs(entry.avg_pnl))}
                      </span>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-card border border-border text-foreground p-4" style={{ borderRadius: 'var(--radius-sm)' }}>
                  <div className="space-y-2">
                    <p className="text-[10px] text-muted-foreground/40 font-bold  ">{entry.range} Cohort</p>
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${isPositive ? 'bg-[var(--success)]' : 'bg-destructive'}`} />
                      <p className={`text-xl font-bold tracking-tight ${isPositive ? 'text-[var(--success)]' : 'text-destructive'}`}>
                        {isPositive ? '+' : '-'}${formatNumber(Math.abs(entry.avg_pnl))}
                      </p>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-border/10">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
              <span className="text-[8px] text-muted-foreground/40 font-bold leading-none">Net Loss</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-foreground/50" />
              <span className="text-[8px] text-muted-foreground/40 font-bold leading-none">Net Profit</span>
            </div>
          </div>
          <span className="text-[8px] text-muted-foreground/10 ">UNIT: USD_FLOW</span>
        </div>
      </Card>
    </TooltipProvider>
  )
}

