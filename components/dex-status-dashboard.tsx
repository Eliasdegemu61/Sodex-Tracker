'use client'

import React, { useState, useEffect } from 'react'
import { useDexData } from '@/context/dex-data-context'
import { useVolumeData } from '@/context/volume-data-context'
import { VolumeChart } from '@/components/volume-chart'
import { FundFlowChart } from '@/components/fund-flow-chart'
import { TodayTopPairs } from '@/components/today-top-pairs'
import { TopPairsWidget } from '@/components/top-pairs-widget'
import { formatNumber } from '@/lib/format-number'
import { TrendingUp, TrendingDown, Users, BarChart2, DollarSign } from 'lucide-react'
import { OICard } from '@/components/oi-card'
import { cn } from '@/lib/utils'

interface UserDataEntry {
  day_date: string
  timestamp: number
  newUsers: number
  cumulativeUsers: number
}

function KpiCard({
  label,
  value,
  sub,
  trend,
  trendLabel,
  icon: Icon,
  loading,
  children,
}: {
  label: string
  value: string
  sub?: string
  trend?: 'up' | 'down' | 'neutral'
  trendLabel?: string
  icon?: React.ElementType
  loading?: boolean
  children?: React.ReactNode
}) {
  return (
    <div
      className="flex flex-col gap-3 p-4 lg:p-5 border-b lg:border-b-0 lg:border-r border-border last:border-0"
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </span>
        {Icon && <Icon className="w-3.5 h-3.5 opacity-20" />}
      </div>

      {loading ? (
        <div className="h-7 w-28 bg-muted animate-pulse rounded" />
      ) : (
        <span className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground leading-none stat-number">
          {value}
        </span>
      )}

      {children ?? (
        <div className="flex items-center gap-2 mt-auto">
          {trendLabel && trend && (
            <span
              className={cn(
                'flex items-center gap-1 text-[10px] font-bold',
                trend === 'up' && 'text-[var(--success)]',
                trend === 'down' && 'text-destructive',
                trend === 'neutral' && 'text-muted-foreground'
              )}
            >
              {trend === 'up' && <TrendingUp className="w-3 h-3" />}
              {trend === 'down' && <TrendingDown className="w-3 h-3" />}
              {trendLabel}
            </span>
          )}
          {sub && !trendLabel && (
            <span className="text-[10px] text-muted-foreground font-medium">{sub}</span>
          )}
        </div>
      )}
    </div>
  )
}

export function DexStatusDashboard({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { overallStats } = useDexData()
  const { volumeData, isLoading: volLoading } = useVolumeData()
  const [userData, setUserData] = useState<UserDataEntry[]>([])
  const [userLoading, setUserLoading] = useState(true)
  const [tvl, setTvl] = useState<number>(0)
  const [tvlLoading, setTvlLoading] = useState(true)
  const [vol24h, setVol24h] = useState<number>(0)
  const [vol7d, setVol7d] = useState<number>(0)
  const [volSummaryLoading, setVolSummaryLoading] = useState(true)

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const today = new Date().toISOString().split('T')[0]
        const res = await fetch(`https://mainnet-data.sodex.dev/api/v1/dashboard/users?start_date=2024-01-01&end_date=${today}`)
        const json = await res.json()
        if (json.code === 0 && json.data?.data) setUserData(json.data.data)
      } catch {}
      finally { setUserLoading(false) }
    }
    fetchUserData()
  }, [])

  useEffect(() => {
    const fetchVolSummary = async () => {
      try {
        const res = await fetch('/api/sodex/volume-summary')
        const data = await res.json()
        if (data.vol24h !== undefined) setVol24h(data.vol24h)
        if (data.vol7d !== undefined) setVol7d(data.vol7d)
      } catch {}
      finally { setVolSummaryLoading(false) }
    }
    fetchVolSummary()
  }, [])

  useEffect(() => {
    const fetchTvl = async () => {
      try {
        const res = await fetch('/api/sodex/tvl')
        const data = await res.json()
        if (data.tvl !== undefined) setTvl(data.tvl)
      } catch {}
      finally { setTvlLoading(false) }
    }
    fetchTvl()
  }, [])

  const latestUser = userData[userData.length - 1]
  const prevUser = userData[userData.length - 2]
  const totalUsers = latestUser?.cumulativeUsers || 0
  const userGain = totalUsers - (prevUser?.cumulativeUsers || 0)
  const userGainPct = prevUser?.cumulativeUsers
    ? ((userGain / prevUser.cumulativeUsers) * 100).toFixed(2)
    : null

  const spotVol = volumeData?.all_time_stats?.total_spot_volume || 0
  const futVol = volumeData?.all_time_stats?.total_futures_volume || 0
  const totalVol = spotVol + futVol

  const todayTopAll = volumeData?.today_stats
    ? [
        ...volumeData.today_stats.top_5_spot.map(p => ({ ...p, type: 'SPOT' as const })),
        ...volumeData.today_stats.top_5_futures.map(p => ({ ...p, type: 'FUT' as const })),
      ].sort((a, b) => b.volume - a.volume).slice(0, 5)
    : []

  const profitPct = overallStats?.summary?.profitable_percent ?? null

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

  return (
    <div className="space-y-0 animate-in fade-in duration-300">

      {/* ── KPI STRIP ── */}
      <div
        className="grid grid-cols-2 lg:grid-cols-4 border border-border"
        style={{ borderRadius: 'var(--radius-md)' }}
      >
        <KpiCard
          label="Total Volume"
          value={`$${formatNumber(totalVol)}`}
          icon={BarChart2}
          loading={volLoading}
        >
          <div className="flex flex-col gap-1.5 mt-auto">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60 w-6">24h</span>
              <div className="flex-1 h-px bg-border" />
              {volSummaryLoading
                ? <div className="h-3 w-14 bg-muted animate-pulse rounded" />
                : <span className="text-[10px] font-bold text-foreground tabular-nums">${formatNumber(vol24h)}</span>
              }
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60 w-6">7d</span>
              <div className="flex-1 h-px bg-border" />
              {volSummaryLoading
                ? <div className="h-3 w-14 bg-muted animate-pulse rounded" />
                : <span className="text-[10px] font-bold text-foreground tabular-nums">${formatNumber(vol7d)}</span>
              }
            </div>
          </div>
        </KpiCard>
        <KpiCard
          label="Total Users"
          value={totalUsers.toLocaleString()}
          trend={userGain > 0 ? 'up' : 'neutral'}
          trendLabel={userGain > 0 ? `+${userGain.toLocaleString()} today` : undefined}
          icon={Users}
          loading={userLoading}
        />
        <KpiCard
          label="Value Locked"
          value={`$${formatNumber(tvl)}`}
          sub="MAG7.SSI"
          icon={DollarSign}
          loading={tvlLoading}
        />
        <OICard />
      </div>

      {/* ── VOLUME CHART (full width) ── */}
      <div className="mt-6">
        <VolumeChart />
      </div>

      {/* ── TWO COLUMN: Today's Pairs + Fund Flow ── */}
      <div className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
        <TodayTopPairs />
        <FundFlowChart />
      </div>

      {/* ── ALL-TIME VOLUME SPLIT ── */}
      <div className="mt-6">
        <TopPairsWidget />
      </div>

      {/* ── QUICK STATS ROW: Spot vs Futures breakdown + today's leader ── */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-px border border-border overflow-hidden" style={{ borderRadius: 'var(--radius-md)' }}>
        {/* Spot */}
        <div className="bg-card p-5 flex flex-col gap-2">
          <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Spot Volume</span>
          <span className="text-xl font-bold text-foreground stat-number">${formatNumber(spotVol)}</span>
          <div className="mt-auto">
            <div className="h-1 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-foreground rounded-full"
                style={{ width: totalVol ? `${(spotVol / totalVol) * 100}%` : '0%' }}
              />
            </div>
            <span className="text-[9px] text-muted-foreground mt-1 block">
              {totalVol ? ((spotVol / totalVol) * 100).toFixed(1) : 0}% of total
            </span>
          </div>
        </div>

        {/* Futures */}
        <div className="bg-card p-5 flex flex-col gap-2" style={{ borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
          <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Futures Volume</span>
          <span className="text-xl font-bold text-foreground stat-number">${formatNumber(futVol)}</span>
          <div className="mt-auto">
            <div className="h-1 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-foreground rounded-full"
                style={{ width: totalVol ? `${(futVol / totalVol) * 100}%` : '0%' }}
              />
            </div>
            <span className="text-[9px] text-muted-foreground mt-1 block">
              {totalVol ? ((futVol / totalVol) * 100).toFixed(1) : 0}% of total
            </span>
          </div>
        </div>

        {/* Today's top pair */}
        <div className="bg-card p-5 flex flex-col gap-2">
          <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Today's Top Pair</span>
          {todayTopAll[0] ? (
            <>
              <span className="text-xl font-bold text-foreground">{todayTopAll[0].pair}</span>
              <span className="text-[10px] text-muted-foreground">
                ${formatNumber(todayTopAll[0].volume)} · {todayTopAll[0].type}
              </span>
            </>
          ) : (
            <span className="text-xl font-bold text-muted-foreground">—</span>
          )}
        </div>
      </div>

    </div>
  )
}
