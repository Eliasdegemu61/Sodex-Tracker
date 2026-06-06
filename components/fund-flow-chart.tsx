'use client'

import { useEffect, useState, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatNumber } from '@/lib/format-number'

interface FlowData {
    date: string
    token: string
    total_depo: number
    total_with: number
}

export function FundFlowChart() {
    const [data, setData] = useState<FlowData[]>([])
    const [tokens, setTokens] = useState<string[]>([])
    const [selectedToken, setSelectedToken] = useState<string>('USDC')
    const [isLoading, setIsLoading] = useState(true)
    const [showNetRemaining, setShowNetRemaining] = useState(false)
    const [timeRange, setTimeRange] = useState<'1w' | '1m' | '3m' | '6m' | '1y'>('1m')
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 1024)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    useEffect(() => {
        async function fetchData() {
            try {
                const response = await fetch('/api/site-data/daily-flows')
                if (!response.ok) throw new Error(`Failed to fetch from API: ${response.status}`);
                
                const rows = await response.json() as string[][]

                if (!rows || rows.length < 2) return

                const parsedData: FlowData[] = []
                const tokenSet = new Set<string>()

                // Assuming first row is header
                for (let i = 1; i < rows.length; i++) {
                    const values = rows[i]
                    if (values.length >= 4) {
                        const date = values[0].trim()
                        const token = values[1].trim()
                        const total_depo = parseFloat(values[2].trim())
                        const total_with = parseFloat(values[3].trim())

                        parsedData.push({ date, token, total_depo, total_with })
                        tokenSet.add(token)
                    }
                }

                const uniqueTokens = Array.from(tokenSet).sort()
                setData(parsedData)
                setTokens(uniqueTokens)
                if (uniqueTokens.includes('USDC')) setSelectedToken('USDC')
                else if (uniqueTokens.length > 0) setSelectedToken(uniqueTokens[0])
            } catch (err) {
                console.error('Failed to fetch fund flow data', err)
            } finally {
                setIsLoading(false)
            }
        }
        fetchData()
    }, [])

    const chartData = useMemo(() => {
        if (!selectedToken) return []
        const tokenData = data
            .filter((d) => d.token === selectedToken)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

        // Apply time range filter
        const now = new Date()
        let cutoff = new Date()
        switch (timeRange) {
            case '1w':
                cutoff.setDate(now.getDate() - 7)
                break
            case '1m':
                cutoff.setMonth(now.getMonth() - 1)
                break
            case '3m':
                cutoff.setMonth(now.getMonth() - 3)
                break
            case '6m':
                cutoff.setMonth(now.getMonth() - 6)
                break
            case '1y':
                cutoff.setFullYear(now.getFullYear() - 1)
                break
        }
        const cutoffTime = cutoff.getTime();
        const initialCumulative = tokenData
            .filter((d) => new Date(d.date).getTime() < cutoffTime)
            .reduce((sum, d) => sum + (d.total_depo - d.total_with), 0);

        const filtered = tokenData.filter((d) => new Date(d.date).getTime() >= cutoffTime)

        let cumulative = initialCumulative;
        return filtered.map((d) => {
            cumulative += (d.total_depo - d.total_with);
            return {
                ...d,
                net_remaining: cumulative
            }
        })
    }, [data, selectedToken, timeRange])
    if (isLoading) {
        return (
            <Card className="p-8 bg-background border border-border animate-pulse" style={{ borderRadius: 'var(--radius-md)' }}>
                <h3 className="text-xs font-semibold text-muted-foreground/60 mb-8">Fund Flow</h3>
                <div className="h-64 bg-secondary/10" style={{ borderRadius: 'var(--radius-sm)' }} />
            </Card>
        )
    }

    return (
        <Card className="p-6 md:p-8 bg-background border border-border flex flex-col" style={{ borderRadius: 'var(--radius-md)' }}>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fund Flow</h3>
                <div className="flex flex-wrap items-center gap-2">
                    <Select value={selectedToken} onValueChange={setSelectedToken}>
                        <SelectTrigger className="w-[100px] h-8 bg-transparent border border-border text-[10px] font-bold text-muted-foreground uppercase hover:bg-muted transition-colors" style={{ borderRadius: 'var(--radius-sm)' }}>
                            <SelectValue placeholder="Asset" />
                        </SelectTrigger>
                        <SelectContent className="bg-card border border-border" style={{ borderRadius: 'var(--radius-sm)' }}>
                            {tokens.map((t) => (
                                <SelectItem key={t} value={t} className="text-[10px] font-bold uppercase">{t}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1">
                        {(['1w', '1m', '3m', '6m', '1y'] as const).map((range) => (
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

            <div className="h-64 w-full">
                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorDepo" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorWith" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.05} />
                            <XAxis
                                dataKey="date"
                                tickFormatter={(val) => {
                                    const d = new Date(val);
                                    return `${d.getMonth() + 1}/${d.getDate()}`
                                }}
                                stroke="currentColor"
                                fontSize={9}
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: 'currentColor', opacity: 0.2, fontWeight: 'bold' }}
                                dy={10}
                            />
                            <YAxis
                                tickFormatter={(val) => val === 0 ? '0' : formatNumber(val)}
                                stroke="currentColor"
                                fontSize={9}
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: 'currentColor', opacity: 0.2, fontWeight: 'bold' }}
                                width={60}
                                dx={-10}
                            />
                            <Tooltip
                                content={({ active, payload, label }) => {
                                    if (active && payload && payload.length && label) {
                                        const d = new Date(label);
                                        const dateStr = !isNaN(d.getTime()) ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : label;
                                        return (
                                            <div className="bg-card border border-border p-4 min-w-[160px]" style={{ borderRadius: 'var(--radius-sm)' }}>
                                                <p className="text-[9px] text-muted-foreground/40 font-bold   mb-3">{dateStr}</p>
                                                <div className="space-y-2">
                                                    {payload.map((entry: any, index: number) => (
                                                        <div key={index} className="flex items-center justify-between gap-4">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
                                                                <span className="text-[10px] text-foreground/60 font-medium">{entry.name}</span>
                                                            </div>
                                                            <span className="text-[11px] font-bold text-foreground/80">{formatNumber(entry.value)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )
                                    }
                                    return null
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey="total_depo"
                                name="Inflow"
                                stroke="#22c55e"
                                fillOpacity={1}
                                fill="url(#colorDepo)"
                                strokeWidth={2}
                                isAnimationActive={!isMobile}
                                animationDuration={1500}
                                dot={false}
                                activeDot={{ r: 4, strokeWidth: 0, fill: '#22c55e' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="total_with"
                                name="Outflow"
                                stroke="#ef4444"
                                fillOpacity={1}
                                fill="url(#colorWith)"
                                strokeWidth={2}
                                isAnimationActive={!isMobile}
                                animationDuration={1500}
                                dot={false}
                                activeDot={{ r: 4, strokeWidth: 0, fill: '#ef4444' }}
                            />
                            {showNetRemaining && (
                                <Area
                                    type="monotone"
                                    dataKey="net_remaining"
                                    name="Retention"
                                    stroke="#f59e0b"
                                    fill="none"
                                    strokeWidth={2}
                                    strokeDasharray="4 4"
                                    isAnimationActive={!isMobile}
                                    animationDuration={1500}
                                    dot={false}
                                />
                            )}
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex h-full items-center justify-center">
                        <p className="text-[10px] text-muted-foreground/20 font-bold  ">Data stream offline for {selectedToken}</p>
                    </div>
                )}
            </div>

            <div className="mt-6 pt-4 border-t border-border flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-foreground" />
                        <span className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider">deposits</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                        <span className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider">withdrawals</span>
                    </div>
                </div>

                <div className="flex items-center gap-3 px-3 py-1.5 border border-border" style={{ borderRadius: 'var(--radius-sm)' }}>
                    <Checkbox
                        id="show-net-remaining"
                        checked={showNetRemaining}
                        onCheckedChange={(checked) => setShowNetRemaining(checked as boolean)}
                        className="h-3.5 w-3.5 border-border data-[state=checked]:bg-foreground data-[state=checked]:border-foreground"
                    />
                    <label
                        htmlFor="show-net-remaining"
                        className="text-[9px] font-bold text-muted-foreground cursor-pointer select-none"
                    >
                        Show Retention
                    </label>
                </div>
            </div>
        </Card>
    )
}

