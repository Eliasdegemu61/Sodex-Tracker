'use client';

import React, { useMemo, useState, useEffect } from "react"


import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Trophy, TrendingUp, Activity, BarChart3, Settings2, Target, Wallet, Layers3 } from 'lucide-react';
import { usePortfolio } from '@/context/portfolio-context';
import { fetchPnLOverview, getVolumeFromPnLOverview, fetchDetailedBalance } from '@/lib/sodex-api';
import { getTokenPrice } from '@/lib/token-price-service';
import { cn } from '@/lib/utils';

// Cool loading animation component with gradient shimmer effect
function LoadingShimmer({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden bg-muted/20 rounded-lg animate-pulse", className)}>
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" style={{ animationName: 'shimmer' }} />
      <style>{`
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}

interface PortfolioStat {
  label: string;
  value: string | number;
  subtitle?: string;
  change?: number;
  icon: React.ReactNode;
  breakdown?: {
    futures?: number;
    spot?: number;
    vault?: number;
    futures_label?: string;
    spot_label?: string;
    vault_label?: string;
  };
}

export function PortfolioOverview() {
  const { positions, userId, vaultBalance, setVaultBalance, walletAddress, sourceWalletAddress, fastAccountState, pnlDailyStats } = usePortfolio();

  const [balances, setBalances] = useState({
    total: 0,
    spot: 0,
    futures: 0,
    vault: 0,
    hasUnpricedAssets: false,
    tokens: [] as any[]
  });

  const [metrics, setMetrics] = useState({
    futuresVolume: 0,
    futuresFees: 0,
    pnl30d: 0,
    vaultPnl: 0,
    vaultShares: 0
  });

  const [loading, setLoading] = useState({
    balances: false,
    futuresMetrics: false,
    vault: false
  });

  // 1. Fetch Balances
  useEffect(() => {
    const perps = fastAccountState?.perps;
    if (!perps) return;

    const usdc = perps.B?.find((balance) => balance.a === 'vUSDC') || perps.B?.[0];
    const futuresBalance = parseFloat(usdc?.wb || perps.av || '0');

    setBalances(prev => ({
      ...prev,
      total: Math.max(prev.total, futuresBalance),
      futures: futuresBalance,
    }));
  }, [fastAccountState]);

  useEffect(() => {
    if (!userId) return;

    const fetchBalances = async () => {
      setLoading(prev => ({ ...prev, balances: true }));
      try {
        const data = await fetchDetailedBalance(userId);
        setBalances(prev => ({
          ...prev,
          total: data.totalUsdValue,
          spot: data.spotBalance,
          futures: data.futuresBalance,
          hasUnpricedAssets: data.hasUnpricedAssets || false,
          tokens: data.tokens || []
        }));
      } catch (err) {
        console.error('[v0] Error fetching balances:', err);
      } finally {
        setLoading(prev => ({ ...prev, balances: false }));
      }
    };

    fetchBalances();
    const interval = setInterval(fetchBalances, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  // 2. Fetch Metrics (Volume, Fees, PnL)
  useEffect(() => {
    if (!userId || !positions) return;

    const fetchMetrics = async () => {
      setLoading(prev => ({ ...prev, futuresMetrics: true }));
      
      try {
        const pnlData = await fetchPnLOverview(userId);
        const fVol = getVolumeFromPnLOverview(pnlData);
        
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const dailyPnl30 = Array.isArray(pnlDailyStats) && pnlDailyStats.length > 0
          ? [...pnlDailyStats]
            .sort((a, b) => a.ts_ms - b.ts_ms)
            .reduce((acc, item, index, arr) => {
              if (item.ts_ms < thirtyDaysAgo) return acc;
              const previous = index > 0 ? parseFloat(arr[index - 1].pnl || '0') : 0;
              return acc + (parseFloat(item.pnl || '0') - previous);
            }, 0)
          : null;

        const pnl30 = dailyPnl30 ?? (Array.isArray(positions) 
          ? positions
            .filter(p => (p.updated_at || 0) >= thirtyDaysAgo)
            .reduce((sum, p) => sum + (p.realizedPnlValue || 0), 0)
          : 0);

        const fFees = Array.isArray(positions)
          ? positions.reduce((sum, p) => sum + (parseFloat(p.cum_trading_fee || '0') || 0), 0)
          : 0;

        setMetrics(prev => ({
          ...prev,
          futuresVolume: fVol,
          futuresFees: fFees,
          pnl30d: pnl30
        }));
      } catch (err) {
        console.error('[v0] Error fetching futures metrics:', err);
      } finally {
        setLoading(prev => ({ ...prev, futuresMetrics: false }));
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 45000);
    return () => clearInterval(interval);
  }, [userId, positions, pnlDailyStats]);

  // 3. Fetch Vault Data
  useEffect(() => {
    const addr = sourceWalletAddress || walletAddress;
    if (!addr) return;

    const fetchVault = async () => {
      setLoading(prev => ({ ...prev, vault: true }));
      try {
        const response = await fetch('/api/sodex/vault-position', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: addr }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.code === '0' && data.data) {
            const shares = data.data.shares || 0;
            const mag7Price = await getTokenPrice('MAG7.ssi');
            const sharesUsd = shares * mag7Price;

            setMetrics(prev => ({
              ...prev,
              vaultPnl: data.data.pnl,
              vaultShares: shares
            }));

            setBalances(prev => ({ ...prev, vault: sharesUsd }));
            setVaultBalance(sharesUsd);
          }
        }
      } catch (err) {
        console.error('[v0] Error fetching vault:', err);
      } finally {
        setLoading(prev => ({ ...prev, vault: false }));
      }
    };

    fetchVault();
    const interval = setInterval(fetchVault, 60000);
    return () => clearInterval(interval);
  }, [walletAddress, sourceWalletAddress, setVaultBalance]);

  // Rank Selection State
  const [rankOptions, setRankOptions] = useState({
    windowType: '30D' as '24H' | '7D' | '30D' | 'ALL_TIME',
    sortBy: 'volume' as 'pnl' | 'volume'
  });
  const [userRankData, setUserRankData] = useState<any>(null);
  const [isRankLoading, setIsRankLoading] = useState(false);

  // Fetch Live Rank
  useEffect(() => {
    const addr = sourceWalletAddress || walletAddress;
    if (!addr) return;

    const loadRank = async () => {
      setIsRankLoading(true);
      try {
        const { fetchUserRank } = await import('@/lib/sodex-api');
        const data = await fetchUserRank(addr, rankOptions.windowType, rankOptions.sortBy);
        setUserRankData(data);
      } catch (err) {
        console.error('[v0] Error fetching live rank:', err);
      } finally {
        setIsRankLoading(false);
      }
    };

    loadRank();
  }, [walletAddress, sourceWalletAddress, rankOptions]);

  const totalNetWorth = balances.total + balances.vault;
  const isSyncing = loading.balances || loading.futuresMetrics || loading.vault;
  const accountPnl = useMemo(() => {
    if (Array.isArray(pnlDailyStats) && pnlDailyStats.length > 0) {
      const latest = [...pnlDailyStats].sort((a, b) => a.ts_ms - b.ts_ms).at(-1);
      return parseFloat(latest?.pnl || '0');
    }

    return Array.isArray(positions)
      ? positions.reduce((sum, position) => sum + (position.realizedPnlValue || 0), 0)
      : 0;
  }, [pnlDailyStats, positions]);
  const isAccountProfit = accountPnl >= 0;
  const accountPnlPercent = totalNetWorth > 0 ? (accountPnl / totalNetWorth) * 100 : 0;

  const formatCurrency = (value: number, decimals = 0) => {
    const sign = value < 0 ? '-' : '';
    return `${sign}$${Math.abs(value).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`;
  };

  const tradingStats = [
    {
      label: '30D PnL',
      value: `${metrics.pnl30d >= 0 ? '+' : '-'}$${Math.abs(metrics.pnl30d).toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
      icon: <TrendingUp className="h-4 w-4" />,
      tone: metrics.pnl30d >= 0 ? 'text-green-400' : 'text-red-400',
    },
    {
      label: `${rankOptions.windowType} rank`,
      value: isRankLoading ? '...' : `#${userRankData?.rank || '---'}`,
      icon: <Trophy className="h-4 w-4" />,
      tone: 'text-foreground',
    },
    {
      label: 'Vault',
      value: `${metrics.vaultShares.toFixed(2)} MAG7`,
      icon: <Target className="h-4 w-4" />,
      tone: metrics.vaultPnl >= 0 ? 'text-green-400' : 'text-red-400',
    },
  ];

  return (
    <Card className="relative overflow-hidden rounded-xl border border-black/8 bg-white text-foreground shadow-[0_20px_60px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-black dark:text-white dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)] md:rounded-[2rem]">
      <div className="p-3 md:p-8">
        <div className="mb-4 flex flex-col gap-3 md:mb-6 md:flex-row md:items-end md:justify-between md:gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-black/35 dark:text-white/35">Portfolio</p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-foreground md:text-3xl">
              Overview
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl border border-black/10 bg-black/[0.03] text-black/65 hover:bg-black/[0.06] hover:text-black dark:border-white/10 dark:bg-white/[0.03] dark:text-white/65 dark:hover:bg-white/[0.07] dark:hover:text-white">
                  <Settings2 className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 rounded-2xl border-black/10 bg-white p-4 text-foreground shadow-2xl dark:border-white/10 dark:bg-[#090909] dark:text-white" align="end">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-semibold uppercase tracking-[0.22em] text-black/40 dark:text-white/40">Timeframe</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(['24H', '7D', '30D', 'ALL_TIME'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setRankOptions(prev => ({ ...prev, windowType: t }))}
                          className={cn(
                            "rounded-xl border px-2 py-2 text-[10px] font-semibold transition-all",
                            rankOptions.windowType === t
                              ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                              : "border-black/10 bg-black/[0.03] text-black/60 hover:bg-black/[0.06] hover:text-black dark:border-white/10 dark:bg-white/[0.03] dark:text-white/60 dark:hover:bg-white/[0.06] dark:hover:text-white"
                          )}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-semibold uppercase tracking-[0.22em] text-black/40 dark:text-white/40">Sort by</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(['pnl', 'volume'] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setRankOptions(prev => ({ ...prev, sortBy: s }))}
                          className={cn(
                            "flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-[10px] font-semibold transition-all",
                            rankOptions.sortBy === s
                              ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                              : "border-black/10 bg-black/[0.03] text-black/60 hover:bg-black/[0.06] hover:text-black dark:border-white/10 dark:bg-white/[0.03] dark:text-white/60 dark:hover:bg-white/[0.06] dark:hover:text-white"
                          )}
                        >
                          {s === 'pnl' ? <Activity className="h-3 w-3" /> : <BarChart3 className="h-3 w-3" />}
                          <span className="capitalize">{s}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="md:hidden">
          <div className={cn(
            "relative overflow-hidden rounded-xl border p-3",
            isAccountProfit
              ? "border-green-500/20 bg-green-500/[0.045]"
              : "border-red-500/20 bg-red-500/[0.045]"
          )}>
            <div className={cn(
              "absolute inset-y-3 left-0 w-1 rounded-r-full",
              isAccountProfit ? "bg-green-500" : "bg-red-500"
            )} />
            <div className="pl-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[8px] font-semibold uppercase tracking-[0.18em] text-black/35 dark:text-white/35">Account PnL</p>
                  <div className="mt-1 flex flex-wrap items-baseline gap-2">
                    <p className={cn("text-2xl font-semibold tracking-[-0.05em]", isAccountProfit ? "text-green-400" : "text-red-400")}>
                      {accountPnl >= 0 ? '+' : ''}{formatCurrency(accountPnl, 2)}
                    </p>
                    <span className={cn("rounded-full px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em]", isAccountProfit ? "bg-green-500/12 text-green-400" : "bg-red-500/12 text-red-400")}>
                      {accountPnlPercent >= 0 ? '+' : ''}{accountPnlPercent.toFixed(2)}%
                    </span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-black/35 dark:text-white/35">Net worth</p>
                  <p className="mt-1 text-xl font-semibold tracking-[-0.04em] text-foreground">{formatCurrency(totalNetWorth)}</p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                  ...tradingStats,
                  { label: 'Futures', value: formatCurrency(balances.futures), icon: <Activity className="h-3.5 w-3.5" />, tone: 'text-foreground' },
                  { label: 'Spot', value: formatCurrency(balances.spot), icon: <Wallet className="h-3.5 w-3.5" />, tone: 'text-foreground' },
                  { label: 'Vault bal.', value: formatCurrency(balances.vault), icon: <Layers3 className="h-3.5 w-3.5" />, tone: 'text-foreground' },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border border-black/8 bg-black/[0.025] p-2 dark:border-white/10 dark:bg-white/[0.04]">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[7px] font-semibold uppercase tracking-[0.14em] text-black/35 dark:text-white/35">{item.label}</p>
                      <span className="text-black/30 dark:text-white/35">{item.icon}</span>
                    </div>
                    <p className={cn("mt-1 truncate text-sm font-semibold tracking-[-0.03em]", item.tone)}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="hidden gap-3 md:grid md:gap-4 xl:grid-cols-[1.35fr_1fr]">
          <div className={cn(
            "relative overflow-hidden rounded-xl border p-4 md:p-5 md:rounded-[1.5rem]",
            isAccountProfit
              ? "border-green-500/20 bg-green-500/[0.045]"
              : "border-red-500/20 bg-red-500/[0.045]"
          )}>
            <div className={cn(
              "absolute inset-y-5 left-0 w-1 rounded-r-full",
              isAccountProfit ? "bg-green-500" : "bg-red-500"
            )} />
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div className="pl-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-black/35 dark:text-white/35">Account PnL</p>
                <div className="mt-2 flex flex-wrap items-baseline gap-2 md:mt-3 md:gap-3">
                  <p className={cn("text-2xl font-semibold tracking-[-0.05em] md:text-5xl", isAccountProfit ? "text-green-400" : "text-red-400")}>
                    {accountPnl >= 0 ? '+' : ''}{formatCurrency(accountPnl, 2)}
                  </p>
                  <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] md:px-2.5 md:py-1 md:text-[10px]", isAccountProfit ? "bg-green-500/12 text-green-400" : "bg-red-500/12 text-red-400")}>
                    {accountPnlPercent >= 0 ? '+' : ''}{accountPnlPercent.toFixed(2)}%
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {balances.hasUnpricedAssets ? 'Net worth includes priced assets; some holdings are omitted.' : 'Realized account result against current net worth.'}
                </p>
              </div>

              <div className="rounded-xl border border-black/8 bg-white/55 p-3 dark:border-white/10 dark:bg-black/30 md:min-w-48 md:rounded-2xl md:p-4">
                <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-black/35 dark:text-white/35">Net worth</p>
                {loading.balances && totalNetWorth === 0 ? (
                  <LoadingShimmer className="mt-3 h-8 w-28" />
                ) : (
                  <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground md:text-3xl">{formatCurrency(totalNetWorth)}</p>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 md:gap-3 xl:grid-cols-1">
            {tradingStats.map((item) => (
              <div key={item.label} className="rounded-xl border border-black/8 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.03] md:rounded-[1.5rem] md:p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-black/35 dark:text-white/35">{item.label}</p>
                  <span className="text-black/35 dark:text-white/35">{item.icon}</span>
                </div>
                <p className={cn("mt-2 truncate text-lg font-semibold tracking-[-0.04em] md:mt-3 md:text-xl", item.tone)}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 hidden gap-2 md:mt-4 md:grid md:gap-3 md:grid-cols-3">
          {[
            { label: 'Futures balance', value: balances.futures, loading: loading.balances, icon: <Activity className="h-4 w-4" /> },
            { label: 'Spot balance', value: balances.spot, loading: loading.balances, icon: <Wallet className="h-4 w-4" /> },
            { label: 'Vault balance', value: balances.vault, loading: loading.vault, icon: <Layers3 className="h-4 w-4" /> },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-3 rounded-xl border border-black/8 bg-black/[0.02] p-3 dark:border-white/8 dark:bg-white/[0.02] md:gap-4 md:rounded-[1.25rem] md:p-4">
              <div>
                <p className="text-[9px] uppercase tracking-[0.2em] text-black/35 dark:text-white/35">{item.label}</p>
                {item.loading && item.value === 0 ? (
                  <LoadingShimmer className="mt-2 h-5 w-20 md:mt-3 md:h-6" />
                ) : (
                  <p className="mt-1 text-base font-medium text-foreground md:mt-2 md:text-lg">{formatCurrency(item.value)}</p>
                )}
              </div>
              <span className="text-black/25 dark:text-white/25">{item.icon}</span>
            </div>
          ))}
        </div>

        {isSyncing && (
          <div className="mt-5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-black/30 dark:text-white/30">
            <div className="h-2 w-2 rounded-full bg-black/35 animate-pulse dark:bg-white/35" />
            {'Updating account data'}
          </div>
        )}
      </div>
    </Card>
  );
}
