import { NextRequest, NextResponse } from 'next/server';
import { cacheManager } from '@/lib/cache';

const CACHE_DURATION = 300;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const accountId = searchParams.get('account_id');

    if (!accountId) {
      return NextResponse.json({ error: 'account_id is required' }, { status: 400 });
    }

    const cacheKey = `pnl_daily_stats_${accountId}`;
    const cached = await cacheManager.get(cacheKey);
    if (cached) {
      return NextResponse.json({ ...(cached as object), fromCache: true });
    }

    const url = new URL('https://mainnet-data.sodex.dev/api/v1/perps/pnl/daily_stats');
    url.searchParams.set('account_id', accountId);

    const response = await fetch(url.toString());
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch daily PnL stats: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    await cacheManager.set(cacheKey, data, CACHE_DURATION);

    return NextResponse.json({ ...data, fromCache: false });
  } catch (error) {
    console.error('[perps/pnl-daily-stats] Fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch daily PnL stats' }, { status: 500 });
  }
}
