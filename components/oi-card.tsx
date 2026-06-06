'use client'

import { useEffect, useState } from 'react'
import { formatNumber } from '@/lib/format-number'
import { getTokenLogo } from '@/lib/token-logos'
import { TrendingUp } from 'lucide-react'

interface OIEntry {
  pair: string
  oi: number
}

interface OIData {
  total: number
  date: string
  top: OIEntry[]
}

function PairLogo({ pair }: { pair: string }) {
  const ticker = pair.replace('-USD', '')
  const logo = getTokenLogo(pair) || getTokenLogo(ticker)

  if (logo) {
    return (
      <img
        src={logo}
        alt={ticker}
        className="w-4 h-4 rounded-full bg-muted border border-border object-cover flex-shrink-0"
        onError={(e) => { e.currentTarget.style.display = 'none' }}
      />
    )
  }

  return (
    <span
      className="w-4 h-4 rounded-full bg-muted border border-border flex items-center justify-center text-[7px] font-black text-muted-foreground flex-shrink-0"
    >
      {ticker.slice(0, 1)}
    </span>
  )
}

export function OICard() {
  const [data, setData] = useState<OIData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/sodex/open-interest')
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div
      className="flex flex-col gap-3 p-4 lg:p-5 border-b lg:border-b-0 lg:border-r border-border last:border-0"
      style={{ borderColor: 'var(--border)' }}
    >
      {/* Label row */}
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Open Interest
        </span>
        <TrendingUp className="w-3.5 h-3.5 opacity-20" />
      </div>

      {/* Total OI */}
      {loading ? (
        <div className="h-7 w-28 bg-muted animate-pulse rounded" />
      ) : (
        <span className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground leading-none stat-number">
          ${formatNumber(data?.total ?? 0)}
        </span>
      )}

      {/* Top 3 pairs */}
      <div className="mt-auto flex flex-col gap-1.5">
        {loading ? (
          <>
            <div className="h-3.5 w-full bg-muted animate-pulse rounded" />
            <div className="h-3.5 w-4/5 bg-muted animate-pulse rounded" />
            <div className="h-3.5 w-3/5 bg-muted animate-pulse rounded" />
          </>
        ) : (
          data?.top.map((entry, i) => {
            const pct = data.total > 0 ? (entry.oi / data.total) * 100 : 0
            return (
              <div key={entry.pair} className="flex items-center gap-1.5">
                <PairLogo pair={entry.pair} />
                <span className="text-[10px] font-semibold text-muted-foreground truncate">
                  {entry.pair.replace('-USD', '')}
                </span>
                <div className="flex-1 h-px bg-border mx-1" />
                <span className="text-[10px] font-bold text-foreground tabular-nums flex-shrink-0">
                  {pct.toFixed(1)}%
                </span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
