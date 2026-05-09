import { NextRequest, NextResponse } from 'next/server';

interface SpotTrade {
  account_id: number;
  symbol_id: number;
  trade_id: number;
  side: number;
  user_id: number;
  order_id: number;
  cl_ord_id: string;
  price: string;
  quantity: string;
  fee: string;
  ts_ms: number;
  is_maker: boolean;
}

interface SpotTradesResponse {
  code: number;
  message: string;
  data: SpotTrade[];
  meta: {
    next_cursor?: string;
  };
}

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

    const url = new URL('https://mainnet-data.sodex.dev/api/v1/spot/trades');
    url.searchParams.set('account_id', accountId);
    url.searchParams.set('limit', limit);
    if (cursor) {
      url.searchParams.set('cursor', cursor);
    }

    const response = await fetch(url.toString(), {
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('[spot/trades] Upstream API error:', response.status);
      return NextResponse.json(
        { error: `Failed to fetch spot trades: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data: SpotTradesResponse = await response.json();

    return NextResponse.json({
      code: data.code,
      message: data.message,
      data: data.data || [],
      meta: data.meta
    });
  } catch (error) {
    console.error('[spot/trades] Fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch spot trades' },
      { status: 500 }
    );
  }
}
