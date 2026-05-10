import { NextRequest, NextResponse } from 'next/server';

interface PerpsTrade {
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

interface PerpsTradesResponse {
  code: number;
  message: string;
  data: PerpsTrade[];
  meta: {
    next_cursor?: string;
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const accountId = searchParams.get('account_id');
    const cursor = searchParams.get('cursor');
    const limit = searchParams.get('limit') || '500';

    if (!accountId) {
      return NextResponse.json(
        { error: 'account_id is required' },
        { status: 400 }
      );
    }

    const url = new URL('https://mainnet-data.sodex.dev/api/v1/perps/trades');
    url.searchParams.set('account_id', accountId);
    url.searchParams.set('limit', limit);
    if (cursor) {
      url.searchParams.set('cursor', cursor);
    }

    const response = await fetch(url.toString(), {
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('[perps/trades] Upstream API error:', response.status);
      return NextResponse.json(
        { error: `Failed to fetch perps trades: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data: PerpsTradesResponse = await response.json();

    // Return the data in the format the export helper expects
    return NextResponse.json({
      code: data.code,
      message: data.message,
      data: data.data || [],
      meta: data.meta
    });
  } catch (error) {
    console.error('[perps/trades] Fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch perps trades' },
      { status: 500 }
    );
  }
}
