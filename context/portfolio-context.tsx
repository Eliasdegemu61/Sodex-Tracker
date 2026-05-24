'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { EnrichedPosition } from '@/lib/sodex-api';
import {
  fetchAllPositions,
  enrichPositions,
  getUserIdByAddress,
  fetchTotalBalance,
  fetchFastAccountState,
  fetchPnLDailyStats,
  type FastAccountState,
  type PnLDailyStat
} from '@/lib/sodex-api';

interface PortfolioContextType {
  walletAddress: string | null;
  sourceWalletAddress: string | null;
  userId: string | null;
  positions: EnrichedPosition[];
  fastAccountState: FastAccountState | null;
  pnlDailyStats: PnLDailyStat[];
  vaultBalance: number;
  isLoading: boolean;
  isHistoryLoading: boolean;
  hasMoreHistory: boolean;
  isPaused: boolean;
  fetchProgress: { count: number; nextCursor?: string };
  timeframe: '30D' | 'ALL';
  error: string | null;
  setWalletAddress: (address: string, userId: string, positions: EnrichedPosition[]) => Promise<void>;
  bindWalletFast: (address: string, completeHistory?: boolean) => Promise<void>;
  setTimeframe: (timeframe: '30D' | 'ALL') => void;
  setVaultBalance: (balance: number) => void;
  clearWalletAddress: () => void;
  handleContinue: () => Promise<void>;
  handleAbortAndShow: () => Promise<void>;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

export function PortfolioProvider({
  children,
  initialUserId,
  initialPositions,
  initialWalletAddress,
  initialSourceWalletAddress,
  initialFastAccountState,
  initialPnLDailyStats,
  initialIsHistoryLoading,
  initialHistoryCursor
}: {
  children: React.ReactNode;
  initialUserId?: string | null;
  initialPositions?: EnrichedPosition[];
  initialWalletAddress?: string | null;
  initialSourceWalletAddress?: string | null;
  initialFastAccountState?: FastAccountState | null;
  initialPnLDailyStats?: PnLDailyStat[];
  initialIsHistoryLoading?: boolean;
  initialHistoryCursor?: string;
}) {
  const [walletAddress, setWalletAddressState] = useState<string | null>(initialWalletAddress || null);
  const [sourceWalletAddress, setSourceWalletAddressState] = useState<string | null>(initialSourceWalletAddress || null);
  const [userId, setUserIdState] = useState<string | null>(initialUserId || null);
  const [positions, setPositions] = useState<EnrichedPosition[]>(initialPositions || []);
  const [fastAccountState, setFastAccountState] = useState<FastAccountState | null>(initialFastAccountState || null);
  const [pnlDailyStats, setPnLDailyStats] = useState<PnLDailyStat[]>(initialPnLDailyStats || []);
  const [vaultBalance, setVaultBalanceState] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(Boolean(initialIsHistoryLoading));
  const [hasMoreHistory, setHasMoreHistory] = useState(Boolean(initialIsHistoryLoading));
  const [isPaused, setIsPaused] = useState(false);
  const [fetchProgress, setFetchProgress] = useState<{ count: number; nextCursor?: string }>({
    count: initialPositions?.length || 0,
    nextCursor: initialHistoryCursor,
  });
  const [timeframe, setTimeframeState] = useState<'30D' | 'ALL'>('ALL');
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingPositionsRef = useRef<any[]>([]);

  useEffect(() => {
    setWalletAddressState(initialWalletAddress || null);
    setSourceWalletAddressState(initialSourceWalletAddress || null);
    setUserIdState(initialUserId || null);
    setPositions(initialPositions || []);
    setFastAccountState(initialFastAccountState || null);
    setPnLDailyStats(initialPnLDailyStats || []);
    setIsHistoryLoading(Boolean(initialIsHistoryLoading));
    setHasMoreHistory(Boolean(initialIsHistoryLoading));
    setFetchProgress({ count: initialPositions?.length || 0, nextCursor: initialHistoryCursor });
  }, [
    initialWalletAddress,
    initialSourceWalletAddress,
    initialUserId,
    initialPositions,
    initialFastAccountState,
    initialPnLDailyStats,
    initialIsHistoryLoading,
    initialHistoryCursor,
  ]);

  // Load timeframe from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('portfolio_timeframe') as '30D' | 'ALL';
      if (saved) setTimeframeState(saved);
    }
  }, []);

  const setTimeframe = useCallback((t: '30D' | 'ALL') => {
    setTimeframeState(t);
    localStorage.setItem('portfolio_timeframe', t);
  }, []);

  const loadPositions = async (
    targetUserId: string, 
    cursor?: string, 
    accumulated: any[] = []
  ) => {
    setIsLoading(true);
    setIsPaused(false);
    setError(null);

    if (!cursor) {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      pendingPositionsRef.current = [];
    }

    const controller = abortControllerRef.current!;
    try {
      const minTimestamp = timeframe === '30D' ? Date.now() - 30 * 24 * 60 * 60 * 1000 : undefined;
      const RECENT_LIMIT = 1000;

      const { positions: recentFetched, nextCursor: recentNextCursor } = await fetchAllPositions(
        targetUserId,
        (count) => setFetchProgress(prev => ({ ...prev, count: accumulated.length + count })),
        minTimestamp,
        controller.signal,
        cursor ? undefined : RECENT_LIMIT,
        cursor
      );

      const total = [...accumulated, ...recentFetched];
      const nextCursor = recentNextCursor;
      pendingPositionsRef.current = total;

      if (!cursor && !controller.signal.aborted) {
        const recentEnriched = await enrichPositions(total);
        setPositions(recentEnriched);
        setHasMoreHistory(Boolean(nextCursor));
        setFetchProgress({ count: total.length, nextCursor });
        setIsLoading(false);
        setIsHistoryLoading(false);
        const balance = await fetchTotalBalance(targetUserId);
        setVaultBalanceState(balance.futuresBalance);
        return;
      }

      const enriched = await enrichPositions(total);
      if (!controller.signal.aborted) {
        setPositions(enriched);
        setIsHistoryLoading(false);
        setHasMoreHistory(Boolean(nextCursor));
        setFetchProgress({ count: total.length, nextCursor });
        const balance = await fetchTotalBalance(targetUserId);
        setVaultBalanceState(balance.futuresBalance);
      }
    } catch (err) {
      if (err instanceof Error && (err.name === 'AbortError' || err.message === 'Fetch aborted')) return;
      setError(err instanceof Error ? err.message : 'Failed to load positions');
    } finally {
      if (abortControllerRef.current === controller && !isPaused) {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    }
  };

  const handleContinue = async () => {
    if (userId && fetchProgress.nextCursor) {
      setIsHistoryLoading(true);
      await loadPositions(userId, fetchProgress.nextCursor, pendingPositionsRef.current);
    }
  };

  const handleAbortAndShow = async () => {
    if (!userId || pendingPositionsRef.current.length === 0) return;
    setIsLoading(true);
    setIsPaused(false);
    try {
      const enriched = await enrichPositions(pendingPositionsRef.current);
      setPositions(enriched);
      setHasMoreHistory(Boolean(fetchProgress.nextCursor));
      const balance = await fetchTotalBalance(userId);
      setVaultBalanceState(balance.futuresBalance);
    } catch (err) {
      setError('Failed to process existing data');
    } finally {
      setIsLoading(false);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    }
  };

  const setWalletAddress = useCallback(
    async (address: string, id: string, enriched: EnrichedPosition[]) => {
      localStorage.setItem('portfolio_wallet_address', address);
      localStorage.setItem('portfolio_user_id', id);
      setWalletAddressState(address);
      setUserIdState(id);
      setPositions(enriched);
      setIsHistoryLoading(false);
      const balance = await fetchTotalBalance(id);
      setVaultBalanceState(balance.futuresBalance);
    },
    []
  );

  const clearWalletAddress = useCallback(() => {
    localStorage.removeItem('portfolio_wallet_address');
    localStorage.removeItem('portfolio_user_id');
    setWalletAddressState(null);
    setSourceWalletAddressState(null);
    setUserIdState(null);
    setPositions([]);
    setFastAccountState(null);
    setPnLDailyStats([]);
    setIsHistoryLoading(false);
    setHasMoreHistory(false);
    setFetchProgress({ count: 0 });
    setVaultBalanceState(0);
    setError(null);
  }, []);

  const bindWalletFast = useCallback(async (address: string, completeHistory = false) => {
    const targetAddress = address.trim();
    if (!targetAddress) throw new Error('Address is required');

    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    pendingPositionsRef.current = [];

    setIsLoading(true);
    setIsPaused(false);
    setError(null);
    setFetchProgress({ count: 0 });

    try {
      const id = await getUserIdByAddress(targetAddress);
      const [state, dailyStats] = await Promise.all([
        fetchFastAccountState(targetAddress),
        fetchPnLDailyStats(id),
      ]);

      const RECENT_LIMIT = 1000;
      const { positions: recent, nextCursor } = await fetchAllPositions(
        id,
        (count) => setFetchProgress({ count }),
        undefined,
        controller.signal,
        RECENT_LIMIT
      );

      pendingPositionsRef.current = recent;
      const recentEnriched = await enrichPositions(recent);
      if (controller.signal.aborted) return;

      setPositions(recentEnriched);
      setFastAccountState(state);
      setPnLDailyStats(dailyStats);
      setWalletAddressState(targetAddress);
      setSourceWalletAddressState(targetAddress);
      setUserIdState(id);
      localStorage.setItem('portfolio_wallet_address', targetAddress);
      localStorage.setItem('portfolio_user_id', id);
      setHasMoreHistory(Boolean(nextCursor));
      setFetchProgress({ count: recent.length, nextCursor });
      setIsHistoryLoading(false);
      setIsLoading(false);

      try {
        const balance = await fetchTotalBalance(id);
        setVaultBalanceState(balance.futuresBalance);
      } catch (balanceError) {
        console.warn('[v0] Failed to fetch portfolio balance after fast bind:', balanceError);
      }

      if (completeHistory && nextCursor) {
        setIsHistoryLoading(true);
        const { positions: remaining } = await fetchAllPositions(
          id,
          (count) => setFetchProgress({ count: RECENT_LIMIT + count }),
          undefined,
          controller.signal,
          undefined,
          nextCursor
        );

        const total = [...recent, ...remaining];
        pendingPositionsRef.current = total;
        const enriched = await enrichPositions(total);
        if (!controller.signal.aborted) {
          setPositions(enriched);
          setIsHistoryLoading(false);
          setHasMoreHistory(false);
          setFetchProgress({ count: total.length });
        }
      }
    } catch (err) {
      if (err instanceof Error && (err.name === 'AbortError' || err.message === 'Fetch aborted')) return;
      setError(err instanceof Error ? err.message : 'Failed to bind address');
      clearWalletAddress();
      throw err;
    } finally {
      if (abortControllerRef.current === controller) {
        setIsLoading(false);
        setIsHistoryLoading(false);
        abortControllerRef.current = null;
      }
    }
  }, [clearWalletAddress]);

  // Initialize saved portfolio with the same fast path used by manual binding.
  useEffect(() => {
    const init = async () => {
      if (initialUserId || initialWalletAddress) return;

      const savedAddress = localStorage.getItem('portfolio_wallet_address');
      if (!savedAddress) return;

      try {
        await bindWalletFast(savedAddress, false);
      } catch (err) {
        console.error('[v0] Failed to restore saved portfolio:', err);
      }
    };

    if (typeof window !== 'undefined') init();
  }, [initialUserId, initialWalletAddress, bindWalletFast]);

  const setVaultBalance = useCallback((balance: number) => {
    setVaultBalanceState(balance);
  }, []);

  return (
    <PortfolioContext.Provider
      value={{
        walletAddress,
        sourceWalletAddress,
        userId,
        positions,
        fastAccountState,
        pnlDailyStats,
        vaultBalance,
        isLoading,
        isHistoryLoading,
        hasMoreHistory,
        isPaused,
        fetchProgress,
        timeframe,
        error,
        setWalletAddress,
        bindWalletFast,
        setTimeframe,
        setVaultBalance,
        clearWalletAddress,
        handleContinue,
        handleAbortAndShow,
      }}
    >
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const context = useContext(PortfolioContext);
  if (context === undefined) throw new Error('usePortfolio must be used within PortfolioProvider');
  return context;
}
