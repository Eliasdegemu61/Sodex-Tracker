'use client';

import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { usePortfolio } from '@/context/portfolio-context';
import { cacheManager } from '@/lib/cache';
import { Loader2, X } from 'lucide-react';

interface WalletBindDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WalletBindDialog({ open, onOpenChange }: WalletBindDialogProps) {
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const { bindWalletFast } = usePortfolio();

  const handleBind = async () => {
    if (!address.trim()) {
      setError('Please enter a wallet address');
      return;
    }
    setIsLoading(true);
    setError(null);
    setStatus(null);
    try {
      cacheManager.clear();
      setStatus('Loading recent position history...');
      await bindWalletFast(address.trim(), false);
      setStatus('Account bound successfully!');
      setTimeout(() => { onOpenChange(false); setAddress(''); setStatus(null); }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to bind address');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setAddress(text);
      setError(null);
    } catch {
      setError('Failed to read clipboard');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm p-0 bg-background border border-border rounded-xl shadow-2xl overflow-hidden gap-0">

        {/* Header */}
        <div className="px-6 pt-6 pb-5 border-b border-border">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-bold text-foreground tracking-tight">Connect Wallet</h2>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1 font-medium">
                Enter your address to load position history
              </p>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/10 transition-all -mt-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Wallet Address</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="0x..."
                value={address}
                onChange={(e) => { setAddress(e.target.value); setError(null); }}
                disabled={isLoading}
                className="flex-1 h-10 bg-secondary/5 border border-border rounded-lg px-3 font-mono text-xs text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-border/80 transition-all disabled:opacity-50"
              />
              <button
                onClick={handlePaste}
                disabled={isLoading}
                className="h-10 px-3 text-[10px] font-bold uppercase tracking-widest border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/10 transition-all disabled:opacity-40"
              >
                Paste
              </button>
            </div>
          </div>

          {status && (
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin shrink-0" />
              {status}
            </p>
          )}
          {error && (
            <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-2">
          <button
            onClick={handleBind}
            disabled={isLoading || !address.trim()}
            className="flex-1 h-10 bg-foreground text-background rounded-lg font-bold text-[11px] uppercase tracking-[0.2em] hover:bg-foreground/90 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            {isLoading ? 'Loading...' : 'Bind Account'}
          </button>
          <button
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="h-10 px-4 border border-border rounded-lg text-[11px] font-bold text-muted-foreground uppercase tracking-widest hover:text-foreground hover:bg-secondary/10 transition-all disabled:opacity-40"
          >
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
