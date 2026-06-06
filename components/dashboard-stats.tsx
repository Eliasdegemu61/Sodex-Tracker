'use client'

import { Card } from '@/components/ui/card'
import { useState, useEffect, useMemo } from 'react'
import { ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import { formatNumber } from '@/lib/format-number'
import { cn } from '@/lib/utils'
import { useDexData } from '@/context/dex-data-context'
import { useVolumeData } from '@/context/volume-data-context'
import { TrendingUp } from 'lucide-react'

interface UserDataEntry {
  day_date: string
  timestamp: number
  newUsers: number
  cumulativeUsers: number
}

interface DashboardStatsProps {
  variant?: 'default' | 'compact'
}

export function DashboardStats({ variant = 'default' }: DashboardStatsProps) {
  const { overallStats, isLoading: dexLoading } = useDexData()
  const { volumeData, isLoading: volumeLoading } = useVolumeData()
  const [userData, setUserData] = useState<UserDataEntry[]>([])
  const [userLoading, setUserLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setUserLoading(true)
        const today = new Date().toISOString().split('T')[0]
        const response = await fetch(`https://mainnet-data.sodex.dev/api/v1/dashboard/users?start_date=2024-01-01&end_date=${today}`)
        const json = await response.json()
        if (json.code === 0 && json.data?.data) {
          setUserData(json.data.data)
        }
      } catch (error) {
        console.error('Error fetching user data:', error)
      } finally {
        setUserLoading(false)
      }
    }
    fetchUserData()
  }, [])

  const isLoading = (dexLoading || volumeLoading || userLoading) && (!volumeData && userData.length === 0)

  useEffect(() => {
    console.log('[DEBUG] DashboardStats:', { dexLoading, volumeLoading, userLoading, overallStats, volumeData, userDataLength: userData.length })
  }, [dexLoading, volumeLoading, userLoading, overallStats, volumeData, userData])

  if (isLoading || (!overallStats && dexLoading) || !volumeData) {
    return (
      <>
        {variant === 'compact' ? (
          <>
            <div className="p-4 lg:p-5 bg-card border border-border min-h-[104px] animate-pulse" style={{ borderRadius: 'var(--radius-md)' }} />
            <div className="p-4 lg:p-5 bg-card border border-border min-h-[104px] animate-pulse" style={{ borderRadius: 'var(--radius-md)' }} />
          </>
        ) : (
          <div className="space-y-3 mb-4">
            <div className="p-3 bg-card border border-border h-16 animate-pulse" style={{ borderRadius: 'var(--radius-md)' }} />
            <div className="p-3 bg-card border border-border h-16 animate-pulse" style={{ borderRadius: 'var(--radius-md)' }} />
            <div className="p-3 bg-card border border-border h-16 animate-pulse" style={{ borderRadius: 'var(--radius-md)' }} />
          </div>
        )}
      </>
    )
  }

  const latestUserEntry = userData[userData.length - 1]
  const previousUserEntry = userData[userData.length - 2]
  const totalUsers = latestUserEntry?.cumulativeUsers || 0
  const userGain = totalUsers - (previousUserEntry?.cumulativeUsers || 0)
  const userGainPercent = previousUserEntry?.cumulativeUsers
    ? (userGain / previousUserEntry.cumulativeUsers) * 100
    : 0

  const spotVolume = volumeData?.all_time_stats?.total_spot_volume || 0
  const futuresVolume = volumeData?.all_time_stats?.total_futures_volume || 0
  const totalVolume = spotVolume + futuresVolume

  const pieData = [
    { name: 'Spot', value: spotVolume },
    { name: 'Futures', value: futuresVolume },
  ]

  // Prepare chart data for the small graph - past 7 days
  const chartData = userData.slice(-7).map(entry => ({
    name: entry.day_date,
    users: entry.cumulativeUsers,
    new: entry.newUsers
  }))

  // Revised User and Volume Cards for Mobile Merger
  const StatsHeader = () => {
    const SharedCard = ({ children, className }: { children: React.ReactNode, className?: string }) => (
      <div className={cn("bg-card border border-border p-4 lg:p-5 h-full flex flex-col min-h-[104px] text-foreground", className)} style={{ borderRadius: 'var(--radius-md)' }}>
        {children}
      </div>
    );

    const UserStats = () => (
      <div className="flex-1 flex flex-col h-full min-w-0">
        <h3 className="text-[10px] lg:text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 whitespace-nowrap">Total Users</h3>
        <div className="text-xl lg:text-2xl font-bold tracking-tight text-foreground leading-none mb-1.5 lg:mb-2 font-mono">
          {totalUsers.toLocaleString()}
        </div>
        {userGain > 0 && (
          <div className="flex items-center text-[11px] font-bold text-[var(--success)] w-fit mt-auto">
            <TrendingUp className="w-3 h-3 mr-1 text-[var(--success)]" />
            +{userGain.toLocaleString()} <span className="text-[9px] ml-1 opacity-80 font-medium tracking-tight">({userGainPercent.toFixed(2)}%)</span>
          </div>
        )}
      </div>
    );

    const VolumeStats = () => (
      <div className="flex-1 flex flex-col h-full min-w-0">
        <h3 className="text-[10px] lg:text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 whitespace-nowrap">Total Volume</h3>
        <div className="text-xl lg:text-2xl font-bold tracking-tight text-foreground leading-none mb-1.5 lg:mb-2 font-mono">${formatNumber(totalVolume)}</div>
        <div className="hidden lg:flex items-center gap-3 mt-auto pt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />
            <span className="text-[9px] text-muted-foreground font-bold">Spot <span className="text-foreground font-mono">${formatNumber(spotVolume)}</span></span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
            <span className="text-[9px] text-muted-foreground font-bold">Fut <span className="text-foreground font-mono">${formatNumber(futuresVolume)}</span></span>
          </div>
        </div>
      </div>
    );

    const [activeVolumeTab, setActiveVolumeTab] = useState<'all' | 'spot' | 'futures'>('all')

    const filteredPieData = useMemo(() => {
      if (activeVolumeTab === 'spot') return [{ name: 'Spot', value: spotVolume || 1 }]
      if (activeVolumeTab === 'futures') return [{ name: 'Futures', value: futuresVolume || 1 }]
      return pieData
    }, [activeVolumeTab, pieData, spotVolume, futuresVolume])

    if (variant === 'compact') {
      return (
        <>
          <SharedCard>
            <UserStats />
          </SharedCard>
          <SharedCard>
            <VolumeStats />
          </SharedCard>
        </>
      );
    }

    return (
      <div className="space-y-3 mb-0 lg:mb-4">
        {/* Mobile View: Merged Card */}
        <div className="block lg:hidden">
          <SharedCard>
            <div className="flex items-center justify-between gap-6 divide-x divide-border">
              <UserStats />
              <div className="pl-6 flex-1">
                <VolumeStats />
              </div>
            </div>
          </SharedCard>
        </div>

        {/* Desktop View: Separate Cards */}
        <div className="hidden lg:grid grid-cols-1 gap-3">
          <SharedCard>
            <UserStats />
          </SharedCard>
          <SharedCard>
            <VolumeStats />
          </SharedCard>
        </div>
      </div>
    );
  };

  if (variant === 'compact') {
    return <StatsHeader />;
  }

  // Default variant - show all cards
  return (
    <div className="space-y-1 lg:space-y-3 mb-0 lg:mb-6 text-foreground">
      <StatsHeader />

      {/* Spot vs Futures Volume */}
      <div className="hidden lg:block bg-card border border-border p-5" style={{ borderRadius: 'var(--radius-md)' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Volume Split</h3>
          <div className="flex items-center gap-4">
            {(['all', 'spot', 'futures'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveVolumeTab(t)}
                className={`text-[10px] font-bold transition-all uppercase tracking-wider pb-1 ${
                  activeVolumeTab === t
                    ? 'text-foreground border-b-2 border-foreground'
                    : 'text-muted-foreground/40 hover:text-muted-foreground border-b-2 border-transparent'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="relative w-full h-40 flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart className="animate-spin" style={{ animationDuration: '40s' }}>
              <Pie
                data={filteredPieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={65}
                paddingAngle={2}
                dataKey="value"
                isAnimationActive={!isMobile}
                stroke="none"
              >
                <Cell fill="var(--primary)" />
                <Cell fill="var(--border-strong)" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute flex flex-col items-center justify-center text-center">
            <span className="text-[8px] text-muted-foreground/30 font-bold uppercase">
              {activeVolumeTab === 'all' ? 'Futures' : activeVolumeTab}
            </span>
            <span className="text-xs font-bold text-foreground/80 font-mono">
              {activeVolumeTab === 'all' 
                ? `${((futuresVolume / (totalVolume || 1)) * 100).toFixed(1)}%`
                : '100%'
              }
            </span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="p-3 bg-muted border border-border space-y-1" style={{ borderRadius: 'var(--radius-sm)' }}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />
              <span className="text-[8px] text-muted-foreground font-bold uppercase">Spot</span>
            </div>
            <p className="text-xs font-bold text-foreground/80 font-mono">${formatNumber(spotVolume)}</p>
          </div>
          <div className="p-3 bg-muted border border-border space-y-1" style={{ borderRadius: 'var(--radius-sm)' }}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
              <span className="text-[8px] text-muted-foreground font-bold uppercase">Futures</span>
            </div>
            <p className="text-xs font-bold text-foreground/80 font-mono">${formatNumber(futuresVolume)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
