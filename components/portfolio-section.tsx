'use client';

import { useState } from 'react';
import { Loader2, Unplug, Copy, Check, ExternalLink } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { PortfolioOverview } from './portfolio-overview';
import { PnLChart } from './pnl-chart';
import { PositionsTable } from './positions-table';
import { OpenPositions } from './open-positions';
import { WalletBindForm } from './wallet-bind-form';
import { FundFlowTable } from './fund-flow-table';
import { AssetFlowCard } from './asset-flow-card';
import { MonthlyCalendar } from './monthly-calendar';
import { usePortfolio } from '@/context/portfolio-context';

function truncateAddress(address: string) {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

export function PortfolioSection() {
  const {
    walletAddress,
    sourceWalletAddress,
    isLoading,
    isHistoryLoading,
    fetchProgress,
    error,
    clearWalletAddress,
  } = usePortfolio();
  const [showUnbindConfirm, setShowUnbindConfirm] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleUnbind = () => {
    clearWalletAddress();
    setShowUnbindConfirm(false);
  };

  if (!walletAddress) {
    return (
      <div className="text-foreground">
        <WalletBindForm />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-4">
        <div className="w-full max-w-md border border-destructive/30 bg-card" style={{ borderRadius: 'var(--radius-md)' }}>
          <div className="px-5 py-4 border-b border-border">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Portfolio — Sync Failed</span>
          </div>
          <div className="p-5 space-y-4">
            <p className="text-xs text-muted-foreground">{error}</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => window.location.reload()}
                className="py-2.5 text-[10px] font-bold uppercase tracking-widest border border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
                style={{ borderRadius: 'var(--radius-sm)' }}
              >
                Retry
              </button>
              <button
                onClick={() => setShowUnbindConfirm(true)}
                className="py-2.5 text-[10px] font-bold uppercase tracking-widest border border-destructive/30 text-destructive hover:border-destructive transition-colors"
                style={{ borderRadius: 'var(--radius-sm)' }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2 text-foreground">

        {/* ── Header bar ── */}
        <div className="border border-border bg-card" style={{ borderRadius: 'var(--radius-md)' }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-3">
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Portfolio</span>
              <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 border border-border text-muted-foreground" style={{ borderRadius: 'var(--radius-sm)' }}>
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-foreground opacity-40" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-foreground" />
                </span>
                Live
              </span>
              {(isLoading || isHistoryLoading) && (
                <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  Syncing{fetchProgress.count ? ` ${fetchProgress.count.toLocaleString()}` : ''}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
                style={{ borderRadius: 'var(--radius-sm)' }}
                title="Copy address"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                onClick={() => setShowUnbindConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border border-destructive/30 text-destructive hover:border-destructive transition-colors"
                style={{ borderRadius: 'var(--radius-sm)' }}
              >
                <Unplug className="h-3 w-3" /> Unbind
              </button>
            </div>
          </div>
          <div className="px-4 py-2.5">
            <p className="font-mono text-[11px] text-muted-foreground/60 break-all">
              <span className="hidden sm:inline">{walletAddress}</span>
              <span className="sm:hidden">{truncateAddress(walletAddress)}</span>
            </p>
          </div>
        </div>

        {/* PnL Chart — hero, full width */}
        <div className="w-full">
          <PnLChart />
        </div>

        {/* Overview KPI strip */}
        <PortfolioOverview />

        {/* Calendar + Open Positions side by side */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <MonthlyCalendar />
          <OpenPositions />
        </div>

        <PositionsTable />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {walletAddress && <AssetFlowCard walletAddress={sourceWalletAddress || walletAddress} />}
          {walletAddress && <FundFlowTable walletAddress={sourceWalletAddress || walletAddress} />}
        </div>
      </div>

      {/* Unbind Confirm Dialog */}
      <AlertDialog open={showUnbindConfirm} onOpenChange={setShowUnbindConfirm}>
        <AlertDialogContent
          className="max-w-sm border bg-card p-0 overflow-hidden"
          style={{ borderRadius: 'var(--radius-md)', borderColor: 'var(--border)' }}
        >
          <AlertDialogHeader className="px-5 pt-5 pb-4 border-b border-border">
            <AlertDialogTitle className="text-sm font-bold tracking-tight text-foreground">
              Unbind wallet?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground mt-1 leading-relaxed">
              This will remove your wallet and all cached data from this device. You'll need to bind again to see your metrics.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2 p-4">
            <AlertDialogCancel
              className="flex-1 py-2.5 text-[10px] font-bold uppercase tracking-widest border border-border bg-transparent text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
              style={{ borderRadius: 'var(--radius-sm)' }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnbind}
              className="flex-1 py-2.5 text-[10px] font-bold uppercase tracking-widest bg-destructive text-white border-0 transition-opacity hover:opacity-80"
              style={{ borderRadius: 'var(--radius-sm)' }}
            >
              Unbind
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
