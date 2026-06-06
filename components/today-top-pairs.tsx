'use client'

import { Card } from '@/components/ui/card'
import { ArrowUpRight } from 'lucide-react'
import { useVolumeData } from '@/context/volume-data-context'
import { getTokenLogo } from '@/lib/token-logos'
import { useMemo, useState } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function TodayTopPairs() {
  const { volumeData, isLoading, error } = useVolumeData()
  const [activeTab, setActiveTab] = useState('all')

  const todayData = volumeData?.today_stats

  const currentEntries = useMemo(() => {
    if (!todayData) return []

    if (activeTab === 'all') {
      const spotEntries = todayData.top_5_spot.map(p => ({ ...p, type: 'SPOT' as const }))
      const futuresEntries = todayData.top_5_futures.map(p => ({ ...p, type: 'FUTURES' as const }))
      return [...spotEntries, ...futuresEntries]
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 5)
    } else if (activeTab === 'spot') {
      return todayData.top_5_spot.map(p => ({ ...p, type: 'SPOT' as const }))
    } else {
      return todayData.top_5_futures.map(p => ({ ...p, type: 'FUTURES' as const }))
    }
  }, [todayData, activeTab])

  const formatVolume = (volume: number | undefined) => {
    if (volume === undefined) return '-'
    if (volume >= 1e6) return (volume / 1e6).toFixed(2) + 'M'
    if (volume >= 1e3) return (volume / 1e3).toFixed(2) + 'K'
    return volume.toFixed(2)
  }

  if (error) {
    return (
      <Card className="p-6 bg-card border border-destructive/20" style={{ borderRadius: 'var(--radius-md)' }}>
        <h3 className="text-[10px] font-bold text-destructive/60 mb-2 uppercase tracking-wider">Sync Error</h3>
        <p className="text-[10px] text-muted-foreground/30 font-bold uppercase ">{error}</p>
      </Card>
    )
  }

  if (isLoading || !volumeData) {
    return (
      <Card className="p-6 bg-background border border-border animate-pulse" style={{ borderRadius: 'var(--radius-md)' }}>
        <div className="h-4 w-32 bg-secondary/20 rounded mb-6" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(idx => (
            <div key={idx} className="h-14 bg-secondary/10" style={{ borderRadius: 'var(--radius-sm)' }} />
          ))}
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6 md:p-8 bg-background border border-border flex flex-col h-full" style={{ borderRadius: 'var(--radius-md)' }}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex flex-col">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Top Performers</h3>
          <span className="text-[9px] text-muted-foreground/40 font-bold mt-1">{todayData?.date} (UTC)</span>
        </div>
        
        <div className="flex items-center gap-4">
          {['all', 'spot', 'futures'].map((t) => (
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

      <div className="flex flex-col gap-3">
        {currentEntries.length > 0 ? (
          currentEntries.map((entry) => {
            return (
              <div key={`${entry.pair}-${entry.type}`} className="flex flex-row items-center justify-between p-3 border border-border/50 hover:bg-muted transition-colors" style={{ borderRadius: 'var(--radius-sm)' }}>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    {getTokenLogo(entry.pair) ? (
                      <img
                        src={getTokenLogo(entry.pair)}
                        alt={entry.pair}
                        className="w-8 h-8 rounded-full bg-background p-0.5 border border-border"
                        onError={(e) => { e.currentTarget.style.display = 'none' }}
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-secondary/20 border border-border flex items-center justify-center text-xs font-bold text-foreground">
                        {entry.pair.slice(0, 1)}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[12px] font-bold text-foreground leading-tight">{entry.pair}</span>
                    <span className="text-[8px] text-muted-foreground/60 font-bold uppercase tracking-widest mt-0.5">
                      {entry.type}
                    </span>
                  </div>
                </div>

                <div className="flex items-baseline">
                  <span className="text-[11px] font-bold text-foreground tabular-nums">${formatVolume(entry.volume)}</span>
                </div>
              </div>
            )
          })
        ) : (
          <div className="py-12 flex flex-col items-center justify-center space-y-2 opacity-30">
            <div className="text-2xl">🔒</div>
            <div className="text-xs font-bold uppercase tracking-widest">No Data Available</div>
          </div>
        )}
      </div>
    </Card>
  )
}

