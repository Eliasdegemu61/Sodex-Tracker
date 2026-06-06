import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0]
    const start = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const res = await fetch(
      `https://mainnet-data.sodex.dev/api/v1/dashboard/tvl?start_date=${start}&end_date=${today}`,
      { cache: 'no-store' }
    )
    if (!res.ok) throw new Error(`upstream ${res.status}`)

    const json = await res.json()
    const rows: Array<{ day_date: string; value: string }> = json?.data?.data ?? []

    const data = rows.map(r => ({
      date: r.day_date,
      value: parseFloat(r.value),
    }))

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[tvl-history] error', err)
    return NextResponse.json({ data: [] }, { status: 500 })
  }
}
