'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Unplug } from 'lucide-react';
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
      <div className="flex items-center justify-center min-h-96">
        <Card className="max-w-md border border-red-500/30 bg-card p-8 text-center rounded-[2.5rem] shadow-2xl">
          <h2 className="text-2xl font-bold text-red-400 mb-3 uppercase italic">Sync Failed</h2>
          <p className="text-sm text-muted-foreground mb-6">{error}</p>
          <div className="flex flex-col gap-3">
            <Button variant="outline" onClick={() => window.location.reload()} className="rounded-2xl">
              Retry Sync
            </Button>
            <button
              onClick={() => setShowUnbindConfirm(true)}
              className="text-muted-foreground/40 hover:text-red-400 text-[10px] uppercase font-bold tracking-widest transition-colors"
            >
              Reset Connection
            </button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3 text-foreground md:space-y-5">
        <div className="rounded-xl border border-black/8 bg-white p-3 shadow-[0_20px_60px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-black dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)] md:px-7 md:py-5 md:rounded-[2rem]">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold tracking-[-0.04em] text-foreground md:text-3xl">Portfolio</h1>
                <span className="rounded-full border border-green-500/20 bg-green-500/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-green-500">
                  Live
                </span>
                {(isLoading || isHistoryLoading) && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-orange-500">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Syncing {fetchProgress.count ? fetchProgress.count.toLocaleString() : ''}
                  </span>
                )}
              </div>
              <p className="mt-1 max-w-3xl break-all text-xs font-mono text-muted-foreground/55">
                {walletAddress}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                onClick={() => setShowUnbindConfirm(true)}
                className="h-9 whitespace-nowrap rounded-xl border-red-500/20 bg-red-500/5 px-3 text-[10px] font-semibold uppercase tracking-widest text-red-500 transition-all hover:bg-red-500/10"
              >
                <Unplug className="mr-2 h-4 w-4" />
                Unbind
              </Button>
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
          {walletAddress && <AssetFlowCard walletAddress={sourceWalletAddress || walletAddress} />}
          {walletAddress && <FundFlowTable walletAddress={sourceWalletAddress || walletAddress} />}
        </div>
      </div>

      <AlertDialog open={showUnbindConfirm} onOpenChange={setShowUnbindConfirm}>
        <AlertDialogContent className="rounded-[2.5rem] bg-black border-white/10 p-8">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-black italic uppercase tracking-tight">Unbind Account?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-sm">
              This will remove your wallet address and all cached performance data from this device. You will need to bind your wallet again to see these metrics.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-4 mt-6">
            <AlertDialogCancel className="rounded-2xl border-white/10 bg-white/5 text-white flex-1 font-bold uppercase text-[10px] tracking-widest">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnbind}
              className="bg-red-500 hover:bg-red-600 text-white rounded-2xl flex-1 font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-red-500/20"
            >
              Confirm Unbind
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
