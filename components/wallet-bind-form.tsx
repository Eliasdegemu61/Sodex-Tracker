'use client';

import React, { useState } from 'react';
import { usePortfolio } from '@/context/portfolio-context';
import { cacheManager } from '@/lib/cache';
import { Loader2, Search } from 'lucide-react';

export function WalletBindForm() {
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const { bindWalletFast } = usePortfolio();

  const handleBind = async (addr?: string) => {
    const targetAddress = (addr || address).trim();
    if (!targetAddress) {
      setError('Please enter a wallet address');
      return;
    }
    setIsLoading(true);
    setError(null);
    setStatus(null);
    try {
      cacheManager.clear();
      setStatus('Binding account and loading recent history...');
      await bindWalletFast(targetAddress, false);
      setStatus('Account bound successfully!');
      setAddress('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to bind address');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isLoading && address.trim()) handleBind();
  };

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-500 rounded-[1.5rem] md:rounded-[2rem] border border-black/8 bg-white p-6 md:p-10 shadow-[0_20px_60px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-[#050505] dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        
        <div className="mb-6 md:mb-8">
          <h2 className="mb-1 text-2xl md:text-4xl font-bold tracking-tight text-foreground">Portfolio</h2>
          <p className="text-[10px] md:text-sm font-medium text-muted-foreground/60 tracking-wider">bind your wallet to track performance</p>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <input
              type="text"
              placeholder="0x..."
              value={address}
              onChange={(e) => { setAddress(e.target.value); setError(null); }}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              className="w-full rounded-xl md:rounded-2xl border border-black/10 bg-black/[0.02] px-4 py-3 md:py-4 text-xs md:text-sm font-medium text-foreground placeholder:text-black/25 focus:outline-none focus:ring-1 focus:ring-black/15 transition-all disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.02] dark:placeholder:text-white/25 dark:focus:ring-white/25"
            />
          </div>

          {status && (
            <div className="flex items-center gap-2 py-1">
              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground shrink-0" />
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{status}</p>
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-500/25 bg-red-500/8 p-3">
              <p className="text-xs font-medium text-red-600 dark:text-red-300">{error}</p>
            </div>
          )}

          <button
            onClick={() => handleBind()}
            disabled={isLoading || !address.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl md:rounded-2xl border border-white bg-white py-3 md:py-4 text-xs md:text-sm font-bold text-black shadow-sm transition-all hover:bg-white/90 disabled:opacity-40 tracking-widest"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Syncing...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Bind Wallet</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
