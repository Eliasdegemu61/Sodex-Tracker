'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Loader2, 
  AlertCircle, 
  Search, 
  X, 
  Info, 
  TrendingUp
} from 'lucide-react';
import { usePortfolio } from '@/context/portfolio-context';
import { 
  fetchAccountDetails, 
  fetchMarkPrices, 
  fetchFundingRate, 
  getUserIdByAddress,
  type OpenPositionData, 
  type MarkPrice, 
  type FundingRateData 
} from '@/lib/sodex-api';
import { getTokenLogo } from '@/lib/token-logos';
import { cn } from '@/lib/utils';

interface PositionWithFunding extends OpenPositionData {
  markPrice: number;
  fundingData: FundingRateData | null;
}

function AccruedFundingContent({ userId, walletAddress, onClear }: { userId: string, walletAddress: string, onClear?: () => void }) {
  const [positions, setPositions] = useState<PositionWithFunding[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [accountData, markPrices] = await Promise.all([
        fetchAccountDetails(userId),
        fetchMarkPrices()
      ]);

      const markPriceMap = new Map(markPrices.map(mp => [mp.s, parseFloat(mp.p)]));
      
      const positionsWithFunding = await Promise.all(
        accountData.positions.map(async (pos) => {
          let fundingData: FundingRateData | null = null;
          try {
            fundingData = await fetchFundingRate(pos.symbol);
          } catch (e) {
            console.warn(`Failed to fetch funding for ${pos.symbol}`, e);
          }
          
          return {
            ...pos,
            markPrice: markPriceMap.get(pos.symbol) || parseFloat(pos.entryPrice),
            fundingData
          };
        })
      );

      setPositions(positionsWithFunding);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error('[Funding] Load error:', err);
      if (positions.length === 0) {
        setError(err instanceof Error ? err.message : 'Failed to load funding data');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const refreshInterval = setInterval(loadData, 3000);
    return () => clearInterval(refreshInterval);
  }, [userId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const totalNetAccrued = useMemo(() => {
    return positions.reduce((sum, pos) => {
      if (!pos.fundingData) return sum;
      const notionalValue = Math.abs(parseFloat(pos.positionSize)) * pos.markPrice;
      const rate = parseFloat(pos.fundingData.fundingRate);
      const interval = pos.fundingData.collectionInterval * 1000;
      const nextCollection = pos.fundingData.nextCollectionTime;
      const elapsed = interval - Math.max(0, nextCollection - currentTime);
      const fraction = Math.min(1, Math.max(0, elapsed / interval));
      const intervalFunding = notionalValue * rate;
      const accrued = (pos.positionSide === 'LONG' ? -1 : 1) * intervalFunding * fraction;
      return sum + accrued;
    }, 0);
  }, [positions, currentTime]);

  if (isLoading && positions.length === 0) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-4">
        <div className="flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground/20 mb-4" />
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/30">Syncing Engine...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 text-foreground">
      {/* Header Section */}
      <div className="border border-border bg-card" style={{ borderRadius: 'var(--radius-md)' }}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Accrued Funding</span>
            <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 border border-border text-muted-foreground" style={{ borderRadius: 'var(--radius-sm)' }}>BETA</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-muted-foreground/50 truncate max-w-[150px] md:max-w-none">{walletAddress}</span>
            {onClear && (
              <button onClick={onClear} className="text-muted-foreground/30 hover:text-destructive transition-colors">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 divide-x divide-border">
          <div className="flex flex-col gap-1.5 p-3">
            <span className="text-[8px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Total Net Accrued</span>
            <span className={cn(
              "text-lg font-bold tracking-tight",
              totalNetAccrued >= 0 ? "text-[var(--success)]" : "text-destructive"
            )}>
              {totalNetAccrued >= 0 ? '+' : '-'}${Math.abs(totalNetAccrued).toFixed(4)}
            </span>
          </div>
          <div className="flex flex-col gap-1.5 p-3">
            <span className="text-[8px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Positions</span>
            <span className="text-lg font-bold tracking-tight text-foreground">{positions.length}</span>
          </div>
        </div>
      </div>

      {positions.length === 0 ? (
        <div className="border border-dashed border-border bg-card py-16 flex items-center justify-center" style={{ borderRadius: 'var(--radius-md)' }}>
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/30">No open positions found.</p>
        </div>
      ) : (
        <>
          {/* Mobile View: Card List */}
          <div className="md:hidden divide-y divide-border border border-border bg-card" style={{ borderRadius: 'var(--radius-md)' }}>
            {positions.map((pos) => {
              const notionalValue = Math.abs(parseFloat(pos.positionSize)) * pos.markPrice;
              const fundingRate = pos.fundingData ? parseFloat(pos.fundingData.fundingRate) : 0;
              const nextCollection = pos.fundingData ? pos.fundingData.nextCollectionTime : 0;
              const interval = pos.fundingData ? pos.fundingData.collectionInterval * 1000 : 3600000;
              const timeLeft = Math.max(0, nextCollection - currentTime);
              const fraction = Math.min(1, Math.max(0, (interval - timeLeft) / interval));
              const netAccrued = (pos.positionSide === 'LONG' ? -1 : 1) * (notionalValue * fundingRate) * fraction;
              const isReceiving = netAccrued > 0;
              const isExpanded = expandedId === pos.positionId;

              return (
                <div 
                  key={pos.positionId} 
                  className="hover:bg-muted/20 transition-colors"
                >
                  <button onClick={() => setExpandedId(isExpanded ? null : pos.positionId)} className="w-full flex items-center justify-between p-4 text-left">
                    <div className="flex items-center gap-3">
                      {getTokenLogo(pos.symbol) ? (
                        <img src={getTokenLogo(pos.symbol)} alt="" className="w-5 h-5 rounded-full bg-muted object-contain" />
                      ) : (
                        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/20 shrink-0" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">{pos.symbol}</span>
                          <span className={cn(
                            "text-[8px] font-bold px-1.5 py-0.5 uppercase tracking-widest border",
                            pos.positionSide === 'LONG' ? "border-[var(--success)]/30 text-[var(--success)]" : "border-destructive/30 text-destructive"
                          )} style={{ borderRadius: 'var(--radius-sm)' }}>
                            {pos.positionSide}
                          </span>
                        </div>
                        <p className="text-[9px] text-muted-foreground/50 font-bold uppercase tracking-widest mt-0.5">
                          {pos.leverage}X
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-sm font-bold tabular-nums", isReceiving ? "text-[var(--success)]" : "text-destructive")}>
                        {isReceiving ? '+' : '-'}${Math.abs(netAccrued).toFixed(4)}
                      </p>
                      <p className="text-[8px] text-muted-foreground/40 font-bold uppercase tracking-widest">Accrued</p>
                    </div>
                  </button>
                  
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-border">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/50">Mark Price</span>
                          <span className="text-[11px] font-bold text-foreground">${pos.markPrice.toFixed(2)}</span>
                        </div>
                        <div className="flex flex-col gap-0.5 text-right">
                          <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/50">Notional</span>
                          <span className="text-[11px] font-bold text-foreground">${notionalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/50">Funding Rate</span>
                          <span className={cn("text-[11px] font-bold", fundingRate > 0 ? "text-[var(--success)]" : "text-destructive")}>
                            {(fundingRate * 100).toFixed(6)}%
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5 text-right">
                          <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/50">Next Settlement</span>
                          <span className="text-[11px] font-bold text-foreground">
                            {Math.floor(timeLeft / 60000)}:{(Math.floor((timeLeft % 60000) / 1000)).toString().padStart(2, '0')}
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 h-px w-full bg-border">
                        <div className="h-full bg-foreground/10" style={{ width: `${fraction * 100}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop View: Formal Table */}
          <div className="hidden md:block border border-border bg-card overflow-hidden" style={{ borderRadius: 'var(--radius-md)' }}>
            <table className="w-full text-[10px] text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2.5 px-3 text-[8px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Symbol</th>
                  <th className="py-2.5 px-3 text-[8px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Position</th>
                  <th className="py-2.5 px-3 text-[8px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Mark Price</th>
                  <th className="py-2.5 px-3 text-[8px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Notional</th>
                  <th className="py-2.5 px-3 text-[8px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Funding Rate</th>
                  <th className="py-2.5 px-3 text-[8px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Settlement</th>
                  <th className="py-2.5 px-3 text-[8px] font-bold uppercase tracking-[0.18em] text-muted-foreground text-right">Accrued</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {positions.map((pos) => {
                  const notionalValue = Math.abs(parseFloat(pos.positionSize)) * pos.markPrice;
                  const fundingRate = pos.fundingData ? parseFloat(pos.fundingData.fundingRate) : 0;
                  const nextCollection = pos.fundingData ? pos.fundingData.nextCollectionTime : 0;
                  const interval = pos.fundingData ? pos.fundingData.collectionInterval * 1000 : 3600000;
                  const timeLeft = Math.max(0, nextCollection - currentTime);
                  const fraction = Math.min(1, Math.max(0, (interval - timeLeft) / interval));
                  const netAccrued = (pos.positionSide === 'LONG' ? -1 : 1) * (notionalValue * fundingRate) * fraction;
                  const isReceiving = netAccrued > 0;

                  return (
                    <tr key={pos.positionId} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          {getTokenLogo(pos.symbol) ? (
                            <img src={getTokenLogo(pos.symbol)} alt="" className="w-4 h-4 rounded-full bg-muted object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                          ) : (
                            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/20 shrink-0" />
                          )}
                          <span className="text-[11px] font-bold text-foreground">{pos.symbol}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-[8px] font-bold px-1.5 py-0.5 uppercase tracking-widest border",
                            pos.positionSide === 'LONG' ? "border-[var(--success)]/30 text-[var(--success)]" : "border-destructive/30 text-destructive"
                          )} style={{ borderRadius: 'var(--radius-sm)' }}>
                            {pos.positionSide}
                          </span>
                          <span className="text-[8px] font-bold text-muted-foreground/50">{pos.leverage}X</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-[10px] font-bold text-muted-foreground tabular-nums">
                        ${pos.markPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-[10px] font-bold text-muted-foreground tabular-nums">
                        ${notionalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td className="py-3 px-3">
                        <span className={cn("text-[10px] font-bold tabular-nums", fundingRate > 0 ? "text-[var(--success)]" : "text-destructive")}>
                          {(fundingRate * 100).toFixed(6)}%
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-bold text-muted-foreground tabular-nums">
                            {Math.floor(timeLeft / 60000)}:{(Math.floor((timeLeft % 60000) / 1000)).toString().padStart(2, '0')}
                          </span>
                          <div className="w-12 h-0.5 bg-border">
                            <div className="h-full bg-foreground/10" style={{ width: `${fraction * 100}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className={cn("text-[11px] font-bold tabular-nums", isReceiving ? "text-[var(--success)]" : "text-destructive")}>
                          {isReceiving ? '+' : '-'}${Math.abs(netAccrued).toFixed(6)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      
      <div className="flex items-center gap-2 px-1">
        <Info className="w-3 h-3 text-muted-foreground/30" />
        <p className="text-[8px] text-muted-foreground/40 font-bold uppercase tracking-wider">
          Estimates based on real-time mark price and linear time-decay since last settlement.
        </p>
      </div>
    </div>
  );
}

export function AccruedFunding({ initialSearchAddress }: { initialSearchAddress?: string }) {
  const portfolio = usePortfolio();
  const [searchInput, setSearchInput] = useState(initialSearchAddress || '');
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSyncedInitial, setHasSyncedInitial] = useState(false);

  const handleSearch = async (addressToSearch?: string) => {
    const valueToSearch = (addressToSearch || searchInput || '').trim();
    if (!valueToSearch) return;
    setIsLoading(true);
    setError(null);
    try {
      const foundUserId = await getUserIdByAddress(valueToSearch);
      setWalletAddress(valueToSearch);
      setUserId(foundUserId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch wallet data');
      setWalletAddress(null);
      setUserId(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!hasSyncedInitial && initialSearchAddress && initialSearchAddress.trim()) {
      setSearchInput(initialSearchAddress);
      handleSearch(initialSearchAddress);
      setHasSyncedInitial(true);
    }
  }, [initialSearchAddress, hasSyncedInitial]);

  const handleClear = () => {
    setSearchInput('');
    setWalletAddress(null);
    setUserId(null);
    setError(null);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-4">
        <div className="flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground/10 mb-4" />
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/30">Resolving Identity...</p>
        </div>
      </div>
    );
  }

  if (!userId || !walletAddress) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-4">
        <div className="w-full max-w-md animate-in fade-in duration-300">

          <div className="mb-6">
            <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground/50 mb-1">SoDex Tracker</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground" style={{ letterSpacing: '-0.04em' }}>Funding</h2>
            <p className="mt-1.5 text-sm text-muted-foreground/60">Inspect real-time funding for any address</p>
          </div>

          <div className="border border-border bg-card" style={{ borderRadius: 'var(--radius-md)' }}>
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Search className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Paste wallet address…"
                  value={searchInput}
                  onChange={(e) => { setSearchInput(e.target.value); setError(null); }}
                  onKeyDown={(e) => e.key === 'Enter' && !isLoading && searchInput.trim() && handleSearch()}
                  disabled={isLoading}
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/30 font-mono focus:outline-none disabled:opacity-50"
                />
                {searchInput && !isLoading && (
                  <button onClick={() => { setSearchInput(''); setError(null); }}>
                    <span className="text-muted-foreground/40 hover:text-foreground transition-colors text-xs">×</span>
                  </button>
                )}
              </div>
            </div>

            {(isLoading || error) && (
              <div className="px-4 py-3 border-b border-border">
                {isLoading && (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin text-muted-foreground shrink-0" />
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Resolving identity...</p>
                  </div>
                )}
                {error && (
                  <p className="text-[10px] font-bold text-destructive uppercase tracking-widest">{error}</p>
                )}
              </div>
            )}

            <div className="p-3">
              <button
                onClick={() => handleSearch()}
                disabled={isLoading || !searchInput.trim()}
                className="w-full py-3 text-[11px] font-bold uppercase tracking-[0.2em] bg-foreground text-background transition-opacity hover:opacity-80 disabled:opacity-25"
                style={{ borderRadius: 'var(--radius-sm)' }}
              >
                {isLoading ? 'Inspecting...' : 'Inspect Funding'}
              </button>
            </div>
          </div>

          <p className="mt-4 text-center text-[9px] text-muted-foreground/30 uppercase tracking-[0.2em]">
            Funding data is fetched live from the SoDex API
          </p>
        </div>
      </div>
    );
  }

  return (
    <AccruedFundingContent 
      userId={userId} 
      walletAddress={walletAddress} 
      onClear={handleClear}
    />
  );
}
