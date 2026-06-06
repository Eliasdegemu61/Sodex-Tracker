'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';
import { usePortfolio } from '@/context/portfolio-context';
import { useMemo, useState, useEffect } from 'react';
import { fetchAccountDetails, fastPerpsStateToAccountDetails, type OpenPositionData, type BalanceData, type OpenOrderData } from '@/lib/sodex-api';
import { cacheManager } from '@/lib/cache';

export function OpenPositions({ accountId }: { accountId?: string | null }) {
  const portfolio = usePortfolio();
  const userId = accountId || portfolio?.userId;
  const [openPositions, setOpenPositions] = useState<OpenPositionData[]>([]);
  const [balanceData, setBalanceData] = useState<BalanceData | null>(null);
  const [openOrders, setOpenOrders] = useState<OpenOrderData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const DEFAULT_ROWS = 7;

  useEffect(() => {
    const perpsState = portfolio?.fastAccountState?.perps;
    if (!perpsState) return;

    const accountData = fastPerpsStateToAccountDetails(perpsState);

    setOpenPositions(accountData.positions);
    setBalanceData(accountData.balances[0] || null);
    setOpenOrders(accountData.openOrders || []);
    setLastUpdateTime(new Date().toLocaleTimeString());
    setError(null);
  }, [portfolio?.fastAccountState]);

  const loadOpenPositions = async (skipCache = false) => {
    if (!userId) return;

    try {
      if (skipCache) {
        cacheManager.delete(`accountDetails_${userId}`);
      }

      const accountData = await fetchAccountDetails(userId);
      const positions = accountData.positions;

      setOpenPositions(positions);
      setBalanceData(accountData.balances[0] || null);
      setOpenOrders(accountData.openOrders || []);
      setLastUpdateTime(new Date().toLocaleTimeString());
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch open positions';
      setError(errorMessage);
    }
  };

  // Initial fetch when component mounts or userId changes - ALWAYS FRESH DATA
  useEffect(() => {
    if (!userId) return;

    setIsLoading(openPositions.length === 0);
    // Clear cache before initial fetch to get fresh data on page load
    cacheManager.delete(`accountDetails_${userId}`);
    console.log('[v0] Cleared cache for fresh data on page load');
    loadOpenPositions().then(() => setIsLoading(false));
  }, [userId]);

  // Auto-refresh every 1 second with cache bypass
  useEffect(() => {
    if (!userId) return;

    const refreshInterval = setInterval(() => {
      setIsRefreshing(true);
      loadOpenPositions(true).then(() => setIsRefreshing(false)); // true = skip cache
    }, 5000); // 5 seconds

    return () => clearInterval(refreshInterval);
  }, [userId]);

  const displayPositions = useMemo(() => {
    return openPositions.map((position) => {
      const pId = position.symbol + position.positionSide;

      let tp = "None";
      let sl = "None";

      // Map open orders to find TP/SL relating to this position
      if (openOrders && Array.isArray(openOrders)) {
        openOrders.forEach((order) => {
          if (String(order.positionId) === String(position.positionId)) {
            if (order.triggerProfitPrice) tp = order.triggerProfitPrice;
            if (order.triggerStopPrice) sl = order.triggerStopPrice;
          }
        });
      }

      return {
        id: pId,
        symbol: position.symbol,
        side: position.positionSide,
        size: parseFloat(position.positionSize),
        entry: parseFloat(position.entryPrice),
        liquidation: parseFloat(position.liquidationPrice),
        margin: parseFloat(position.isolatedMargin),
        leverage: position.leverage,
        unrealized: parseFloat(position.unrealizedProfit),
        realized: parseFloat(position.realizedProfit),
        fee: parseFloat(position.cumTradingFee),
        createdAt: new Date(position.createdTime).toLocaleString(),
        tp: tp,
        sl: sl,
        positionId: position.positionId,
        margin_type: position.positionType
      };
      // Sort by positionId ascending for a stable, consistent order on every refresh
    }).sort((a, b) => String(a.positionId).localeCompare(String(b.positionId)));
  }, [openPositions, openOrders]);

  // Show 7 by default, expand on demand
  const visiblePositions = showAll ? displayPositions : displayPositions.slice(0, DEFAULT_ROWS);
  const hasMore = displayPositions.length > DEFAULT_ROWS;

  // Pagination logic (only when expanded)
  const totalPages = showAll ? Math.ceil(visiblePositions.length / rowsPerPage) : 1;
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedPositions = showAll ? visiblePositions.slice(startIndex, endIndex) : visiblePositions;

  const totalMarginInUse = useMemo(() => {
    return visiblePositions.reduce((sum, pos) => sum + pos.margin, 0);
  }, [visiblePositions]);

  const openStats = useMemo(() => {
    const totalUnrealized = visiblePositions.reduce((sum, pos) => sum + pos.unrealized, 0);
    const totalFees = visiblePositions.reduce((sum, pos) => sum + pos.fee, 0);
    const notional = visiblePositions.reduce((sum, pos) => sum + Math.abs(pos.size * pos.entry), 0);
    const longCount = visiblePositions.filter((pos) => pos.side === 'LONG').length;
    const shortCount = displayPositions.length - longCount;
    const avgLeverage = totalMarginInUse > 0 ? notional / totalMarginInUse : 0;

    return { totalUnrealized, totalFees, notional, longCount, shortCount, avgLeverage };
  }, [visiblePositions, totalMarginInUse]);

  const formatCurrency = (value: number, decimals = 2) => {
    const sign = value < 0 ? '-' : '';
    return `${sign}$${Math.abs(value).toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`;
  };

  const formatPrice = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return '--';
    return `$${value.toLocaleString(undefined, {
      minimumFractionDigits: value >= 100 ? 2 : 4,
      maximumFractionDigits: value >= 100 ? 2 : 4,
    })}`;
  };

  const handleRowsPerPageChange = (newRows: number) => {
    setRowsPerPage(newRows);
    setCurrentPage(1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  if (!userId) {
    return (
      <Card className="rounded-[2rem] border border-black/8 bg-white p-12 text-center text-foreground shadow-[0_20px_60px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-black dark:text-white dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <AlertCircle className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-black/35 dark:text-white/35">No account bound</h3>
        <p className="text-[10px] font-medium text-black/35 dark:text-white/35 uppercase tracking-[0.18em]">Bind your account to view open positions</p>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="rounded-[2rem] border border-black/8 bg-white p-12 text-center text-foreground shadow-[0_20px_60px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-black dark:text-white dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <div className="flex flex-col items-center justify-center p-8">
          <div className="mb-4 h-8 w-8 rounded-full border-2 border-black/15 border-t-black animate-spin dark:border-white/15 dark:border-t-white" />
          <p className="text-[10px] font-medium text-black/35 dark:text-white/35 uppercase tracking-[0.22em]">Scanning perimeter</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="rounded-[2rem] border border-red-500/20 bg-white p-8 text-foreground shadow-[0_20px_60px_rgba(0,0,0,0.08)] dark:bg-black dark:text-white dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <AlertCircle className="w-8 h-8 text-red-400/40 mb-3" />
          <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-red-300">Signal interrupted</h3>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/35 dark:text-white/35">{error}</p>
        </div>
      </Card>
    );
  }

  if (openPositions.length === 0) {
    return (
      <div className="border border-border bg-card" style={{ borderRadius: 'var(--radius-md)' }}>
        <div className="px-4 py-3 border-b border-border">
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Open Positions</span>
        </div>
        <div className="flex items-center justify-center p-8">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40">No open positions</p>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-border bg-card text-foreground overflow-hidden" style={{ borderRadius: 'var(--radius-md)' }}>
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Open Positions</span>
            <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 border border-border text-muted-foreground" style={{ borderRadius: 'var(--radius-sm)' }}>
              {displayPositions.length} live
            </span>
            {isRefreshing && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/40" />}
          </div>
          {lastUpdateTime && (
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">Sync {lastUpdateTime}</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 divide-x divide-y divide-border border-b border-border">
        {[
          { label: 'Unrealized', value: `${openStats.totalUnrealized >= 0 ? '+' : ''}${formatCurrency(openStats.totalUnrealized)}`, tone: openStats.totalUnrealized >= 0 ? 'text-[var(--success)]' : 'text-destructive' },
          { label: 'Notional', value: formatCurrency(openStats.notional, 0), tone: 'text-foreground' },
          { label: 'Margin used', value: formatCurrency(totalMarginInUse), tone: 'text-foreground' },
          { label: 'Avg lev.', value: `${openStats.avgLeverage.toFixed(1)}x`, tone: 'text-foreground' },
          { label: 'Long / Short', value: `${openStats.longCount} / ${openStats.shortCount}`, tone: 'text-foreground' },
          { label: 'Available', value: balanceData ? formatCurrency(parseFloat(balanceData.availableBalance)) : '--', tone: 'text-[var(--success)]' },
        ].map((stat) => (
          <div key={stat.label} className="flex flex-col gap-1.5 p-3">
            <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{stat.label}</p>
            <p className={`text-sm font-bold tracking-tight ${stat.tone}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-[10px] text-left">
          <thead>
            <tr className="border-b border-border">
              {['Market','Side','Mode','Size','Entry','Mark risk','Margin','Lev.','Unrealized','TP / SL','Fees'].map((h, i) => (
                <th key={h} className={`py-2.5 px-3 text-[8px] font-bold uppercase tracking-[0.18em] text-muted-foreground ${i > 2 ? 'text-right' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paginatedPositions.map((pos) => {
              const isProfit = pos.unrealized >= 0;
              return (
                <tr key={pos.id} className="hover:bg-muted/20 transition-colors">
                  <td className="py-3 px-3 font-bold text-foreground">{pos.symbol}</td>
                  <td className="py-3 px-3">
                    <span className={`text-[9px] font-bold tracking-widest ${pos.side === 'LONG' ? 'text-[var(--success)]' : 'text-destructive'}`}>{pos.side}</span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{pos.margin_type}</span>
                  </td>
                  <td className="py-3 px-3 text-right text-muted-foreground">{pos.size.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                  <td className="py-3 px-3 text-right text-muted-foreground">{formatPrice(pos.entry)}</td>
                  <td className="py-3 px-3 text-right text-destructive">{formatPrice(pos.liquidation)}</td>
                  <td className="py-3 px-3 text-right text-muted-foreground">{formatCurrency(pos.margin)}</td>
                  <td className="py-3 px-3 text-right font-bold text-foreground">{pos.leverage}x</td>
                  <td className={`py-3 px-3 text-right font-bold ${isProfit ? 'text-[var(--success)]' : 'text-destructive'}`}>
                    {isProfit ? '+' : ''}{formatCurrency(pos.unrealized)}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span className="text-[var(--success)]/70 text-[10px]">{pos.tp === 'None' ? '--' : formatPrice(parseFloat(pos.tp))}</span>
                    <span className="mx-1 text-muted-foreground/30">/</span>
                    <span className="text-destructive/70 text-[10px]">{pos.sl === 'None' ? '--' : formatPrice(parseFloat(pos.sl))}</span>
                  </td>
                  <td className="py-3 px-3 text-right text-muted-foreground">{formatCurrency(pos.fee)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile List */}
      <div className="md:hidden divide-y divide-border">
        {paginatedPositions.map((pos) => {
          const isProfit = pos.unrealized >= 0;
          return (
            <div key={pos.id} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-foreground">{pos.symbol}</span>
                  <span className={`text-[8px] font-bold tracking-widest ${pos.side === 'LONG' ? 'text-[var(--success)]' : 'text-destructive'}`}>{pos.side}</span>
                  <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/50">{pos.margin_type}</span>
                </div>
                <span className={`font-bold text-sm ${isProfit ? 'text-[var(--success)]' : 'text-destructive'}`}>
                  {isProfit ? '+' : ''}{formatCurrency(pos.unrealized)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-y-2.5 gap-x-2">
                {[['Entry', formatPrice(pos.entry), ''], ['Mark risk', formatPrice(pos.liquidation), 'text-destructive'], ['Size', pos.size.toLocaleString(undefined,{maximumFractionDigits:4}), ''], ['Margin/Lev', `${formatCurrency(pos.margin)} / ${pos.leverage}x`, ''], ['TP/SL', `${pos.tp === 'None' ? '--' : formatPrice(parseFloat(pos.tp))} / ${pos.sl === 'None' ? '--' : formatPrice(parseFloat(pos.sl))}`, ''], ['Fees', formatCurrency(pos.fee), '']].map(([label, val, tone]) => (
                  <div key={label} className="flex flex-col gap-0.5">
                    <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/50">{label}</span>
                    <span className={`text-[11px] font-bold text-muted-foreground ${tone}`}>{val}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2.5 pt-2.5 border-t border-border flex justify-between text-[9px] text-muted-foreground/40 font-bold uppercase tracking-widest">
                <span>Opened</span><span>{pos.createdAt}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* See All / See Less + Pagination */}
      <div className="flex flex-col items-center border-t border-border">
        {hasMore && (
          <button
            onClick={() => { setShowAll(!showAll); setCurrentPage(1); }}
            className="w-full py-2.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
          >
            {showAll ? 'See Less ↑' : `See All (${displayPositions.length}) ↓`}
          </button>
        )}
        {showAll && totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 w-full px-4 py-3">
            <div className="flex items-center gap-1">
              {[10, 25, 50].map((count) => (
                <button key={count} onClick={() => handleRowsPerPageChange(count)}
                  className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest border transition-colors ${
                    rowsPerPage === count ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
                  }`} style={{ borderRadius: 'var(--radius-sm)' }}>
                  {count}
                </button>
              ))}
            </div>
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">Page {currentPage} / {totalPages}</span>
            <div className="flex gap-1">
              <button onClick={handlePrevPage} disabled={currentPage === 1} className="p-1.5 border border-border text-muted-foreground hover:text-foreground hover:border-foreground disabled:opacity-25 transition-colors" style={{ borderRadius: 'var(--radius-sm)' }}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button onClick={handleNextPage} disabled={currentPage === totalPages} className="p-1.5 border border-border text-muted-foreground hover:text-foreground hover:border-foreground disabled:opacity-25 transition-colors" style={{ borderRadius: 'var(--radius-sm)' }}>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

