'use client';

import React, { useMemo, useState, useEffect } from "react"


import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Trophy, TrendingUp, Activity, Settings2, Wallet, Layers3 } from 'lucide-react';
import { usePortfolio } from '@/context/portfolio-context';
import { fetchPnLOverview, getVolumeFromPnLOverview, fetchDetailedBalance } from '@/lib/sodex-api';
import { getTokenPrice } from '@/lib/token-price-service';
import { cn } from '@/lib/utils';

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

  const allStats = [
    { label: 'Net Worth', value: loading.balances && totalNetWorth === 0 ? null : formatCurrency(totalNetWorth), icon: <Wallet className="h-3 w-3" />, tone: 'text-foreground', span: true },
    { label: 'Account PnL', value: `${accountPnl >= 0 ? '+' : ''}${formatCurrency(accountPnl, 2)}`, icon: <TrendingUp className="h-3 w-3" />, tone: isAccountProfit ? 'text-[var(--success)]' : 'text-destructive', badge: `${accountPnlPercent >= 0 ? '+' : ''}${accountPnlPercent.toFixed(2)}%`, badgeTone: isAccountProfit ? 'text-[var(--success)]' : 'text-destructive' },
    { label: '30D PnL', value: `${metrics.pnl30d >= 0 ? '+' : ''}${formatCurrency(metrics.pnl30d, 2)}`, icon: <Activity className="h-3 w-3" />, tone: metrics.pnl30d >= 0 ? 'text-[var(--success)]' : 'text-destructive' },
    { label: `Rank · ${rankOptions.windowType}`, value: isRankLoading ? '...' : `#${userRankData?.rank || '—'}`, icon: <Trophy className="h-3 w-3" />, tone: 'text-foreground' },
    { label: 'Futures', value: loading.balances ? null : formatCurrency(balances.futures), icon: <Activity className="h-3 w-3" />, tone: 'text-foreground' },
    { label: 'Spot', value: loading.balances ? null : formatCurrency(balances.spot), icon: <Wallet className="h-3 w-3" />, tone: 'text-foreground' },
    { label: 'Vault', value: loading.vault ? null : `${metrics.vaultShares.toFixed(2)} MAG7`, icon: <Layers3 className="h-3 w-3" />, tone: metrics.vaultPnl >= 0 ? 'text-[var(--success)]' : 'text-destructive' },
  ];

  return (
    <div className="border border-border bg-card" style={{ borderRadius: 'var(--radius-md)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Overview</span>
        <div className="flex items-center gap-2">
          {isSyncing && (
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-pulse" />
              Updating
            </span>
          )}
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1 px-2 py-1 text-[9px] font-bold uppercase tracking-widest border border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-colors" style={{ borderRadius: 'var(--radius-sm)' }}>
                <Settings2 className="h-3 w-3" />
                Rank
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 border border-border bg-card p-0 shadow-lg" style={{ borderRadius: 'var(--radius-md)' }} align="end">
              <div className="px-3 py-2.5 border-b border-border">
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Timeframe</p>
              </div>
              <div className="p-2 grid grid-cols-2 gap-1">
                {(['24H', '7D', '30D', 'ALL_TIME'] as const).map((t) => (
                  <button key={t} onClick={() => setRankOptions(prev => ({ ...prev, windowType: t }))}
                    className={cn("py-2 text-[9px] font-bold uppercase tracking-widest border transition-colors",
                      rankOptions.windowType === t
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-muted-foreground hover:text-foreground hover:border-foreground"
                    )} style={{ borderRadius: 'var(--radius-sm)' }}>
                    {t}
                  </button>
                ))}
              </div>
              <div className="px-3 py-2.5 border-t border-border">
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Sort by</p>
              </div>
              <div className="p-2 grid grid-cols-2 gap-1">
                {(['pnl', 'volume'] as const).map((s) => (
                  <button key={s} onClick={() => setRankOptions(prev => ({ ...prev, sortBy: s }))}
                    className={cn("py-2 text-[9px] font-bold uppercase tracking-widest border transition-colors",
                      rankOptions.sortBy === s
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-muted-foreground hover:text-foreground hover:border-foreground"
                    )} style={{ borderRadius: 'var(--radius-sm)' }}>
                    {s}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-border">
        {allStats.map((stat, i) => (
          <div key={stat.label} className={cn("flex flex-col gap-2 p-4", stat.span && "col-span-2 sm:col-span-1")}>
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{stat.label}</span>
              <span className="opacity-20">{stat.icon}</span>
            </div>
            {stat.value === null ? (
              <div className="h-6 w-24 bg-muted animate-pulse rounded" />
            ) : (
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className={cn("text-xl font-bold tracking-tight leading-none stat-number", stat.tone)} style={{ letterSpacing: '-0.03em' }}>
                  {stat.value}
                </span>
                {stat.badge && (
                  <span className={cn("text-[9px] font-bold uppercase tracking-widest", stat.badgeTone)}>
                    {stat.badge}
                  </span>
                )}
              </div>
            )}
            {i === 0 && balances.hasUnpricedAssets && (
              <span className="text-[9px] text-muted-foreground/50">Some assets unpriced</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
