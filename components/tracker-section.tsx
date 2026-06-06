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
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md border border-border bg-card animate-in fade-in duration-300" style={{ borderRadius: 'var(--radius-md)' }}>
          {/* Top bar */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Tracker</span>
            <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {isPaused ? 'Paused' : 'Indexing'}
            </span>
          </div>
          <div className="p-5 space-y-4">
            {/* Address display */}
            <div className="flex items-center gap-2 px-3 py-2.5 border border-border bg-muted/30" style={{ borderRadius: 'var(--radius-sm)' }}>
              <span className="font-mono text-xs text-muted-foreground truncate flex-1">{searchInput}</span>
            </div>
            {/* Progress */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{fetchProgress.count.toLocaleString()} records</span>
                <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{isPaused ? 'Paused' : 'Loading'}</span>
              </div>
              <div className="h-0.5 w-full bg-border overflow-hidden">
                <div
                  className="h-full bg-foreground transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(4, (fetchProgress.count / 1000) * 100))}%` }}
                />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
              {loadingSubMessage || 'Loading account stats and the recent 1,000 positions first.'}
            </p>
            {isPaused && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={handleAbortAndShow}
                  className="py-2.5 text-[10px] font-bold uppercase tracking-widest border border-border text-muted-foreground transition-colors hover:text-foreground hover:border-foreground"
                  style={{ borderRadius: 'var(--radius-sm)' }}
                >
                  Show Current
                </button>
                <button
                  onClick={handleContinue}
                  className="py-2.5 text-[10px] font-bold uppercase tracking-widest bg-foreground text-background transition-opacity hover:opacity-80"
                  style={{ borderRadius: 'var(--radius-sm)' }}
                >
                  Continue
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
        <div className="w-full max-w-md border border-destructive/30 bg-card" style={{ borderRadius: 'var(--radius-md)' }}>
          <div className="px-5 py-4 border-b border-border">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Tracker — Error</span>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex-shrink-0 w-6 h-6 border border-destructive/30 flex items-center justify-center" style={{ borderRadius: 'var(--radius-sm)' }}>
                <X className="h-3.5 w-3.5 text-destructive" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground mb-0.5">Search Failed</p>
                <p className="text-xs text-muted-foreground">{error}</p>
              </div>
            </div>
            <button
              onClick={handleClear}
              className="w-full py-2.5 text-[10px] font-bold uppercase tracking-widest border border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
              style={{ borderRadius: 'var(--radius-sm)' }}
            >
              Try Another Address
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!activePortfolio) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-4">
        <div className="w-full max-w-md animate-in fade-in duration-300">
          {/* Section label */}
          <div className="mb-6">
            <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground/50 mb-1">SoDex Tracker</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground" style={{ letterSpacing: '-0.04em' }}>Track Wallet</h2>
            <p className="mt-1.5 text-sm text-muted-foreground/60">Monitor performance and flows for any address</p>
          </div>

          {/* Input card */}
          <div className="border border-border bg-card" style={{ borderRadius: 'var(--radius-md)' }}>
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Search className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Paste wallet address…"
                  value={searchInput}
                  onChange={(e) => { setSearchInput(e.target.value); setError(null); }}
                  onKeyPress={handleKeyPress}
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/30 font-mono focus:outline-none"
                />
                {searchInput && (
                  <button onClick={() => setSearchInput('')}>
                    <X className="h-3.5 w-3.5 text-muted-foreground/40 hover:text-foreground transition-colors" />
                  </button>
                )}
              </div>
            </div>
            <div className="p-3">
              <button
                onClick={() => handleSearch()}
                disabled={isLoading || !searchInput.trim()}
                className="w-full py-3 text-[11px] font-bold uppercase tracking-[0.2em] bg-foreground text-background transition-opacity hover:opacity-80 disabled:opacity-25"
                style={{ borderRadius: 'var(--radius-sm)' }}
              >
                Search
              </button>
            </div>
          </div>

          <p className="mt-4 text-center text-[9px] text-muted-foreground/30 uppercase tracking-[0.2em]">
            Loads fast snapshot first, then full history
          </p>
        </div>
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
      <div className="space-y-2 md:space-y-2">
        {/* ── Header bar ── */}
        <div className="border border-border bg-card" style={{ borderRadius: 'var(--radius-md)' }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-3">
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Tracker</span>
              <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 border border-border text-muted-foreground" style={{ borderRadius: 'var(--radius-sm)' }}>
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-foreground opacity-40" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-foreground" />
                </span>
                Live
              </span>
              {activePortfolio.isHistoryLoading && (
                <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  Indexing history
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleClear}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
                style={{ borderRadius: 'var(--radius-sm)' }}
              >
                <X className="h-3 w-3" /> Clear
              </button>
            </div>
          </div>
          <div className="px-4 py-2.5">
            <p className="font-mono text-[11px] text-muted-foreground/60 break-all">{activePortfolio.walletAddress}</p>
          </div>
        </div>

        {/* PnL Chart — hero, full width */}
        <div className="w-full">
          <PnLChart />
        </div>

        <PortfolioOverview />

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <MonthlyCalendar />
          <OpenPositions />
        </div>

        <PositionsTable />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
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
