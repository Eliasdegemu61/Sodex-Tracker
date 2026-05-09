import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const accountId = searchParams.get('account_id');
    const cursor = searchParams.get('cursor');
    const limit = searchParams.get('limit') || '200';

    if (!accountId) {
      return NextResponse.json(
        { error: 'account_id is required' },
        { status: 400 }
      );
    }

    const url = new URL('https://mainnet-data.sodex.dev/api/v1/perps/positions');
    url.searchParams.set('account_id', accountId);
    url.searchParams.set('limit', limit);
    if (cursor) {
      url.searchParams.set('cursor', cursor);
    }

    const response = await fetch(url.toString(), {
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('[perps/positions] Upstream API error:', response.status);
      return NextResponse.json(
        { error: `Failed to fetch positions: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Fix: Sodex API omits next_cursor for limit >= 50
    // We construct it manually from the last item: base64(created_at,symbol_id,position_id)
    if (data.code === 0 && data.data?.length >= Number(limit) && !data.meta?.next_cursor) {
      const positions = data.data;
      const last = positions[positions.length - 1];
      if (last && last.created_at && last.symbol_id && last.position_id) {
        if (!data.meta) data.meta = {};
        data.meta.next_cursor = Buffer.from(`${last.created_at},${last.symbol_id},${last.position_id}`).toString('base64');
        console.log(`[perps/positions] Manually constructed cursor for ${accountId}:`, data.meta.next_cursor);
      }
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[perps/positions] Fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch positions' },
      { status: 500 }
    );
  }
}
