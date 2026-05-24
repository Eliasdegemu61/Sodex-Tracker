import { NextRequest, NextResponse } from 'next/server';
import { cacheManager } from '@/lib/cache';

const CACHE_DURATION = 5;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const address = searchParams.get('address')?.trim();

    if (!address) {
      return NextResponse.json({ error: 'address is required' }, { status: 400 });
    }

    const cacheKey = `perps_account_state_${address.toLowerCase()}`;
    const cached = await cacheManager.get(cacheKey);
    if (cached) {
      return NextResponse.json({ ...(cached as object), fromCache: true });
    }

    const response = await fetch(
      `https://mainnet-gw.sodex.dev/api/v1/perps/accounts/${encodeURIComponent(address)}/state`,
      { cache: 'no-store' }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch perps account state: ${response.statusText}` },
        { status: response.status }
      );
    }

    const text = await response.text();
    let data = JSON.parse(text);
    if (typeof data === 'string') {
      data = JSON.parse(data);
    }
    await cacheManager.set(cacheKey, data, CACHE_DURATION);

    return NextResponse.json({ ...data, fromCache: false });
  } catch (error) {
    console.error('[perps/account-state] Fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch perps account state' }, { status: 500 });
  }
}
