'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { CachedVolumeData, ChartDataPoint } from '@/lib/volume-service'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

type TimeRange = '1w' | '1m' | '3m' | '6m' | '1y'

interface VolumeChartClientProps {
  data: CachedVolumeData | null
  chartData?: ChartDataPoint[]
}

function buildChartData(chartData: ChartDataPoint[], timeRange: TimeRange) {
  const now = new Date()
  const todayUtcStr = now.toISOString().split('T')[0]

  // All data including today's (potentially incomplete)
  const sorted = [...chartData].sort((a, b) => a.day.localeCompare(b.day))

  // Compute cumulative running volume over the FULL dataset
  let runningTotal = 0
  const withCumulative = sorted.map((day) => {
    runningTotal += day.spot_vol + day.futures_vol
    return { ...day, cumulativeVol: runningTotal }
  })

  // Determine the reference date (last entry)
  const lastDayStr = withCumulative[withCumulative.length - 1]?.day
  const referenceDate = new Date(`${lastDayStr}T00:00:00Z`)
  let cutoffDate = new Date(referenceDate.getTime())

  switch (timeRange) {
    case '1w':
      cutoffDate.setUTCDate(referenceDate.getUTCDate() - 7)
      break
    case '1m':
      cutoffDate.setUTCMonth(referenceDate.getUTCMonth() - 1)
      break
    case '3m':
      cutoffDate.setUTCMonth(referenceDate.getUTCMonth() - 3)
      break
    case '6m':
      cutoffDate.setUTCMonth(referenceDate.getUTCMonth() - 6)
      break
    case '1y':
      cutoffDate.setUTCFullYear(referenceDate.getUTCFullYear() - 1)
      break
  }

  const windowed = withCumulative.filter((day) => {
    const dayDate = new Date(`${day.day}T00:00:00Z`)
    return dayDate >= cutoffDate
  })

  return windowed.map((day, index, array) => {
    const isLast = index === array.length - 1
    const isSecondToLast = index === array.length - 2
    const isIncomplete = isLast && day.day === todayUtcStr

    const spotVal = Number((day.spot_vol / 1e6).toFixed(2))
    const futuresVal = Number((day.futures_vol / 1e6).toFixed(2))
    const dailyTotalVal = Number(((day.spot_vol + day.futures_vol) / 1e6).toFixed(2))
    const cumulVal = Number((day.cumulativeVol / 1e9).toFixed(3))
    const hasIncomplete = array[array.length - 1].day === todayUtcStr

    return {
      date: day.day,
      spot: isIncomplete ? null : spotVal,
      futures: isIncomplete ? null : futuresVal,
      daily_total: isIncomplete ? null : dailyTotalVal,
      cumulative: isIncomplete ? null : cumulVal,
      spot_incomplete: (isIncomplete || (isSecondToLast && hasIncomplete)) ? spotVal : null,
      futures_incomplete: (isIncomplete || (isSecondToLast && hasIncomplete)) ? futuresVal : null,
      daily_total_incomplete: (isIncomplete || (isSecondToLast && hasIncomplete)) ? dailyTotalVal : null,
      cumulative_incomplete: (isIncomplete || (isSecondToLast && hasIncomplete)) ? cumulVal : null,
      isIncomplete,
    }
  })
}

function filterChartData(chartData: ChartDataPoint[] | undefined, timeRange: TimeRange) {
  if (!chartData || chartData.length === 0) return []
  return buildChartData(chartData, timeRange)
}

export function VolumeChartClient({ data, chartData }: VolumeChartClientProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('1m')
  const [chartType, setChartType] = useState<'split' | 'total'>('split')
  const processedChartData = filterChartData(chartData, timeRange)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return (
    <Card className="p-4 lg:p-8 bg-background border border-border flex flex-col" style={{ borderRadius: 'var(--radius-md)' }}>
      <div className="flex items-center justify-between mb-4 lg:mb-8">
        <h3 className="text-xs font-semibold text-muted-foreground/80 dark:text-muted-foreground/60">volume trend</h3>
        <div className="flex items-center gap-3">
          <div className="flex items-center">
            {(['split', 'total'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setChartType(type)}
                className={`text-[10px] font-bold px-2 py-1 transition-all capitalize ${
                  chartType === type
                    ? 'text-foreground border-b border-foreground'
                    : 'text-muted-foreground/50 hover:text-muted-foreground border-b border-transparent'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
          <div className="w-px h-3 bg-border opacity-50" />
          <div className="flex items-center">
            {(['1w', '1m', '3m', '6m', '1y'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`text-[10px] font-bold px-2 py-1 transition-all ${
                  timeRange === range
                    ? 'text-foreground border-b border-foreground'
                    : 'text-muted-foreground/50 hover:text-muted-foreground border-b border-transparent'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={processedChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorSpot" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="currentColor" stopOpacity={0.15} />
                <stop offset="95%" stopColor="currentColor" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorFutures" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="currentColor" stopOpacity={0.08} />
                <stop offset="95%" stopColor="currentColor" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorDailyTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="currentColor" stopOpacity={0.05} />
                <stop offset="95%" stopColor="currentColor" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorCumulative" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="currentColor" stopOpacity={0.15} />
                <stop offset="95%" stopColor="currentColor" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.05} />
            <XAxis
              dataKey="date"
              stroke="currentColor"
              fontSize={9}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'currentColor', opacity: 0.2, fontWeight: 'bold' }}
              interval={Math.floor(processedChartData.length / 6)}
              dy={10}
            />
            <YAxis
              stroke="currentColor"
              fontSize={9}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'currentColor', opacity: 0.2, fontWeight: 'bold' }}
              tickFormatter={(value) => chartType === 'total' ? `${value}B` : `${value}M`}
              dx={-10}
            />
            <Tooltip
              cursor={{ stroke: 'currentColor', strokeWidth: 1, strokeOpacity: 0.1 }}
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const isIncomplete = payload[0].payload.isIncomplete

                  // Deduplicate items so we don't show both regular and incomplete series for the second-to-last item
                  const uniquePayload = payload.reduce((acc: any[], current: any) => {
                    const baseDataKey = String(current.dataKey).replace('_incomplete', '')
                    if (!acc.some(item => String(item.dataKey).replace('_incomplete', '') === baseDataKey)) {
                      acc.push(current)
                    }
                    return acc
                  }, [])

                  return (
                    <div className="bg-card border border-border p-4 min-w-[140px]" style={{ borderRadius: 'var(--radius-sm)' }}>
                      <p className="text-[9px] text-muted-foreground/40 font-bold mb-3">
                        {label} {isIncomplete && <span className="text-orange-500 ml-1">(Incomplete Date)</span>}
                      </p>
                      <div className="space-y-2">
                        {uniquePayload.map((entry: any, index: number) => (
                          <div key={index} className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
                              <span className="text-[10px] text-foreground/60 font-medium">
                                {String(entry.name).replace(' (Incomplete)', '')}
                              </span>
                            </div>
                            <span className="text-[11px] font-bold text-foreground/80">
                              {entry.dataKey?.toString().includes('cumulative')
                                ? `$${Number(entry.value).toFixed(3)}B`
                                : `$${Number(entry.value).toFixed(2)}M`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                }
                return null
              }}
            />
            {chartType === 'split' ? (
              <>
                <Area type="monotone" dataKey="spot" stroke="var(--foreground)" fill="url(#colorSpot)" strokeWidth={1.5} isAnimationActive={!isMobile} animationDuration={1500} name="Spot" dot={false} activeDot={{ r: 3, strokeWidth: 0, fill: 'var(--foreground)' }} />
                <Area type="monotone" dataKey="spot_incomplete" stroke="var(--foreground)" strokeDasharray="4 4" fill="url(#colorSpot)" fillOpacity={0.3} strokeWidth={1.5} isAnimationActive={!isMobile} animationDuration={1500} name="Spot" dot={false} activeDot={{ r: 3, strokeWidth: 0, fill: 'var(--foreground)' }} />
                <Area type="monotone" dataKey="futures" stroke="var(--muted-foreground)" fill="url(#colorFutures)" strokeWidth={1.5} isAnimationActive={true} animationDuration={1500} name="Futures" dot={false} activeDot={{ r: 3, strokeWidth: 0, fill: 'var(--muted-foreground)' }} />
                <Area type="monotone" dataKey="futures_incomplete" stroke="var(--muted-foreground)" strokeDasharray="4 4" fill="url(#colorFutures)" fillOpacity={0.3} strokeWidth={1.5} isAnimationActive={true} animationDuration={1500} name="Futures" dot={false} activeDot={{ r: 3, strokeWidth: 0, fill: 'var(--muted-foreground)' }} />
                <Area type="monotone" dataKey="daily_total" stroke="var(--border-strong)" fill="url(#colorDailyTotal)" strokeWidth={1} isAnimationActive={!isMobile} animationDuration={1500} name="Daily Total" dot={false} activeDot={{ r: 3, strokeWidth: 0, fill: 'var(--border-strong)' }} />
                <Area type="monotone" dataKey="daily_total_incomplete" stroke="var(--border-strong)" strokeDasharray="4 4" fill="url(#colorDailyTotal)" fillOpacity={0.3} strokeWidth={1} isAnimationActive={!isMobile} animationDuration={1500} name="Daily Total" dot={false} activeDot={{ r: 3, strokeWidth: 0, fill: 'var(--border-strong)' }} />
              </>
            ) : (
              <>
                <Area type="monotone" dataKey="cumulative" stroke="var(--foreground)" fill="url(#colorCumulative)" strokeWidth={1.5} isAnimationActive={true} animationDuration={1500} name="Cumulative Vol" dot={false} activeDot={{ r: 3, strokeWidth: 0, fill: 'var(--foreground)' }} />
                <Area type="monotone" dataKey="cumulative_incomplete" stroke="var(--foreground)" strokeDasharray="4 4" fill="url(#colorCumulative)" fillOpacity={0.3} strokeWidth={1.5} isAnimationActive={true} animationDuration={1500} name="Cumulative Vol" dot={false} activeDot={{ r: 3, strokeWidth: 0, fill: 'var(--foreground)' }} />
              </>
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 lg:mt-8 pt-3 lg:pt-6 border-t border-border flex items-center justify-between">
        <div className="flex items-center gap-6">
          {chartType === 'split' ? (
            <>
              <div className="flex items-center gap-2">
                <div className="w-2 h-0.5 bg-foreground" />
                <span className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider">spot</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-0.5 bg-muted-foreground" />
                <span className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider">futures</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-0.5 bg-border-strong" />
                <span className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider">daily total</span>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-2 h-0.5 bg-foreground" />
              <span className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider">cumulative</span>
            </div>
          )}
        </div>
        <span className="text-[8px] text-muted-foreground/40 font-mono">{chartType === 'total' ? 'B USD' : 'M USD'}</span>
      </div>
    </Card>
  )
}

