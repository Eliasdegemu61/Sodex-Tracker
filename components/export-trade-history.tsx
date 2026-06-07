'use client';

import { useState, useEffect, useMemo } from 'react';
import { Download, FileDown, X, Loader2, CheckCircle2, AlertCircle, RefreshCcw, Clock, Info, BarChart3, Timer, Search } from 'lucide-react';
import { fetchSymbols, type SymbolData } from '@/lib/sodex-api';
import { type RawTrade } from '@/lib/trade-export';
import { useExport } from '@/context/export-context';
import { cn } from '@/lib/utils';

// ─── CSV Builder ───────────────────────────────────────────────────────────────

function tradesToCsv(
  trades: RawTrade[],
  market: 'spot' | 'perps',
  symbolMap: Map<number, SymbolData>
): string {
  const header = [
    'trade_id',
    'timestamp',
    'date_utc',
    'symbol',
    'side',
    'price',
    'quantity',
    'usd_value',
    'fee_raw',
    'fee_usd',
    'is_maker',
    'order_id',
  ].join(',');

  const rows = trades.map((t) => {
    const sideLabel =
      market === 'spot'
        ? t.side === 1 ? 'BUY' : 'SELL'
        : t.side === 1 ? 'LONG' : 'SHORT';

    const price = parseFloat(t.price);
    const qty = parseFloat(t.quantity);
    const usdValue = price * qty;
    const symbolName = symbolMap.get(t.symbol_id)?.name ?? `SYMBOL_${t.symbol_id}`;
    const dateStr = new Date(t.ts_ms).toISOString();
    
    // Fee logic: In Spot Buy, fee is in Base asset. In Spot Sell or Perps, fee is in USD.
    let feeUsd = parseFloat(t.fee || '0');
    if (market === 'spot' && t.side === 1) {
      feeUsd = feeUsd * price;
    }

    return [
      t.trade_id,
      t.ts_ms,
      `"${dateStr}"`,
      `"${symbolName}"`,
      sideLabel,
      t.price,
      t.quantity,
      usdValue.toFixed(4),
      t.fee,
      feeUsd.toFixed(8),
      t.is_maker ? 'true' : 'false',
      t.order_id,
    ].join(',');
  });

  return `${header}\n${rows.join('\n')}`;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function ExportTradeHistory() {
  const {
    address, setAddress,
    status, progress, error, resultMsg,
    lastMarket, collectedTrades,
    startExport, cancelExport
  } = useExport();

  const [localBuilding, setLocalBuilding] = useState(false);
  const [symbols, setSymbols] = useState<Map<number, SymbolData>>(new Map());

  // Load symbols for stats mapping
  useEffect(() => {
    fetchSymbols().then(setSymbols);
  }, []);

  // Prevent accidental tab closure during long export
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (status === 'fetching') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [status]);

  const handleDownload = async () => {
    if (!lastMarket || collectedTrades.length === 0) return;
    
    setLocalBuilding(true);
    try {
      const csv = tradesToCsv(collectedTrades, lastMarket, symbols);

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${lastMarket}_trades_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Download failed:', e);
    } finally {
      setLocalBuilding(false);
    }
  };

  // ─── Stats Calculation ───────────────────────────────────────────────────────

  const stats = useMemo(() => {
    if (collectedTrades.length === 0) return null;

    let totalFees = 0;
    let totalVolume = 0;
    const pairCounts: Record<string, number> = {};

    collectedTrades.forEach(t => {
      const feeRaw = parseFloat(t.fee || '0');
      const price = parseFloat(t.price);
      const qty = parseFloat(t.quantity);
      
      // Calculate USD Volume
      totalVolume += (price * qty);

      // Correct Fee Logic:
      // In Spot Buy (side 1), fee is denominated in the Base Asset (e.g. SOSO).
      // In Spot Sell (side 2) or Perps, fee is already denominated in Quote Asset (USD).
      if (lastMarket === 'spot' && t.side === 1) {
        totalFees += (feeRaw * price);
      } else {
        totalFees += feeRaw;
      }

      const pairName = symbols.get(t.symbol_id)?.name || `ID: ${t.symbol_id}`;
      pairCounts[pairName] = (pairCounts[pairName] || 0) + 1;
    });

    const topPairs = Object.entries(pairCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    return {
      totalTrades: collectedTrades.length,
      totalFees,
      totalVolume,
      topPairs
    };
  }, [collectedTrades, symbols, lastMarket]);

  const isWorking = status === 'resolving' || status === 'fetching' || status === 'building' || localBuilding;

  return (
    <div className="space-y-0 pb-16 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="pb-6 border-b border-border">
        <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground/50 mb-1">SoDex Tracker</p>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground" style={{ letterSpacing: '-0.04em' }}>Trade History</h1>
        <p className="mt-1 text-sm text-muted-foreground/60">Full CSV Export for Spot & Futures</p>
      </div>

      {/* Minimal Notice */}
      <div className="mt-6 border border-border bg-card p-4 sm:p-5 flex gap-4 items-start" style={{ borderRadius: 'var(--radius-md)' }}>
        <Info className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-foreground uppercase tracking-[0.18em]">Rate Limit Notice</p>
          <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
            SoDex API has strict rate limits. We fetch 6 pages per minute (1 page every 10 seconds). For accounts with hundreds of thousands of trades, this can take several hours. Please do not close this tab once the export starts. You can browse other dashboard sections while the export continues in the background.
          </p>
        </div>
      </div>

      {/* Address Input */}
      <div className="mt-6 border border-border bg-card p-5 sm:p-6 space-y-5" style={{ borderRadius: 'var(--radius-md)' }}>
        <div className="space-y-2">
          <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.18em]">
            Wallet Address
          </label>
          <div className="flex items-center gap-2 px-3 py-2.5 border border-border bg-muted/20" style={{ borderRadius: 'var(--radius-sm)' }}>
            <Search className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
            <input
              type="text"
              placeholder="0x..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={isWorking}
              className="flex-1 bg-transparent font-mono text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none disabled:opacity-50"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            onClick={() => startExport('perps')}
            disabled={isWorking || !address.trim()}
            className={cn(
              "h-10 font-bold text-[11px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 disabled:opacity-25",
              status === 'fetching' && lastMarket === 'perps'
                ? "bg-foreground text-background"
                : "border border-border text-foreground hover:bg-muted/20"
            )}
            style={{ borderRadius: 'var(--radius-sm)' }}
          >
            <FileDown className="w-3.5 h-3.5" />
            Export Futures History
          </button>

          <button
            onClick={() => startExport('spot')}
            disabled={isWorking || !address.trim()}
            className={cn(
              "h-10 font-bold text-[11px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 disabled:opacity-25",
              status === 'fetching' && lastMarket === 'spot'
                ? "bg-foreground text-background"
                : "border border-border text-foreground hover:bg-muted/20"
            )}
            style={{ borderRadius: 'var(--radius-sm)' }}
          >
            <FileDown className="w-3.5 h-3.5" />
            Export Spot History
          </button>
        </div>
      </div>

      {/* Progress / Status */}
      {isWorking && (
        <div className="mt-6 border border-border bg-card p-5 sm:p-6 space-y-4 animate-in fade-in duration-300" style={{ borderRadius: 'var(--radius-md)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin text-foreground/40" />
              <div>
                <p className="text-sm font-bold text-foreground">
                  {status === 'resolving' && 'Resolving wallet address…'}
                  {status === 'fetching' && `Fetched ${progress.toLocaleString()} trades...`}
                  {(status === 'building' || localBuilding) && 'Building CSV…'}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Clock className="w-3 h-3 text-muted-foreground/40" />
                  <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest">
                    {status === 'fetching' ? 'Throttled: 1 page / 10s. Background Active.' : 'Please wait'}
                  </p>
                </div>
              </div>
            </div>
            {status !== 'done' && (
              <button
                onClick={cancelExport}
                className="h-8 px-3 border border-border text-[10px] font-bold text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-all flex items-center gap-1.5"
                style={{ borderRadius: 'var(--radius-sm)' }}
              >
                <X className="w-3 h-3" />
                Cancel
              </button>
            )}
          </div>

          {status === 'fetching' && (
            <div className="w-full h-px bg-border overflow-hidden">
              <div className="h-full bg-foreground/40 animate-pulse" style={{ width: '100%' }} />
            </div>
          )}
        </div>
      )}

      {/* Done / Success State */}
      {status === 'done' && (
        <div className="mt-6 border border-border bg-card p-5 sm:p-6 space-y-4 animate-in fade-in duration-300" style={{ borderRadius: 'var(--radius-md)' }}>
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-foreground/40 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-foreground">{resultMsg}</p>
              <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest mt-0.5">
                Fetching complete. Click below to download your CSV.
              </p>
            </div>
          </div>
          
          <button
            onClick={handleDownload}
            disabled={localBuilding}
            className="w-full h-10 bg-foreground text-background font-bold text-[11px] uppercase tracking-[0.2em] hover:opacity-80 transition-opacity flex items-center justify-center gap-2 disabled:opacity-25"
            style={{ borderRadius: 'var(--radius-sm)' }}
          >
            {localBuilding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download CSV Now
          </button>
        </div>
      )}

      {/* Summary Stats Section (Appears when trades exist) */}
      {stats && (
        <div className="mt-6 border border-border bg-card p-5 sm:p-6 space-y-5 animate-in fade-in duration-500" style={{ borderRadius: 'var(--radius-md)' }}>
          <div className="flex items-center gap-2 pb-4 border-b border-border">
            <BarChart3 className="w-3.5 h-3.5 text-foreground/30" />
            <h3 className="text-[10px] font-bold text-foreground uppercase tracking-[0.18em]">Export Summary</h3>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            <div className="space-y-1.5">
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.18em]">Total Trades</p>
              <p className="text-xl font-bold text-foreground tabular-nums stat-number">{stats.totalTrades.toLocaleString()}</p>
            </div>
            <div className="space-y-1.5">
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.18em]">Total Fees (USD)</p>
              <p className="text-xl font-bold text-foreground tabular-nums stat-number">${stats.totalFees.toFixed(2)}</p>
            </div>
            <div className="space-y-1.5">
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.18em]">Total Volume (USD)</p>
              <p className="text-xl font-bold text-foreground tabular-nums stat-number">${stats.totalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="space-y-1.5">
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.18em]">Top Pairs</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {stats.topPairs.map(([pair, count]) => (
                  <span key={pair} className="px-2 py-0.5 border border-border text-[9px] font-bold text-muted-foreground/60 uppercase" style={{ borderRadius: 'var(--radius-sm)' }}>
                    {pair} ({count})
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error / Resume */}
      {status === 'error' && (
        <div className="mt-6 border border-border bg-card p-5 sm:p-6 space-y-4 animate-in fade-in duration-300" style={{ borderRadius: 'var(--radius-md)' }}>
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-destructive/60 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-foreground">{error}</p>
              <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest mt-0.5">
                {collectedTrades.length > 0 
                  ? `${collectedTrades.length.toLocaleString()} trades saved. You can resume when ready.`
                  : 'Check the address and try again'}
              </p>
            </div>
          </div>
          
          {collectedTrades.length > 0 && lastMarket && (
            <div className="flex flex-col gap-2">
              <button
                onClick={() => startExport(lastMarket, true)}
                className="w-full h-10 bg-destructive text-destructive-foreground font-bold text-[10px] uppercase tracking-[0.2em] hover:opacity-80 transition-opacity flex items-center justify-center gap-2"
                style={{ borderRadius: 'var(--radius-sm)' }}
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                Resume Export ({collectedTrades.length.toLocaleString()} trades saved)
              </button>
              
              <button
                onClick={handleDownload}
                className="w-full h-10 border border-border text-foreground font-bold text-[10px] uppercase tracking-[0.2em] hover:bg-muted/20 transition-all flex items-center justify-center gap-2"
                style={{ borderRadius: 'var(--radius-sm)' }}
              >
                <Download className="w-3.5 h-3.5" />
                Download Partial CSV
              </button>
            </div>
          )}
        </div>
      )}

      {/* Info & Estimates */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-0 border border-border" style={{ borderRadius: 'var(--radius-md)' }}>
        <div className="p-5 sm:p-6 space-y-3 border-b lg:border-b-0 lg:border-r border-border">
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-3.5 h-3.5 text-foreground/30" />
            <h3 className="text-[10px] font-bold text-foreground uppercase tracking-[0.18em]">How it works</h3>
          </div>
          <ul className="space-y-2 text-[11px] text-muted-foreground/60 leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="text-muted-foreground/30 font-bold">1.</span>
              Strict mode: 6 requests per minute (1 every 10s) to respect SoDex limits.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-muted-foreground/30 font-bold">2.</span>
              Background Process: You can switch to other pages while the export runs.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-muted-foreground/30 font-bold">3.</span>
              Stability: If the fetch stops, use the Resume button to continue.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-muted-foreground/30 font-bold">4.</span>
              Browser: Do not close the tab or put your computer to sleep.
            </li>
          </ul>
        </div>

        <div className="p-5 sm:p-6 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Timer className="w-3.5 h-3.5 text-foreground/30" />
            <h3 className="text-[10px] font-bold text-foreground uppercase tracking-[0.18em]">Time Estimates</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px] border-b border-border/40 pb-1.5">
              <span className="text-muted-foreground/60">1,000 trades</span>
              <span className="font-bold text-foreground">~20 seconds</span>
            </div>
            <div className="flex items-center justify-between text-[11px] border-b border-border/40 pb-1.5">
              <span className="text-muted-foreground/60">10,000 trades</span>
              <span className="font-bold text-foreground">~3.3 minutes</span>
            </div>
            <div className="flex items-center justify-between text-[11px] border-b border-border/40 pb-1.5">
              <span className="text-muted-foreground/60">100,000 trades</span>
              <span className="font-bold text-foreground">~33 minutes</span>
            </div>
            <div className="flex items-center justify-between text-[11px] border-b border-border/40 pb-1.5">
              <span className="text-muted-foreground/60">250,000 trades</span>
              <span className="font-bold text-foreground">~1.4 hours</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground/60">1,000,000 trades</span>
              <span className="font-bold text-foreground">~5.5 hours</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
