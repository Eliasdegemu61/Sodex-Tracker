// API service for Sodex protocol data

import { cacheManager } from './cache';
import { lookupWalletAddress } from './client-api';

interface PositionData {
  account_id: number;
  position_id: number;
  user_id: number;
  symbol_id: number;
  margin_mode: number; // 1 = ISOLATED, 2 = CROSS
  position_side: number; // 2 = LONG, 3 = SHORT
  size: string;
  initial_margin: string;
  avg_entry_price: string;
  cum_open_cost: string;
  cum_trading_fee: string;
  cum_closed_size: string;
  avg_close_price: string;
  max_size: string;
  realized_pnl: string;
  frozen_size: string;
  leverage: number;
  active: boolean;
  is_taken_over: boolean;
  take_over_price: string;
  created_at: number;
  updated_at: number;
}

export interface SymbolData {
  symbolID: number;
  name: string;
  baseCoin: string;
  quoteCoin?: string;
  [key: string]: unknown;
}

interface PositionsResponse {
  code: number;
  message: string;
  data: PositionData[];
  meta?: {
    next_cursor?: string;
  };
}

interface SymbolsResponse {
  code: number;
  timestamp: number;
  data: Record<string, SymbolData>;
}

export interface SpotTrade {
  account_id: number;
  symbol_id: number;
  trade_id: number;
  side: number; // 1 = Buy, 2 = Sell
  user_id: number;
  order_id: number;
  cl_ord_id: string;
  price: string;
  quantity: string;
  fee: string;
  ts_ms: number;
  is_maker: boolean;
}

export interface SpotMatchDetail {
  buy_trade_id: number;
  buy_price: number;
  buy_qty: number;
  buy_fee: number;
  buy_ts: number;
  sell_trade_id: number;
  sell_price: number;
  sell_qty: number;
  sell_fee: number;
  sell_ts: number;
  pnl: number;
}

interface SpotTradesResponse {
  code: number;
  message: string;
  data: SpotTrade[];
  meta: {
    next_cursor?: string;
  };
}

// Use server-side endpoint for wallet lookup
export async function getUserIdByAddress(address: string): Promise<string> {
  return lookupWalletAddress(address);
}

// All spot trade functions removed per protocol updates

export async function fetchPositions(
  accountId: string | number,
  cursor?: string,
  signal?: AbortSignal
): Promise<{ positions: PositionData[]; nextCursor?: string }> {
  console.log('[STRICT-ID] API Fetch Positions:', accountId, 'Cursor:', cursor);
  const url = new URL('/api/perps/positions', window.location.origin);
  url.searchParams.append('account_id', String(accountId));
  url.searchParams.append('limit', '500');
  if (cursor) {
    url.searchParams.append('cursor', cursor);
  }

  let retries = 3;
  let lastError: Error | null = null;

  while (retries > 0) {
    try {
      const response = await fetch(url.toString(), { signal });
      
      if (response.status === 503 || response.status === 429) {
        console.warn(`[STRICT-ID] API Busy (${response.status}), retrying...`, retries);
        retries--;
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch positions: ${response.statusText}`);
      }

      const data: PositionsResponse = await response.json();
      if (data.code !== 0) {
        throw new Error(`API error: ${data.message}`);
      }

      const positions = data.data || [];
      let nextCursor = data.meta?.next_cursor;

      // Client-side fallback: Construct manual cursor if missing but we likely have more results
      if (!nextCursor && positions.length >= 500) {
        const last = positions[positions.length - 1];
        if (last && last.created_at && last.symbol_id && last.position_id) {
          nextCursor = btoa(`${last.created_at},${last.symbol_id},${last.position_id}`);
          console.log('[STRICT-ID] Client-side manual cursor construction:', nextCursor);
        }
      }

      return {
        positions,
        nextCursor,
      };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') throw err;
      lastError = err as Error;
      retries--;
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  throw lastError || new Error('Failed to fetch positions after retries');
}

export async function fetchAllPositions(
  accountId: string | number,
  onProgress?: (count: number) => void,
  minTimestamp?: number,
  signal?: AbortSignal,
  maxCount?: number,
  initialCursor?: string
): Promise<{ positions: PositionData[]; nextCursor?: string }> {
  const allPositions: PositionData[] = [];
  let cursor: string | undefined = initialCursor;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (signal?.aborted) {
      const abortError = new Error('Fetch aborted');
      abortError.name = 'AbortError';
      throw abortError;
    }

    const { positions, nextCursor } = await fetchPositions(accountId, cursor, signal);
    
    // Add new positions
    allPositions.push(...positions);

    if (onProgress) {
      onProgress(allPositions.length);
    }

    // Check if we've reached the record limit
    if (maxCount && allPositions.length >= maxCount) {
      console.log('[v0] Reached max count limit:', maxCount);
      return { positions: allPositions, nextCursor: nextCursor };
    }

    // Check if we've reached the time limit
    if (minTimestamp && positions.length > 0) {
      const oldestInBatch = positions[positions.length - 1].updated_at;
      if (oldestInBatch < minTimestamp) {
        console.log('[v0] Reached time limit, stopping fetch.');
        break;
      }
    }

    if (!nextCursor || nextCursor === cursor) {
      break;
    }
    cursor = nextCursor;

    // Increased delay to 3 seconds to prevent rate limits and ensure stability
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  return { positions: allPositions };
}

export async function fetchSymbols(): Promise<Map<number, SymbolData>> {
  const response = await fetch('/api/perps/symbols');
  if (!response.ok) {
    throw new Error(`Failed to fetch symbols: ${response.statusText}`);
  }

  const data: SymbolsResponse = await response.json();
  if (data.code !== 0) {
    throw new Error(`API error retrieving symbols`);
  }

  const symbolMap = new Map<number, SymbolData>();
  for (const symbol of Object.values(data.data)) {
    symbolMap.set(symbol.symbolID, symbol);
  }

  return symbolMap;
}

export interface EnrichedPosition extends PositionData {
  pairName: string;
  marginModeLabel: string;
  positionSideLabel: string;
  realizedPnlValue: number;
  tradingFee: number;
  closedSize: number;
  createdAtFormatted: string;
  is_spot?: boolean;
  matches?: SpotMatchDetail[];
}

export async function enrichPositions(
  positions: any
): Promise<EnrichedPosition[]> {
  const symbolMap = await fetchSymbols();
  
  // Final safety: if passed an object with positions array, use that.
  // This prevents 'filter is not a function' if fetchAllPositions result is passed directly.
  const targetArray = Array.isArray(positions) 
    ? positions 
    : (positions && Array.isArray(positions.positions)) 
      ? positions.positions 
      : [];

  return targetArray
    .filter((position: any) => {
      // Only include positions that were closed (have close price and closed size)
      const closedSize = parseFloat(position.cum_closed_size || '0');
      const closePrice = parseFloat(position.avg_close_price || '0');
      return closedSize > 0 && closePrice > 0;
    })
    .map((position) => {
      const symbol = symbolMap.get(position.symbol_id);
      const pairName = symbol?.name || `SYMBOL_${position.symbol_id}`;
      const marginModeLabel = position.margin_mode === 1 ? 'ISOLATED' : 'CROSS';

      // Handle position_side: 2 = LONG, 3 = SHORT (can be string or number)
      const positionSideValue = typeof position.position_side === 'string'
        ? parseInt(position.position_side)
        : position.position_side;
      const positionSideLabel = positionSideValue === 2 ? 'LONG' : positionSideValue === 3 ? 'SHORT' : 'UNKNOWN';

      const realizedPnlValue = parseFloat(position.realized_pnl || '0');
      const tradingFee = parseFloat(position.cum_trading_fee || '0');
      const closedSize = parseFloat(position.cum_closed_size || '0');
      const createdAtFormatted = new Date(position.created_at).toLocaleString();

      console.log('[v0] Enriching position:', {
        pairName,
        closedSize,
        realizedPnlValue,
        tradingFee,
        position_side: positionSideValue,
        positionSideLabel,
      });

      return {
        ...position,
        pairName,
        marginModeLabel,
        positionSideLabel,
        realizedPnlValue,
        tradingFee,
        closedSize,
        createdAtFormatted,
      };
    });
}

export interface OpenPositionData {
  symbol: string;
  positionId: string;
  contractType: string;
  positionType: string;
  positionSide: string; // LONG or SHORT
  positionSize: string;
  entryPrice: string;
  liquidationPrice: string;
  isolatedMargin: string;
  leverage: number;
  unrealizedProfit: string;
  realizedProfit: string;
  cumTradingFee: string;
  createdTime: number;
  updatedTime: number;
}

export interface BalanceData {
  coin: string;
  walletBalance: string;
  openOrderMarginFrozen: string;
  availableBalance: string;
}

export interface TokenBalance {
  token: string;
  coin: string;
  balance: number;
}

export interface OpenOrderData {
  orderId: string;
  symbol: string;
  positionId: string;
  triggerProfitPrice?: string;
  triggerStopPrice?: string;
  [key: string]: any;
}


export interface DetailedBalanceData {
  totalUsdValue: number;
  tokens: TokenBalance[];
  futuresBalance: number;
  spotBalance: number;
  hasUnpricedAssets: boolean;
  unpricedTokens: string[];
}

export interface AccountDetailsData {
  positions: OpenPositionData[];
  balances: BalanceData[];
  openOrders?: OpenOrderData[];
  isolatedMargin: string;
  crossMargin: string;
  availableMarginForIsolated: string;
  availableMarginForCross: string;
}

export interface AccountDetailsResponse {
  code: number;
  timestamp: number;
  data: AccountDetailsData;
}

export async function fetchAccountDetails(userId: string | number): Promise<AccountDetailsData> {
  const cacheKey = `accountDetails_${userId}`;

  return cacheManager.deduplicate(cacheKey, async () => {
    console.log('[STRICT-ID] API Fetch Account Details:', userId);
    const url = `/api/perps/account-details?accountId=${userId}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch account details: ${response.statusText}`);
    }

    const data: AccountDetailsResponse = await response.json();
    if (data.code !== 0) {
      throw new Error(`API error: Failed to fetch account details`);
    }

    // Also fetch open orders to get TP/SL mapping
    try {
      const ordersUrl = `https://mainnet-gw.sodex.dev/futures/fapi/trade/v1/public/list?accountId=${userId}`;
      const ordersResponse = await fetch(ordersUrl);
      if (ordersResponse.ok) {
        const ordersJson = await ordersResponse.json();
        if (ordersJson.code === 0 && ordersJson.data) {
          data.data.openOrders = ordersJson.data;
        }
      }
    } catch (e) {
      console.error('[v0] Failed to fetch open orders for TP/SL mapping:', e);
    }

    console.log('[v0] Fetched account details - positions:', data.data.positions.length, 'balance:', data.data.balances[0]?.walletBalance);
    return data.data;
  }, 5);
}

export async function fetchOpenPositions(userId: string | number): Promise<OpenPositionData[]> {
  const accountData = await fetchAccountDetails(userId);
  return accountData.positions || [];
}

export interface SpotBalance {
  coin: string;
  balance: string;
  availableBalance: string;
}

export interface SpotBalanceResponse {
  code: number;
  data: {
    spotBalance: SpotBalance[];
    totalUsdtAmount: number;
  };
}

export async function fetchSpotBalance(userId: string | number): Promise<SpotBalance[]> {
  const cacheKey = `spotBalance_${userId}`;

  return cacheManager.deduplicate(cacheKey, async () => {
    const url = `https://mainnet-gw.sodex.dev/pro/p/user/balance/list?accountId=${userId}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch spot balance: ${response.statusText}`);
    }

    const data: SpotBalanceResponse = await response.json();
    if (data.code !== 0) {
      throw new Error(`API error: Failed to fetch spot balance`);
    }

    console.log('[v0] Fetched spot balance - tokens:', data.data.spotBalance.length);
    return data.data.spotBalance || [];
  });
}

export interface MarkPrice {
  s: string; // Symbol like "BTC-USD"
  p: string; // Price
  t: number; // Timestamp
}

export interface MarkPriceResponse {
  code: number;
  data: MarkPrice[];
}

export async function fetchMarkPrices(): Promise<MarkPrice[]> {
  const cacheKey = 'markPrices';

  return cacheManager.deduplicate(cacheKey, async () => {
    const url = `/api/perps/mark-prices`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch mark prices: ${response.statusText}`);
    }

    const data: MarkPriceResponse = await response.json();
    if (data.code !== 0) {
      throw new Error(`API error: Failed to fetch mark prices`);
    }

    return data.data || [];
  }, 10);
}

export interface FundingRateData {
  symbol: string;
  fundingRate: string;
  collectionInterval: number;
  nextCollectionTime: number;
}

export interface FundingRateResponse {
  code: number;
  timestamp: number;
  data: FundingRateData;
}

export async function fetchFundingRate(symbol: string): Promise<FundingRateData> {
  const cacheKey = `fundingRate_${symbol}`;
  
  // We use a shorter cache for funding rates (e.g. 1 minute) as they don't change often 
  // but we want the nextCollectionTime to stay relatively accurate
  return cacheManager.deduplicate(cacheKey, async () => {
    const url = `https://mainnet-gw.sodex.dev/futures/fapi/market/v1/public/q/funding-rate?symbol=${symbol}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch funding rate for ${symbol}: ${response.statusText}`);
    }

    const data: FundingRateResponse = await response.json();
    if (data.code !== 0) {
      throw new Error(`API error: Failed to fetch funding rate for ${symbol}`);
    }

    return data.data;
  }, 10);
}

interface FallbackMarkPrice {
  symbol: string;
  markPrice: string;
}

interface FallbackMarkPriceResponse {
  code: number;
  data: FallbackMarkPrice[];
}

export async function fetchFallbackMarkPrices(): Promise<Map<string, number>> {
  const cacheKey = 'fallbackMarkPrices';

  return cacheManager.deduplicate(cacheKey, async () => {
    const url = `https://mainnet-gw.sodex.dev/api/v1/perps/markets/mark-prices`;

    const response = await fetch(url);
    if (!response.ok) {
      console.warn('[v0] Failed to fetch fallback mark prices:', response.statusText);
      return new Map();
    }

    const data: FallbackMarkPriceResponse = await response.json();
    if (data.code !== 0) {
      console.warn('[v0] Fallback API error:', data.code);
      return new Map();
    }

    // Create map of token -> price
    const fallbackPrices = new Map<string, number>();
    data.data.forEach((mp) => {
      // Extract token name from symbol (e.g., "SILVER-USD" -> "SILVER")
      const tokenName = mp.symbol.split('-')[0];
      fallbackPrices.set(tokenName, parseFloat(mp.markPrice));
    });

    console.log('[v0] Fetched fallback mark prices - count:', fallbackPrices.size);
    return fallbackPrices;
  });
}

// Normalize token name to match with mark prices
function normalizeTokenName(coin: string): string {
  // Remove "v" prefix
  let normalized = coin.startsWith('v') ? coin.slice(1) : coin;

  // Handle special cases
  if (normalized === 'SOSO' || normalized === 'WSOSO') return 'SOSO';
  if (normalized === 'MAG7.ssi') return 'MAG7';
  if (normalized === 'USDC') return 'USDC';

  return normalized;
}

// Fetch token price from CoinGecko as a third fallback
async function fetchCoinGeckoPrice(tokenName: string): Promise<number | null> {
  try {
    // Map common token symbols to CoinGecko IDs
    const tokenToCoinGeckoId: Record<string, string> = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'USDT': 'tether',
      'USDC': 'usd-coin',
      'SOL': 'solana',
      'XRP': 'ripple',
      'ADA': 'cardano',
      'DOGE': 'dogecoin',
      'MATIC': 'matic-network',
      'AVAX': 'avalanche-2',
      'ARB': 'arbitrum',
      'OP': 'optimism',
      'NEAR': 'near',
      'FTM': 'fantom',
      'LINK': 'chainlink',
      'AAVE': 'aave',
      'UNI': 'uniswap',
      'SUSHI': 'sushi',
      'WBTC': 'wrapped-bitcoin',
      'DAI': 'dai',
    };

    const coinGeckoId = tokenToCoinGeckoId[tokenName.toUpperCase()];
    if (!coinGeckoId) {
      console.log('[v0] No CoinGecko mapping for token:', tokenName);
      return null;
    }

    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinGeckoId}&vs_currencies=usd&x_cg_pro_api_key=CG-VoXjqhPDCQRHXxJHRjqH6hpr`
    );

    if (!response.ok) {
      console.log('[v0] CoinGecko API error for', tokenName, ':', response.statusText);
      return null;
    }

    const data = await response.json();
    const price = data[coinGeckoId]?.usd;

    if (price !== undefined) {
      console.log('[v0] Got CoinGecko price for', tokenName, ':', price);
      return price;
    }

    return null;
  } catch (error) {
    console.log('[v0] CoinGecko fetch error for token:', tokenName, error);
    return null;
  }
}

export async function fetchDetailedBalance(userId: string | number): Promise<DetailedBalanceData> {
  const cacheKey = `detailedBalance_${userId}`;

  return cacheManager.deduplicate(cacheKey, async () => {
    try {
      const accountId = userId;

      // Import spot balance calculator dynamically to avoid circular dependencies
      const { fetchDetailedSpotBalance } = await import('./spot-balance');

      // Fetch futures balance via proxy
      const futuresResponse = await fetch(`/api/perps/account-details?accountId=${accountId}`).then(r => r.json());

      if (futuresResponse.code !== 0) {
        throw new Error(`Failed to fetch futures balance: code=${futuresResponse.code}`);
      }

      // Get futures balance (USDC wallet balance)
      const futuresBalance = parseFloat(futuresResponse.data?.balances?.[0]?.walletBalance || '0');
      console.log('[v0] Futures USDC balance:', futuresBalance);

      // Fetch detailed spot balance with precise USD calculations
      let spotDetailedBalance = { tokens: [] as any[], totalUsdValue: 0, hasUnpricedAssets: false, unpricedTokens: [] as string[] };
      try {
        spotDetailedBalance = await fetchDetailedSpotBalance(accountId);
        console.log('[v0] Spot balance calculated - total USD:', spotDetailedBalance.totalUsdValue);
      } catch (spotError) {
        console.warn('[v0] Error calculating detailed spot balance:', spotError);
        // Continue with zero spot balance if there's an error
      }

      // Convert detailed spot tokens to TokenBalance format
      const tokens: TokenBalance[] = spotDetailedBalance.tokens.map((t: any) => ({
        token: t.token,
        coin: t.originalCoin,
        balance: t.balance,
      }));

      const totalUsdValue = spotDetailedBalance.totalUsdValue + futuresBalance;
      console.log('[v0] Total balance - Spot:', spotDetailedBalance.totalUsdValue, '+ Futures:', futuresBalance, '= Total:', totalUsdValue);
      console.log('[v0] Unpriced assets:', spotDetailedBalance.hasUnpricedAssets, 'tokens:', spotDetailedBalance.unpricedTokens);

      return {
        totalUsdValue,
        tokens,
        futuresBalance,
        spotBalance: spotDetailedBalance.totalUsdValue,
        hasUnpricedAssets: spotDetailedBalance.hasUnpricedAssets,
        unpricedTokens: spotDetailedBalance.unpricedTokens,
      };
    } catch (err) {
      console.error('[v0] Error fetching detailed balance:', err);
      throw err;
    }
  });
}

export async function fetchTotalBalance(userId: string | number): Promise<{ spotBalance: number; futuresBalance: number; totalBalance: number }> {
  const cacheKey = `totalBalance_${userId}`;

  return cacheManager.deduplicate(cacheKey, async () => {
    try {
      // Fetch account details for futures balance
      const accountData = await fetchAccountDetails(userId);

      // Get futures balance directly from account data (already in USD)
      const futuresBalance = parseFloat(accountData.balances[0]?.walletBalance || '0');

      // Spot balance fetch was removed as it was failing and unused in UX
      let spotBalance = 0;

      const totalBalance = spotBalance + futuresBalance;

      console.log('[v0] Balance - spot:', spotBalance, 'futures:', futuresBalance, 'total:', totalBalance);

      return {
        spotBalance: spotBalance,
        futuresBalance: futuresBalance,
        totalBalance: totalBalance,
      };
    } catch (err) {
      console.error('[v0] Error calculating total balance:', err);
      throw err;
    }
  });
}

export interface TokenBalance {
  token: string;
  coin: string;
  balance: number;
}

export interface BalanceData {
  totalUsdValue: number;
  tokens: TokenBalance[];
  futuresBalance: number;
  spotBalance: number;
  hasUnpricedAssets?: boolean;
  unpricedTokens?: string[];
}

export interface PnLOverviewData {
  account_id: number;
  ts_ms: number;
  cumulative_pnl: string;
  cumulative_quote_volume: string;
  unrealized_pnl: string;
}

export async function fetchPnLOverview(
  userId: string | number
): Promise<PnLOverviewData> {
  const cacheKey = `pnl_overview_${userId}`;

  return cacheManager.deduplicate(cacheKey, async () => {
    console.log('[STRICT-ID] API Fetch PnL Overview:', userId);
    const response = await fetch(`/api/perps/pnl-overview?account_id=${userId}`);

    if (!response.ok) {
      console.warn(`[v0] Failed to fetch PnL overview: ${response.statusText}`);
      // Graceful fallback to prevent page crash on 503 Service Unavailable
      return {
        account_id: typeof userId === 'number' ? userId : parseInt(userId as string) || 0,
        ts_ms: Date.now(),
        cumulative_pnl: '0',
        cumulative_quote_volume: '0',
        unrealized_pnl: '0'
      };
    }

    const result = await response.json();

    if (result.error) {
      throw new Error(result.error);
    }

    console.log('[v0] PnL overview fetched:', {
      volume: result.data.cumulative_quote_volume,
      fromCache: result.fromCache,
    });

    return result.data;
  });
}

export function getVolumeFromPnLOverview(
  pnlData: PnLOverviewData
): number {
  return parseFloat(pnlData.cumulative_quote_volume || '0');
}
export async function fetchUserRank(
  walletAddress: string,
  windowType: string = '30D',
  sortBy: string = 'volume'
): Promise<any> {
  const url = new URL('/api/leaderboard/rank', window.location.origin);
  url.searchParams.append('window_type', windowType);
  url.searchParams.append('sort_by', sortBy);
  url.searchParams.append('wallet_address', walletAddress);

  try {
    const response = await fetch(url.toString());
    if (!response.ok) return null;
    const data = await response.json();
    if (data.code === 0 && data.data?.found) {
      return data.data.item;
    }
    return null;
  } catch (error) {
    console.error('[v0] Error fetching user rank:', error);
    return null;
  }
}

export async function fetchLiveLeaderboardData(
  windowType: string = 'ALL_TIME',
  sortBy: string = 'pnl',
  pageSize: number = 50
): Promise<any[]> {
  const url = new URL('/api/leaderboard/list', window.location.origin);
  url.searchParams.append('window_type', windowType);
  url.searchParams.append('sort_by', sortBy);
  url.searchParams.append('sort_order', 'desc');
  url.searchParams.append('page', '1');
  url.searchParams.append('page_size', String(pageSize));

  try {
    const response = await fetch(url.toString());
    if (!response.ok) return [];
    const data = await response.json();
    if (data.code === 0 && data.data?.items) {
      return data.data.items;
    }
    return [];
  } catch (error) {
    console.error('[v0] Error fetching live leaderboard:', error);
    return [];
  }
}
