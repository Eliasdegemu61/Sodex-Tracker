import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0]
    const start8d = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const res = await fetch(
      `https://mainnet-data.sodex.dev/api/v1/dashboard/volume?start_date=${start8d}&end_date=${today}`,
      { cache: 'no-store' }
    )

    if (!res.ok) throw new Error(`upstream ${res.status}`)

    const json = await res.json()
    const rows: Array<{ day_date: string; total: string }> = json?.data?.data ?? []

    if (rows.length === 0) {
      return NextResponse.json({ vol24h: 0, vol7d: 0 })
    }

    // Latest day = 24h volume
    const latest = rows[rows.length - 1]
    const vol24h = parseFloat(latest.total ?? '0')

    // Last 7 rows = 7d volume
    const last7 = rows.slice(-7)
    const vol7d = last7.reduce((sum, r) => sum + parseFloat(r.total ?? '0'), 0)

    return NextResponse.json({ vol24h, vol7d })
  } catch (err) {
    console.error('[vol-summary] error', err)
    return NextResponse.json({ vol24h: 0, vol7d: 0 }, { status: 500 })
  }
}
