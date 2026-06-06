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
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4">
      <div className="w-full max-w-md animate-in fade-in duration-300">

        <div className="mb-6">
          <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground/50 mb-1">SoDex Tracker</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground" style={{ letterSpacing: '-0.04em' }}>Portfolio</h2>
          <p className="mt-1.5 text-sm text-muted-foreground/60">Bind your wallet to track performance</p>
        </div>

        <div className="border border-border bg-card" style={{ borderRadius: 'var(--radius-md)' }}>
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
              <input
                type="text"
                placeholder="Paste wallet address…"
                value={address}
                onChange={(e) => { setAddress(e.target.value); setError(null); }}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/30 font-mono focus:outline-none disabled:opacity-50"
              />
              {address && !isLoading && (
                <button onClick={() => { setAddress(''); setError(null); }}>
                  <span className="text-muted-foreground/40 hover:text-foreground transition-colors text-xs">×</span>
                </button>
              )}
            </div>
          </div>

          {(status || error) && (
            <div className="px-4 py-3 border-b border-border">
              {status && (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin text-muted-foreground shrink-0" />
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{status}</p>
                </div>
              )}
              {error && (
                <p className="text-[10px] font-bold text-destructive uppercase tracking-widest">{error}</p>
              )}
            </div>
          )}

          <div className="p-3">
            <button
              onClick={() => handleBind()}
              disabled={isLoading || !address.trim()}
              className="w-full py-3 text-[11px] font-bold uppercase tracking-[0.2em] bg-foreground text-background transition-opacity hover:opacity-80 disabled:opacity-25"
              style={{ borderRadius: 'var(--radius-sm)' }}
            >
              {isLoading ? 'Binding...' : 'Bind Wallet'}
            </button>
          </div>
        </div>

        <p className="mt-4 text-center text-[9px] text-muted-foreground/30 uppercase tracking-[0.2em]">
          Your address is stored locally on this device
        </p>
      </div>
    </div>
  );
}
