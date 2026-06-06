'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { HelpCircle } from 'lucide-react'
import { useVolumeData } from '@/context/volume-data-context'
import { getTokenLogo } from '@/lib/token-logos'
import { cn } from '@/lib/utils'

export function TopPairsWidget() {
  const { volumeData, isLoading } = useVolumeData()
  const [activeTab, setActiveTab] = useState('all')

  const formatVolume = (volume: number | undefined) => {
    if (!volume) return '0'
    if (volume >= 1e9) return (volume / 1e9).toFixed(2) + 'B'
    if (volume >= 1e6) return (volume / 1e6).toFixed(2) + 'M'
    if (volume >= 1e3) return (volume / 1e3).toFixed(2) + 'K'
    return volume.toFixed(2)
  }

  if (isLoading || !volumeData) {
    return (
      <Card className="p-8 bg-background border border-border animate-pulse" style={{ borderRadius: 'var(--radius-md)' }}>
        <div className="h-4 w-32 bg-secondary/20 rounded mb-6" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 bg-secondary/10" style={{ borderRadius: 'var(--radius-sm)' }} />
          ))}
        </div>
      </Card>
    )
  }

  const stats = volumeData.all_time_stats
  const allTopPairs = [...stats.top_5_spot, ...stats.top_5_futures]
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 5)

  let currentItems: { pair: string, volume: number }[] = []
  if (activeTab === 'all') {
    currentItems = allTopPairs
  } else if (activeTab === 'spot') {
    currentItems = stats.top_5_spot
  } else {
    currentItems = stats.top_5_futures
  }

  const COLORS = ['hsl(var(--foreground))', 'hsl(var(--foreground) / 0.7)', 'hsl(var(--foreground) / 0.5)', 'hsl(var(--foreground) / 0.3)', 'hsl(var(--foreground) / 0.15)']
  const maxVolume = Math.max(...currentItems.map(i => i.volume))

  return (
    <Card className="p-6 md:p-8 bg-background border border-border flex flex-col" style={{ borderRadius: 'var(--radius-md)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Volume Split</h3>
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/40 hover:text-muted-foreground transition-colors cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="bg-popover border-border text-[10px] max-w-[200px]">
                <p>Volume distribution among top performing pairs.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        
        <div className="flex items-center gap-4">
          {(['all', 'spot', 'futures'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`text-[10px] font-black transition-all uppercase tracking-wider pb-1 ${
                activeTab === t
                  ? 'text-foreground border-b-2 border-foreground'
                  : 'text-muted-foreground/30 hover:text-muted-foreground border-b-2 border-transparent'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Ranked Pairs */}
      <div className="space-y-1">
        {currentItems.map((item, index) => {
          const percentage = (item.volume / maxVolume) * 100
          const opacity = 1 - index * 0.15
          return (
            <div key={item.pair} className="relative overflow-hidden group">
              {/* Background fill bar */}
              <div
                className="absolute inset-y-0 left-0 transition-all duration-1000 ease-out"
                style={{ width: `${percentage}%`, backgroundColor: `hsl(var(--foreground) / ${opacity * 0.08})` }}
              />
              {/* Content */}
              <div className="relative flex items-center gap-3 px-3 py-2.5">
                <span className="text-[10px] font-black text-muted-foreground/40 w-4 shrink-0 tabular-nums">#{index + 1}</span>
                <div className="shrink-0">
                  {getTokenLogo(item.pair) ? (
                    <img
                      src={getTokenLogo(item.pair)}
                      alt={item.pair}
                      className="w-7 h-7 rounded-full bg-background border border-border/50"
                      onError={(e) => { e.currentTarget.style.display = 'none' }}
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-secondary/20 border border-border flex items-center justify-center text-[9px] font-black text-foreground">
                      {item.pair.slice(0, 1)}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-bold text-foreground truncate">{item.pair}</div>
                  <div className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-wider">{item.pair.includes('-') ? 'Futures' : 'Spot'}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[11px] font-bold text-foreground tabular-nums">${formatVolume(item.volume)}</div>
                  <div className="text-[8px] font-bold text-muted-foreground/50 tabular-nums">{percentage.toFixed(1)}%</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border">
        <div className="flex flex-col">
          <span className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Total Spot</span>
          <span className="text-sm font-bold text-foreground">${formatVolume(stats.total_spot_volume)}</span>
        </div>
        <div className="flex flex-col items-end text-right">
          <span className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Total Futures</span>
          <span className="text-sm font-bold text-foreground">${formatVolume(stats.total_futures_volume)}</span>
        </div>
      </div>
    </Card>
  )
}

