import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface Ticker {
  symbol: string
  quoteVolume: string
}

async function fetchTickers(endpoint: string): Promise<Ticker[]> {
  const res = await fetch(endpoint, { cache: 'no-store' })
  if (!res.ok) throw new Error(`upstream ${res.status}`)
  const json = await res.json()
  if (json.code !== 0) throw new Error(`api code ${json.code}`)
  return json.data ?? []
}

export async function GET() {
  try {
    const [perpsTickers, spotTickers] = await Promise.all([
      fetchTickers('https://mainnet-gw.sodex.dev/api/v1/perps/markets/tickers'),
      fetchTickers('https://mainnet-gw.sodex.dev/api/v1/spot/markets/tickers'),
    ])

    const futures24h = perpsTickers.reduce((sum, t) => sum + parseFloat(t.quoteVolume || '0'), 0)
    const spot24h = spotTickers.reduce((sum, t) => sum + parseFloat(t.quoteVolume || '0'), 0)
    const vol24h = futures24h + spot24h

    return NextResponse.json({ vol24h, spot24h, futures24h })
  } catch (err) {
    console.error('[volume-24h] error', err)
    return NextResponse.json({ vol24h: 0, spot24h: 0, futures24h: 0 }, { status: 500 })
  }
}
