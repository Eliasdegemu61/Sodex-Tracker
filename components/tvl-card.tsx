'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { formatNumber } from '@/lib/format-number'

export function TVLCard() {
  const [tvl, setTvl] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchTVL() {
      try {
        const response = await fetch('/api/sodex/tvl', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()
        if (data.tvl !== undefined) {
          setTvl(data.tvl)
        } else {
          throw new Error('Invalid TVL data')
        }
      } catch (err) {
        console.error('[v0] Error fetching TVL data:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch TVL')
      } finally {
        setIsLoading(false)
      }
    }

    fetchTVL()
  }, [])

  if (isLoading) {
    return (
      <Card className="p-4 lg:p-5 bg-background border border-border min-h-[104px] animate-pulse" style={{ borderRadius: 'var(--radius-md)' }}>
        <div className="flex flex-col h-full justify-between min-w-0">
          <div className="flex items-center justify-between h-4">
            <div className="h-3 w-20 bg-secondary/10 rounded" />
            <div className="w-1.5 h-1.5 rounded-full bg-secondary/20" />
          </div>
          <div className="flex items-center h-6">
            <div className="h-5 w-24 bg-secondary/10 rounded" />
          </div>
          <div className="flex items-end h-4">
            <div className="h-2 w-12 bg-secondary/10 rounded" />
          </div>
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="p-5 bg-card border border-destructive/20" style={{ borderRadius: 'var(--radius-md)' }}>
        <h3 className="text-[10px] font-bold text-destructive/60 mb-2">Sync Error</h3>
        <p className="text-[10px] text-muted-foreground/30 font-bold uppercase ">TVL connectivity lost</p>
      </Card>
    )
  }

  return (
    <Card className="p-4 lg:p-5 bg-background border border-border group h-full flex flex-col justify-between min-h-[104px]" style={{ borderRadius: 'var(--radius-md)' }}>
      <div className="flex flex-col h-full justify-between min-w-0">
        <div className="flex items-center justify-between h-4">
          <h3 className="text-[10px] lg:text-xs font-semibold text-muted-foreground/60 whitespace-nowrap text-zinc-500 leading-none">Value Locked</h3>
          <div className="w-1.5 h-1.5 rounded-full bg-foreground animate-pulse" />
        </div>
        <div className="flex items-center h-6">
          <div className="text-lg lg:text-xl font-bold tracking-tight text-foreground leading-none truncate">
            {formatNumber(tvl)}
          </div>
        </div>
        <div className="flex items-end h-4">
          <div className="text-[7px] sm:text-[8px] text-muted-foreground/30 font-bold group-hover:text-primary/40 transition-colors whitespace-nowrap">
            MAG7.SSI
          </div>
        </div>
      </div>
    </Card>
  )
}

