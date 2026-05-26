'use client';

import React, { useEffect } from "react";

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Search, X, Loader2 } from 'lucide-react';
import { PortfolioOverview } from './portfolio-overview';
import { PnLChart } from './pnl-chart';
import { PositionsTable } from './positions-table';
import { OpenPositions } from './open-positions';
import { FundFlowTable } from './fund-flow-table';
import { AssetFlowCard } from './asset-flow-card';
import { MonthlyCalendar } from './monthly-calendar';
import { ShareStatsModal } from './share-stats-modal';
import { PortfolioProvider } from '@/context/portfolio-context';
import {
  getUserIdByAddress,
  fetchAllPositions,
  enrichPositions,
  fetchFastAccountState,
  fetchPnLDailyStats,
  type EnrichedPosition,
  type FastAccountState,
  type PnLDailyStat,
} from '@/lib/sodex-api';

function TrackerContent({ initialSearchAddress }: { initialSearchAddress?: string }) {
  const [searchInput, setSearchInput] = useState(initialSearchAddress || '');
  
  // Atomic state for the active portfolio to prevent partial rendering
  const [activePortfolio, setActivePortfolio] = useState<{
    walletAddress: string;
    userId: string;
    positions: EnrichedPosition[];
    fastAccountState: FastAccountState | null;
    pnlDailyStats: PnLDailyStat[];
    isHistoryLoading: boolean;
    nextCursor?: string;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [fetchProgress, setFetchProgress] = useState<{count: number, isLong: boolean, nextCursor?: string}>({ count: 0, isLong: false });
  const [error, setError] = useState<string | null>(null);
  
  // Store intermediate positions when paused
  const [pendingPositions, setPendingPositions] = useState<any[]>([]);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  // Ref to track the current abort controller for cancellation
  const abortControllerRef = React.useRef<AbortController | null>(null);

  const handleSearch = async (addressToSearch?: string, cursor?: string, accumulatedPositions: any[] = []) => {
    const valueToSearch = (addressToSearch || searchInput || '').trim();
    if (!valueToSearch) return;

    // Only cancel if this is a fresh search (not a "Continue")
    if (!cursor) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;
      setPendingPositions([]);
    }

    const controller = abortControllerRef.current!;

    setIsLoading(true);
    setIsPaused(false);
    setError(null);
    
    if (!cursor) {
      setFetchProgress({ count: 0, isLong: false });
    }

    // Long fetch timer
    const longFetchTimer = setTimeout(() => {
      setFetchProgress(prev => ({ ...prev, isLong: true }));
    }, 4000);

    try {
      const addressToFetch = valueToSearch;
      const foundUserId = cursor ? pendingUserId! : await getUserIdByAddress(addressToFetch);
      let resolvedFastAccountState = activePortfolio?.fastAccountState || null;
      let resolvedPnLDailyStats = activePortfolio?.pnlDailyStats || [];
      
      if (!cursor) setPendingUserId(foundUserId);

      if (!cursor) {
        const [fastAccountState, pnlDailyStats] = await Promise.all([
          fetchFastAccountState(addressToFetch),
          fetchPnLDailyStats(foundUserId),
        ]);
        resolvedFastAccountState = fastAccountState;
        resolvedPnLDailyStats = pnlDailyStats;

        if (!controller.signal.aborted) {
          setActivePortfolio({
            walletAddress: valueToSearch,
            userId: foundUserId,
            positions: [],
            fastAccountState: resolvedFastAccountState,
            pnlDailyStats: resolvedPnLDailyStats,
            isHistoryLoading: true,
            nextCursor: undefined,
          });
        }
      }

      // Fetch the first 1000 recent records for a fast usable history table,
      // then continue deeper pagination in the background.
      const RECENT_LIMIT = 1000;
      const SOFT_LIMIT = 10000;

      const { positions: recentPositions, nextCursor: recentNextCursor } = await fetchAllPositions(
        foundUserId, 
        (count) => {
          setFetchProgress(prev => ({ ...prev, count: accumulatedPositions.length + count }));
        },
        undefined,
        controller.signal,
        cursor ? SOFT_LIMIT : RECENT_LIMIT,
        cursor
      );
      
      const recentTotalPositions = [...accumulatedPositions, ...recentPositions];

      if (!cursor && !controller.signal.aborted) {
        const recentEnriched = await enrichPositions(recentTotalPositions);
        setPendingPositions(recentTotalPositions);
        setFetchProgress(prev => ({ ...prev, count: recentTotalPositions.length, nextCursor: recentNextCursor }));
        setActivePortfolio({
          walletAddress: valueToSearch,
          userId: foundUserId,
          positions: recentEnriched,
          fastAccountState: resolvedFastAccountState,
          pnlDailyStats: resolvedPnLDailyStats,
          isHistoryLoading: Boolean(recentNextCursor),
          nextCursor: recentNextCursor,
        });
        setIsLoading(false);
        return;
      }

      let totalPositions = recentTotalPositions;
      let nextCursor = recentNextCursor;

      if (nextCursor && totalPositions.length >= SOFT_LIMIT) {
        // We hit the limit and there's more to fetch
        setPendingPositions(totalPositions);
        setFetchProgress(prev => ({ ...prev, count: totalPositions.length, nextCursor }));
        setIsPaused(true);
        clearTimeout(longFetchTimer);
        return;
      }

      // Finish and enrich
      const enrichedPositions = await enrichPositions(totalPositions);

      // Only set everything if this is still the active request
      if (!controller.signal.aborted) {
        setActivePortfolio({
          walletAddress: valueToSearch,
          userId: foundUserId,
          positions: enrichedPositions,
          fastAccountState: resolvedFastAccountState,
          pnlDailyStats: resolvedPnLDailyStats,
          isHistoryLoading: false,
          nextCursor: undefined,
        });
        setError(null);
      }
    } catch (err) {
      if (err instanceof Error && (err.name === 'AbortError' || err.message === 'Fetch aborted')) {
        console.log('[v0] Search cancelled for:', valueToSearch);
        return;
      }
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch wallet data';
      console.error('[v0] Error searching wallet:', errorMessage);
      setError(errorMessage);
      setActivePortfolio(null);
    } finally {
      if (abortControllerRef.current === controller && !isPaused) {
        clearTimeout(longFetchTimer);
        if (!isPaused) setIsLoading(false);
        // Don't clear ref if we are paused, we need it for "Continue"
      }
    }
  };

  const handleContinue = () => {
    const addressToUse = activePortfolio?.walletAddress || searchInput;
    if (fetchProgress.nextCursor && addressToUse) {
      handleSearch(addressToUse, fetchProgress.nextCursor, pendingPositions);
    }
  };

  const handleAbortAndShow = async () => {
    if (!pendingPositions || pendingPositions.length === 0) return;
    setIsLoading(true);
    setIsPaused(false);
    try {
      const enriched = await enrichPositions(pendingPositions);
      setActivePortfolio({
        walletAddress: searchInput,
        userId: pendingUserId!,
        positions: enriched,
        fastAccountState: activePortfolio?.fastAccountState || null,
        pnlDailyStats: activePortfolio?.pnlDailyStats || [],
        isHistoryLoading: false,
        nextCursor: undefined,
      });
    } catch (err) {
      console.error('[v0] Abort and show error:', err);
      setError('Failed to process existing data');
    } finally {
      setIsLoading(false);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    }
  };

  // Auto-search when initialSearchAddress is provided
  useEffect(() => {
    if (initialSearchAddress && initialSearchAddress.trim()) {
      setSearchInput(initialSearchAddress);
      handleSearch(initialSearchAddress);
    }
  }, [initialSearchAddress]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleClear = () => {
    setSearchInput('');
    setActivePortfolio(null);
    setError(null);
    if (abortControllerRef.current) abortControllerRef.current.abort();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Render portfolio data when wallet is found
  if ((isLoading || isPaused) && !activePortfolio) {
    const loadingMessage = isPaused 
      ? `Paused at ${fetchProgress.count.toLocaleString()} records`
      : fetchProgress.isLong 
        ? `Indexing... (${fetchProgress.count.toLocaleString()} records)` 
        : "Resolving address...";
        
    const loadingSubMessage = isPaused
      ? "Large dataset detected. You can view what we've fetched so far or continue indexing the full history."
      : fetchProgress.isLong 
        ? `Indexing entire trade history safely. Please wait until this process finishes for accurate metrics.` 
        : undefined;

    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center px-4 py-8">
        <Card className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-500 rounded-xl border border-black/8 bg-white p-4 shadow-[0_20px_60px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-[#050505] dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)] md:rounded-[2rem] md:p-10">
          <div className="mb-4 text-center sm:text-left md:mb-8">
            <h2 className="mb-1 text-lg font-bold tracking-tight text-foreground md:text-4xl">Tracker</h2>
            <p className="text-[10px] font-medium tracking-wider text-muted-foreground/60 md:text-sm">{loadingMessage}</p>
          </div>

          <div className="space-y-5">
            <div className="relative">
              <input
                type="text"
                value={searchInput}
                readOnly
                className="w-full rounded-xl border border-black/10 bg-black/[0.02] px-4 py-3 pr-12 text-xs font-medium text-foreground placeholder:text-black/25 transition-all dark:border-white/10 dark:bg-white/[0.02] dark:placeholder:text-white/25 md:rounded-2xl md:py-4 md:text-sm"
              />
              <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-orange-500" />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/45">
                <span>{fetchProgress.count.toLocaleString()} records</span>
                <span>{isPaused ? 'Paused' : 'Loading'}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08]">
                <div
                  className="h-full rounded-full bg-orange-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(8, (fetchProgress.count / 1000) * 100))}%` }}
                />
              </div>
            </div>

            <p className="text-center text-xs leading-5 text-muted-foreground/55">
              {loadingSubMessage || 'Loading account stats and the recent 1,000 positions first.'}
            </p>

            {isPaused && (
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={handleAbortAndShow} variant="outline" className="rounded-xl text-[10px] font-bold uppercase tracking-widest">
                  Show Current
                </Button>
                <Button onClick={handleContinue} className="rounded-xl bg-orange-500 text-[10px] font-bold uppercase tracking-widest text-white hover:bg-orange-600">
                  Continue
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="p-4 rounded-full bg-red-500/10">
          <X className="h-8 w-8 text-red-500" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold">Search Failed</h3>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
        <Button onClick={handleClear} variant="outline">Try Another Address</Button>
      </div>
    );
  }

  if (!activePortfolio) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center px-4 py-8">
        <Card className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-500 rounded-xl md:rounded-[2rem] border border-black/8 bg-white p-4 md:p-10 shadow-[0_20px_60px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-[#050505] dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
          
          <div className="mb-4 md:mb-8 text-center sm:text-left">
            <h2 className="mb-1 text-lg md:text-4xl font-bold tracking-tight text-foreground">Tracker</h2>
            <p className="text-[10px] md:text-sm font-medium text-muted-foreground/60 tracking-wider">monitor performance and flows for any address</p>
          </div>

          <div className="space-y-6">
            <div className="relative">
              <input
                type="text"
                placeholder="0x..."
                value={searchInput}
                onChange={(e) => { setSearchInput(e.target.value); setError(null); }}
                onKeyPress={handleKeyPress}
                className="w-full rounded-xl md:rounded-2xl border border-black/10 bg-black/[0.02] px-4 py-3 md:py-4 text-xs md:text-sm font-medium text-foreground placeholder:text-black/25 focus:outline-none focus:ring-1 focus:ring-black/15 transition-all disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.02] dark:placeholder:text-white/25 dark:focus:ring-white/25"
              />
            </div>

            <button
              onClick={() => handleSearch()}
              disabled={isLoading || !searchInput.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl md:rounded-2xl border border-white bg-white py-3 md:py-4 text-xs md:text-sm font-bold text-black shadow-sm transition-all hover:bg-white/90 disabled:opacity-40 tracking-widest"
            >
              <Search className="w-4 h-4" />
              <span>Track Wallet</span>
            </button>

            <p className="text-[10px] text-center text-muted-foreground/40 uppercase tracking-[0.2em]">
              Loads the fast snapshot first, then recent history
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <PortfolioProvider 
      initialUserId={activePortfolio.userId}
      initialPositions={activePortfolio.positions}
      initialWalletAddress={activePortfolio.walletAddress}
      initialSourceWalletAddress={activePortfolio.walletAddress}
      initialFastAccountState={activePortfolio.fastAccountState}
      initialPnLDailyStats={activePortfolio.pnlDailyStats}
      initialIsHistoryLoading={activePortfolio.isHistoryLoading}
      initialHistoryCursor={activePortfolio.nextCursor}
    >
      <div className="space-y-3 md:space-y-5">
        <div className="rounded-xl border border-black/8 bg-white p-3 shadow-[0_20px_60px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-black dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)] md:px-7 md:py-5 md:rounded-[2rem]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold tracking-[-0.04em] md:text-3xl">Tracker</h2>
                <span className="rounded-full border border-green-500/20 bg-green-500/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-green-500">
                  Live
                </span>
              </div>
              <p className="mt-1 break-all font-mono text-xs text-muted-foreground/60">{activePortfolio.walletAddress}</p>
              {activePortfolio.isHistoryLoading && (
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/45">
                  Loading full history in the background
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleClear} variant="outline" size="sm" className="rounded-xl">
              <X className="h-4 w-4 mr-2" /> Clear
            </Button>
            <ShareStatsModal walletAddress={activePortfolio.walletAddress} userId={activePortfolio.userId} />
          </div>
        </div>
        </div>

        <PortfolioOverview />
        
        <div className="flex flex-col gap-3 md:gap-5">
          <div className="w-full h-[350px] md:h-[450px]">
            <PnLChart />
          </div>
          <MonthlyCalendar />
        </div>

        <OpenPositions />
        <PositionsTable />
        <div className="grid grid-cols-1 gap-3 md:gap-5 xl:grid-cols-2">
          <AssetFlowCard walletAddress={activePortfolio.walletAddress} />
          <FundFlowTable walletAddress={activePortfolio.walletAddress} />
        </div>
      </div>
    </PortfolioProvider>
  );
}

export function TrackerSection({ initialSearchAddress }: { initialSearchAddress?: string }) {
  return (
    <div className="mx-auto w-full max-w-[1800px] px-0 py-1 sm:px-4 sm:py-6 lg:px-8 lg:py-8">
      <TrackerContent initialSearchAddress={initialSearchAddress} />
    </div>
  );
}
