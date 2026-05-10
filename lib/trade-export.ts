/**
 * Trade export helper — fetches all spot or perps trades for an account
 * using cursor-based pagination with strict rate-limiting (10s throttle).
 * 
 * Uses local API proxy routes to avoid browser CORS issues.
 */

export interface RawTrade {
  account_id: number;
  symbol_id: number;
  trade_id: number;
  side: number; // 1 = Buy (spot) / Long (perps), 2 = Sell (spot) / Short (perps)
  user_id: number;
  order_id: number;
  cl_ord_id: string;
  price: string;
  quantity: string;
  fee: string;
  ts_ms: number;
  is_maker: boolean;
}

interface TradesApiResponse {
  code: number;
  message: string;
  data: RawTrade[];
  meta?: {
    next_cursor?: string;
  };
}

export interface ExportResult {
  trades: RawTrade[];
  nextCursor?: string;
  finished: boolean;
}

export async function fetchAllTrades(
  accountId: number,
  market: 'spot' | 'perps',
  options: {
    onProgress?: (count: number) => void;
    signal?: AbortSignal;
    initialCursor?: string;
    initialTrades?: RawTrade[];
  } = {}
): Promise<ExportResult> {
  const { onProgress, signal, initialCursor, initialTrades = [] } = options;

  const baseUrl =
    market === 'spot'
      ? '/api/spot/trades'
      : '/api/perps/trades';

  const limit = 500;
  let cursor = initialCursor;
  
  // Use a map to track trade_ids and avoid duplicates
  const tradeMap = new Map<number, RawTrade>();
  initialTrades.forEach(t => tradeMap.set(t.trade_id, t));

  let consecutiveErrors = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (signal?.aborted) {
      return { trades: Array.from(tradeMap.values()), nextCursor: cursor, finished: false };
    }

    try {
      const url = new URL(baseUrl, window.location.origin);
      url.searchParams.set('account_id', String(accountId));
      url.searchParams.set('limit', String(limit));
      if (cursor) url.searchParams.set('cursor', cursor);

      const res = await fetch(url.toString(), { signal, cache: 'no-store' });

      // Handle 429 — back off and retry the same page
      if (res.status === 429) {
        consecutiveErrors++;
        const retryAfter = Number(res.headers.get('Retry-After')) || (consecutiveErrors * 30);
        console.warn(`[trade-export] 429 hit (attempt ${consecutiveErrors}) — backing off ${retryAfter}s`);
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        continue;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const json: TradesApiResponse = await res.json();
      if (json.code !== 0) {
        throw new Error(`API ${json.code}: ${json.message}`);
      }

      // Success! Reset error counter
      consecutiveErrors = 0;

      const newData = json.data ?? [];
      
      if (newData.length === 0 && !json.meta?.next_cursor) {
        return { trades: Array.from(tradeMap.values()), finished: true };
      }

      let newUniqueCount = 0;
      newData.forEach(t => {
        if (!tradeMap.has(t.trade_id)) {
          tradeMap.set(t.trade_id, t);
          newUniqueCount++;
        }
      });

      console.log(`[trade-export] Page fetched: ${newData.length} trades (${newUniqueCount} new)`);
      onProgress?.(tradeMap.size);

      if (!json.meta?.next_cursor || json.meta.next_cursor === cursor) {
        return { trades: Array.from(tradeMap.values()), finished: true };
      }

      cursor = json.meta.next_cursor;

      // RATE LIMITING: 1 request every 10 seconds (6 req/min)
      console.log('[trade-export] Page fetched. Waiting 10s before next request...');
      await new Promise((r) => setTimeout(r, 10000));

    } catch (error: any) {
      if (error.name === 'AbortError') throw error;
      
      consecutiveErrors++;
      console.error(`[trade-export] Fetch error (attempt ${consecutiveErrors}):`, error);

      const retryDelay = consecutiveErrors === 1 ? 5000 : consecutiveErrors === 2 ? 10000 : 20000;
      if (consecutiveErrors > 3) {
        return { trades: Array.from(tradeMap.values()), nextCursor: cursor, finished: false };
      }
      await new Promise((r) => setTimeout(r, retryDelay));
    }
  }
}
