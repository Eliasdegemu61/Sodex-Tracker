'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';
import { usePortfolio } from '@/context/portfolio-context';
import { useMemo, useState, useEffect } from 'react';
import { fetchAccountDetails, fastPerpsStateToAccountDetails, type OpenPositionData, type BalanceData, type OpenOrderData } from '@/lib/sodex-api';
import { cacheManager } from '@/lib/cache';
import { getTokenLogo } from '@/lib/token-logos';

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

  // Pagination logic
  const totalPages = Math.ceil(displayPositions.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedPositions = displayPositions.slice(startIndex, endIndex);

  const totalMarginInUse = useMemo(() => {
    return displayPositions.reduce((sum, pos) => sum + pos.margin, 0);
  }, [displayPositions]);

  const openStats = useMemo(() => {
    const totalUnrealized = displayPositions.reduce((sum, pos) => sum + pos.unrealized, 0);
    const totalFees = displayPositions.reduce((sum, pos) => sum + pos.fee, 0);
    const notional = displayPositions.reduce((sum, pos) => sum + Math.abs(pos.size * pos.entry), 0);
    const longCount = displayPositions.filter((pos) => pos.side === 'LONG').length;
    const shortCount = displayPositions.length - longCount;
    const avgLeverage = totalMarginInUse > 0 ? notional / totalMarginInUse : 0;

    return { totalUnrealized, totalFees, notional, longCount, shortCount, avgLeverage };
  }, [displayPositions, totalMarginInUse]);

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
      <Card className="rounded-[2rem] border border-black/8 bg-white p-12 text-center text-foreground shadow-[0_20px_60px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-black dark:text-white dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-black/35 dark:text-white/35">No open positions</h3>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/25 dark:text-white/25">All systems clear</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden rounded-[2rem] border border-black/8 bg-white text-foreground shadow-[0_20px_60px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-black dark:text-white dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
      <div className="border-b border-black/8 p-4 dark:border-white/10 sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.22em] text-black/35 dark:text-white/35">Open positions</h3>
              <span className="rounded-full border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-green-500">
                {displayPositions.length} live
              </span>
              {isRefreshing && <Loader2 className="h-3.5 w-3.5 animate-spin text-orange-500" />}
            </div>
            <p className="mt-2 text-sm leading-5 text-muted-foreground/60">
              Live perps exposure, margin, liquidation risk, and unrealized PnL.
            </p>
          </div>

          {lastUpdateTime && (
            <span className="shrink-0 text-[9px] font-medium uppercase tracking-[0.16em] text-black/30 dark:text-white/30">
              Sync {lastUpdateTime}
            </span>
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
          {[
            { label: 'Unrealized', value: `${openStats.totalUnrealized >= 0 ? '+' : ''}${formatCurrency(openStats.totalUnrealized)}`, tone: openStats.totalUnrealized >= 0 ? 'text-green-500' : 'text-red-500' },
            { label: 'Notional', value: formatCurrency(openStats.notional, 0), tone: 'text-foreground' },
            { label: 'Margin used', value: formatCurrency(totalMarginInUse), tone: 'text-foreground' },
            { label: 'Avg lev.', value: `${openStats.avgLeverage.toFixed(1)}x`, tone: 'text-foreground' },
            { label: 'Long / Short', value: `${openStats.longCount} / ${openStats.shortCount}`, tone: 'text-foreground' },
            { label: 'Available', value: balanceData ? formatCurrency(parseFloat(balanceData.availableBalance)) : '--', tone: 'text-green-500' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-black/8 bg-black/[0.025] p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-black/35 dark:text-white/35">{stat.label}</p>
              <p className={`mt-1 truncate text-sm font-semibold tracking-[-0.03em] sm:text-base ${stat.tone}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] border-collapse text-left">
          <thead>
            <tr className="border-b border-black/8 bg-black/[0.025] text-[9px] font-semibold uppercase tracking-[0.16em] text-black/35 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/35">
              <th className="px-4 py-3">Market</th>
              <th className="px-4 py-3">Side</th>
              <th className="px-4 py-3 text-right">Size</th>
              <th className="px-4 py-3 text-right">Entry</th>
              <th className="px-4 py-3 text-right">Mark risk</th>
              <th className="px-4 py-3 text-right">Margin</th>
              <th className="px-4 py-3 text-right">Lev.</th>
              <th className="px-4 py-3 text-right">Unrealized</th>
              <th className="px-4 py-3 text-right">TP / SL</th>
              <th className="px-4 py-3 text-right">Fees</th>
            </tr>
          </thead>
          <tbody>
            {paginatedPositions.map((pos) => {
              const isProfit = pos.unrealized >= 0;
              const logo = getTokenLogo(pos.symbol);

              return (
                <tr key={pos.id} className="border-b border-black/6 transition-colors hover:bg-black/[0.025] dark:border-white/8 dark:hover:bg-white/[0.035]">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-black/8 bg-black/[0.03] dark:border-white/10 dark:bg-white/[0.04]">
                        {logo ? (
                          <img src={logo} alt={pos.symbol} className="h-5 w-5 object-contain" />
                        ) : (
                          <span className="text-xs font-semibold text-muted-foreground">{pos.symbol.charAt(0)}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{pos.symbol}</p>
                        <p className="truncate text-[9px] font-medium uppercase tracking-[0.14em] text-muted-foreground/45">#{pos.positionId} · {pos.margin_type}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] ${pos.side === 'LONG' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                      {pos.side}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right text-xs font-semibold tabular-nums text-foreground">{pos.size.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                  <td className="px-4 py-4 text-right text-xs font-semibold tabular-nums text-foreground">{formatPrice(pos.entry)}</td>
                  <td className="px-4 py-4 text-right text-xs font-semibold tabular-nums text-red-500/80">{formatPrice(pos.liquidation)}</td>
                  <td className="px-4 py-4 text-right text-xs font-semibold tabular-nums text-foreground">{formatCurrency(pos.margin)}</td>
                  <td className="px-4 py-4 text-right text-xs font-semibold tabular-nums text-foreground">{pos.leverage}x</td>
                  <td className={`px-4 py-4 text-right text-sm font-semibold tabular-nums ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
                    {isProfit ? '+' : ''}{formatCurrency(pos.unrealized)}
                  </td>
                  <td className="px-4 py-4 text-right text-[10px] font-semibold tabular-nums text-muted-foreground">
                    <span className="text-green-500/80">{pos.tp === 'None' ? '--' : formatPrice(parseFloat(pos.tp))}</span>
                    <span className="mx-1 text-muted-foreground/25">/</span>
                    <span className="text-red-500/80">{pos.sl === 'None' ? '--' : formatPrice(parseFloat(pos.sl))}</span>
                  </td>
                  <td className="px-4 py-4 text-right text-xs font-semibold tabular-nums text-muted-foreground">{formatCurrency(pos.fee)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex flex-col gap-3 border-t border-black/8 p-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            {[10, 25, 50].map((count) => (
              <button
                key={count}
                onClick={() => handleRowsPerPageChange(count)}
                className={`rounded-lg px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] transition-colors ${
                  rowsPerPage === count
                    ? 'bg-foreground text-background'
                    : 'bg-black/[0.04] text-muted-foreground hover:text-foreground dark:bg-white/[0.06]'
                }`}
              >
                {count}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/50">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button onClick={handlePrevPage} disabled={currentPage === 1} variant="outline" size="sm" className="h-8 rounded-xl px-2">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button onClick={handleNextPage} disabled={currentPage === totalPages} variant="outline" size="sm" className="h-8 rounded-xl px-2">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

