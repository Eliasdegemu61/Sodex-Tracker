import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0]
    const start = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const res = await fetch(
      `https://mainnet-data.sodex.dev/api/v1/dashboard/open-interest?start_date=${start}&end_date=${today}`,
      { cache: 'no-store' }
    )

    if (!res.ok) throw new Error(`upstream ${res.status}`)

    const json = await res.json()
    const rows: any[] = json?.data?.data ?? []

    if (rows.length === 0) {
      return NextResponse.json({ total: 0, date: today, top: [] })
    }

    // Use the latest row
    const latest = rows[rows.length - 1]
    // Use last_markets/last_total — the most recent snapshot (closer to live OI)
    const markets: Record<string, string> = latest.last_markets ?? latest.markets ?? {}
    const total: number = parseFloat(latest.last_total ?? latest.total ?? '0')
    const date: string = latest.day_date

    // Sort pairs by OI descending, exclude zero/ID_ entries
    const top = Object.entries(markets)
      .filter(([pair, val]) => !pair.startsWith('ID_') && parseFloat(val) > 0)
      .map(([pair, val]) => ({ pair, oi: parseFloat(val) }))
      .sort((a, b) => b.oi - a.oi)
      .slice(0, 3)

    return NextResponse.json({ total, date, top })
  } catch (err) {
    console.error('[OI] fetch error', err)
    return NextResponse.json({ total: 0, date: '', top: [] }, { status: 500 })
  }
}
