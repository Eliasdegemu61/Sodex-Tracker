'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { usePortfolio } from '@/context/portfolio-context';
import { fetchDetailedBalance } from '@/lib/sodex-api';
import { getTokenLogo } from '@/lib/token-logos';
import { cn } from '@/lib/utils';

interface AssetData {
  coin: string;
  balance: string;
  isFuture?: boolean;
  color?: string;
}

interface AssetFlowCardProps {
  walletAddress: string;
}

const ASSET_COLORS = [
  '#FF9500', // Orange - BTC
  '#3B82F6', // Blue - ETH
  '#EC4899', // Pink - SOL
  '#10B981', // Green
  '#8B5CF6', // Purple
  '#EF4444', // Red
  '#F59E0B', // Amber
  '#06B6D4', // Cyan
];

// Token decimal mapping
const TOKEN_DECIMALS: Record<string, number> = {
  BTC: 8,
  ETH: 18,
  SOL: 9,
  USDC: 6,
  USDT: 6,
  WBTC: 8,
  WETH: 18,
  WSOL: 9,
  ARB: 18,
  OP: 18,
  LINK: 18,
  UNI: 18,
  AAVE: 18,
  DAI: 18,
  WMATIC: 18,
  MATIC: 18,
  AVAX: 18,
  FTM: 18,
  CRV: 18,
  CVX: 18,
  SOSO: 18,
  WSOSO: 18,
  MAG7: 18,
  'MAG7.ssi': 18,
};

export function AssetFlowCard({ walletAddress }: AssetFlowCardProps) {
  const { userId } = usePortfolio();
  const [assets, setAssets] = useState<AssetData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalBalance, setTotalBalance] = useState<number>(0);

  // Display name formatter - removes initial 'v' or 'w' from token symbol
  const getDisplayName = (coin: string): string => {
    if (coin.startsWith('v') || coin.startsWith('w')) {
      return coin.slice(1);
    }
    return coin;
  };

  // Get decimals for a token
  const getTokenDecimals = (coin: string): number => {
    const displayName = getDisplayName(coin);
    return TOKEN_DECIMALS[displayName] || 18; // Default to 18 if not found
  };

  // Format token balance with proper decimals
  const formatTokenBalance = (balance: string, coin: string): string => {
    try {
      const num = parseFloat(balance);
      return num.toFixed(4);
    } catch {
      return '0';
    }
  };

  useEffect(() => {
    if (!userId) return;
    fetchAssets();
  }, [userId]);

  const fetchAssets = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Use the new detailed balance function which returns tokens with USD values
      const balanceData = await fetchDetailedBalance(userId!);

      // Convert detailed balance tokens to AssetData format - just holdings
      const assetList: AssetData[] = balanceData.tokens.map((token, idx) => ({
        coin: token.token,
        balance: token.balance.toString(),
        isFuture: false,
        color: ASSET_COLORS[idx % ASSET_COLORS.length],
      }));

      // Add futures USDC if balance > 0
      if (balanceData.futuresBalance > 0) {
        const existingUsdcIndex = assetList.findIndex(
          (asset) => asset.coin.toUpperCase() === 'USDC'
        );

        if (existingUsdcIndex >= 0) {
          // Combine with existing USDC
          const existingTokenAmount = parseFloat(assetList[existingUsdcIndex].balance);
          assetList[existingUsdcIndex].balance = (existingTokenAmount + balanceData.futuresBalance).toString();
        } else {
          // Add new USDC entry from futures
          assetList.push({
            coin: 'USDC',
            balance: balanceData.futuresBalance.toString(),
            isFuture: true,
            color: ASSET_COLORS[assetList.length % ASSET_COLORS.length],
          });
        }
      }

      // Sort by balance amount
      assetList.sort((a, b) => parseFloat(b.balance) - parseFloat(a.balance));

      setAssets(assetList);
      setTotalBalance(balanceData.totalUsdValue);
    } catch (err) {
      console.error('[v0] Error fetching assets:', err);
      setError(err instanceof Error ? err.message : 'Failed to load assets');
      setAssets([]);
    } finally {
      setIsLoading(false);
    }
  };

  const [showMore, setShowMore] = useState(false);
  const previewCount = 8;
  const hasMore = assets.length > previewCount;
  const displayedAssets = showMore ? assets : assets.slice(0, previewCount);

  if (isLoading) {
    return (
      <div className="border border-border bg-card" style={{ borderRadius: 'var(--radius-md)' }}>
        <div className="px-4 py-3 border-b border-border">
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Asset Allocation</span>
        </div>
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-destructive/30 bg-card" style={{ borderRadius: 'var(--radius-md)' }}>
        <div className="px-4 py-3 border-b border-border">
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Asset Allocation</span>
        </div>
        <div className="flex items-center justify-center p-8">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="border border-border bg-card" style={{ borderRadius: 'var(--radius-md)' }}>
        <div className="px-4 py-3 border-b border-border">
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Asset Allocation</span>
        </div>
        <div className="flex items-center justify-center p-8">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40">No holdings detected</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col border border-border bg-card text-foreground" style={{ borderRadius: 'var(--radius-md)' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Asset Allocation</span>
        <div className="flex items-center gap-3">
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">{assets.length} holdings</span>
          <span className="text-sm font-bold tracking-tight text-foreground">${totalBalance.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
        </div>
      </div>

      <div className={cn(
        "p-3 grid grid-cols-1 content-start gap-1 transition-all duration-300",
        showMore ? "overflow-y-auto max-h-96" : "overflow-hidden"
      )}>
        {displayedAssets.map((asset, idx) => {
          const tokenLogo = getTokenLogo(asset.coin);
          return (
            <div
              key={idx}
              className="group relative flex items-center justify-between border border-border py-2 px-3 hover:bg-muted/20 transition-colors"
              style={{ borderRadius: 'var(--radius-sm)' }}
            >
              <div
                className="absolute inset-y-2 left-0 w-0.5 opacity-60 group-hover:opacity-100 transition-opacity"
                style={{ backgroundColor: asset.color }}
              />
              <div className="flex min-w-0 flex-1 items-center gap-2.5 pl-2">
                <div className="relative shrink-0">
                  {tokenLogo ? (
                    <img src={tokenLogo} alt={asset.coin} className="h-5 w-5 rounded-full bg-muted" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                  ) : (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[8px] font-bold text-muted-foreground">
                      {asset.coin[0]}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <span className="block truncate text-[11px] font-bold tracking-tight text-foreground">{getDisplayName(asset.coin)}</span>
                  {asset.isFuture && (
                    <span className="block text-[7px] font-bold uppercase tracking-widest text-muted-foreground/50">futures</span>
                  )}
                </div>
              </div>
              <span className="text-[10px] font-bold text-muted-foreground shrink-0">{formatTokenBalance(asset.balance, asset.coin)}</span>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <button
          onClick={() => setShowMore(!showMore)}
          className="mx-3 mb-3 border border-border py-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
          style={{ borderRadius: 'var(--radius-sm)' }}
        >
          {showMore ? 'Show Less' : `+${assets.length - previewCount} More`}
        </button>
      )}
    </div>
  );
}
