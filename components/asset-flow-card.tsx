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
      <Card className="flex min-h-[200px] flex-col items-center justify-center rounded-[2rem] border border-black/8 bg-white p-5 text-foreground shadow-[0_20px_60px_rgba(0,0,0,0.08)] animate-pulse dark:border-white/10 dark:bg-black dark:text-white dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <div className="mb-4 h-8 w-8 rounded-full border-2 border-black/15 border-t-black animate-spin dark:border-white/15 dark:border-t-white" />
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-black/35 dark:text-white/35">Checking holdings</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="flex min-h-[200px] flex-col items-center justify-center rounded-[2rem] border border-black/8 bg-white p-5 text-foreground shadow-[0_20px_60px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-black dark:text-white dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-black/35 dark:text-white/35">Asset allocation</h3>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/35 dark:text-white/35">{error}</p>
      </Card>
    );
  }

  if (assets.length === 0) {
    return (
      <Card className="flex min-h-[200px] flex-col items-center justify-center rounded-[2rem] border border-black/8 bg-white p-5 text-foreground shadow-[0_20px_60px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-black dark:text-white dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-black/35 dark:text-white/35">Asset allocation</h3>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/25 dark:text-white/25">No holdings detected</p>
      </Card>
    );
  }

  return (
    <Card className="flex h-full min-h-[520px] flex-col rounded-[2rem] border border-black/8 bg-white p-5 text-foreground shadow-[0_20px_60px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-black dark:text-white dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
      <div className="flex shrink-0 items-end justify-between gap-3">
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-black/35 dark:text-white/35">Asset allocation</h3>
          <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
            ${totalBalance.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </p>
        </div>
        <p className="text-right text-[10px] font-semibold uppercase tracking-[0.18em] text-black/30 dark:text-white/30">
          {assets.length} holdings
        </p>
      </div>

      <div className={cn(
        "mt-5 grid min-h-0 flex-1 grid-cols-1 content-start gap-2 transition-all duration-300",
        showMore ? "overflow-y-auto pr-2 custom-scrollbar" : "overflow-hidden"
      )}>
        {displayedAssets.map((asset, idx) => {
          const tokenLogo = getTokenLogo(asset.coin);
          return (
            <div
              key={idx}
              className="group relative flex min-h-[46px] items-center justify-between rounded-2xl border border-black/8 bg-black/[0.03] p-3 transition-all hover:bg-black/[0.06] dark:border-white/8 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
            >
              <div
                className="absolute inset-y-2 left-0 w-1 rounded-r-full opacity-70 transition-opacity group-hover:opacity-100"
                style={{ backgroundColor: asset.color }}
              />

              <div className="flex min-w-0 flex-1 items-center gap-3 pl-3">
                <div className="relative shrink-0">
                  {tokenLogo ? (
                    <img
                      src={tokenLogo}
                      alt={asset.coin}
                      className="h-6 w-6 rounded-full bg-black/[0.06] p-0.5 dark:bg-white/[0.06]"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  ) : (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-black/[0.06] text-[8px] font-semibold text-black/45 dark:bg-white/[0.06] dark:text-white/45">
                      {asset.coin[0]}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <span className="block truncate text-[11px] font-semibold tracking-tight text-foreground">
                    {getDisplayName(asset.coin)}
                  </span>
                  {asset.isFuture && (
                    <span className="mt-0.5 block text-[7px] font-semibold uppercase leading-none tracking-[0.14em] text-black/30 dark:text-white/30">futures</span>
                  )}
                </div>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-[11px] font-semibold text-black/60 dark:text-white/60">
                  {formatTokenBalance(asset.balance, asset.coin)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <button
          onClick={() => setShowMore(!showMore)}
          className="mt-4 shrink-0 rounded-2xl border border-black/8 bg-black/[0.025] py-3 text-[10px] font-black uppercase tracking-[0.2em] text-black/35 transition-colors hover:text-black dark:border-white/10 dark:bg-white/[0.03] dark:text-white/35 dark:hover:text-white"
        >
          {showMore ? 'Show Less' : `+${assets.length - previewCount} More Assets`}
        </button>
      )}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(155, 155, 155, 0.2);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(155, 155, 155, 0.4);
        }
      `}</style>
    </Card>
  );
}
