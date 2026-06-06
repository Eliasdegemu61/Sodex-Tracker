// Cache busted: v3
'use client';

import React from "react"

import { Suspense, useState, lazy, useEffect } from 'react'
import { Moon, Sun, Activity, TrendingUp, Wallet, Trophy, Zap, Compass, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/app/providers'
import { useSessionCache } from '@/context/session-cache-context'
import { DashboardStats } from '@/components/dashboard-stats'
import { VolumeChart } from '@/components/volume-chart'
import { FundFlowChart } from '@/components/fund-flow-chart'
import { TopPairsWidget } from '@/components/top-pairs-widget'
import { TodayTopPairs } from '@/components/today-top-pairs'
import { NetRemainingCard } from '@/components/overall-token-flow'
import { LeaderboardPage } from '@/components/leaderboard-page'
import { TVLCard } from '@/components/tvl-card'
import { VolumeRangeCard } from '@/components/volume-range-card'
import { AnnouncementsPanel } from '@/components/announcements-panel'
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts'
import { MobileNavMenu } from '@/components/mobile-nav-menu'
import { NewTradersTracker } from '@/components/new-traders-tracker'
import { AnnouncementSidePanel } from '@/components/announcement-side-panel'
import { PortfolioSection } from '@/components/portfolio-section'
import { Loader2 } from 'lucide-react'
import { OverallDepositsCard, AssetsSkeleton } from '@/components/overall-token-flow'

import { TrackerSection } from '@/components/tracker-section'
import { DemoTrading } from '@/components/demo-trading'
import { Footer } from '@/components/footer'
import { DexStatusDashboard } from '@/components/dex-status-dashboard'
import { SopointsAnalyzer } from '@/components/sopoints-analyzer'
import { AboutSodex } from '@/components/about-sodex'
import { SidebarNav } from '@/components/sidebar-nav'
import { PortfolioProvider } from '@/context/portfolio-context';
import { JournalPageClient } from '@/components/journal/journal-page-client';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { Search, Settings as SettingsIcon } from 'lucide-react'
import { PulseDashboard } from '@/components/pulse-dashboard'
import { AccruedFunding } from '@/components/accrued-funding'
import { ExportTradeHistory } from '@/components/export-trade-history'


function LoadingCard() {
  return <Card className="p-4 md:p-6 bg-card border border-border h-64 animate-pulse" />
}

function DistributionAnalyzerPage({ onBack }: { onBack: () => void }) {
  const [reversePrefix, setReversePrefix] = useState('')
  const [reverseSuffix, setReverseSuffix] = useState('')
  const [fullResults, setFullResults] = useState<any[]>([])
  const [paginatedResults, setPaginatedResults] = useState<any[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoadingReverse, setIsLoadingReverse] = useState(false)
  const [isLoadingPage, setIsLoadingPage] = useState(false)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  
  const ITEMS_PER_PAGE = 20
  const totalPages = Math.ceil(fullResults.length / ITEMS_PER_PAGE)

  const loadPageData = async (allData: any[], pageNum: number) => {
    setIsLoadingPage(true)
    setExpandedRow(null)
    try {
      const startIndex = (pageNum - 1) * ITEMS_PER_PAGE
      const endIndex = startIndex + ITEMS_PER_PAGE
      const currentSlice = allData.slice(startIndex, endIndex)

      const resultsWithVolume = await Promise.all(
        currentSlice.map(async (item: { address: string; userId: string | number }) => {
          try {
            const volResponse = await fetch(`https://mainnet-data.sodex.dev/api/v1/leaderboard/rank?window_type=ALL_TIME&sort_by=pnl&wallet_address=${item.address}`)
            if (volResponse.ok) {
              const volData = await volResponse.json()
              return {
                ...item,
                volume: volData.data?.item?.volume_usd || 0
              }
            }
          } catch (e) {
            console.error(`Error fetching volume for ${item.address}:`, e)
          }
          return { ...item, volume: 0 }
        })
      )

      setPaginatedResults(resultsWithVolume)
      setCurrentPage(pageNum)
    } finally {
      setIsLoadingPage(false)
    }
  }

  const handleReverseSearch = async () => {
    if (!reversePrefix && !reverseSuffix) return
    setIsLoadingReverse(true)
    setExpandedRow(null)
    try {
      const params = new URLSearchParams()
      if (reversePrefix) params.append('prefix', reversePrefix.toLowerCase())
      if (reverseSuffix) params.append('suffix', reverseSuffix.toLowerCase())

      const response = await fetch(`/api/wallet/reverse-search?${params.toString()}`)
      if (!response.ok) throw new Error('Search failed')

      const { data } = await response.json()
      const matched = data || []
      
      setFullResults(matched)
      
      if (matched.length > 0) {
        await loadPageData(matched, 1)
      } else {
        setPaginatedResults([])
      }
    } catch (error) {
      console.error('[v0] Error searching addresses:', error)
      setFullResults([])
      setPaginatedResults([])
    } finally {
      setIsLoadingReverse(false)
    }
  }

  const toggleRow = (address: string) => {
    setExpandedRow(expandedRow === address ? null : address)
  }

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-500">

      {/* Page Header */}
      <div className="pb-6 border-b border-border">
        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">Reverse Search</h1>
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-[0.2em]">Find wallet addresses by first or last characters</p>
      </div>

      {/* Search Controls */}
      <div className="bg-background sm:bg-background border border-border sm:border rounded-xl sm:rounded-xl p-4 sm:p-8 shadow-none space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">First Characters</label>
            <input
              placeholder="e.g. 0x12"
              maxLength={4}
              value={reversePrefix}
              onChange={(e) => setReversePrefix(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleReverseSearch()}
              className="w-full h-9 sm:h-10 bg-secondary/5 border border-border rounded-lg px-3 font-mono text-[11px] sm:text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-border/80 transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Last Characters</label>
            <input
              placeholder="e.g. a2f4"
              maxLength={4}
              value={reverseSuffix}
              onChange={(e) => setReverseSuffix(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleReverseSearch()}
              className="w-full h-9 sm:h-10 bg-secondary/5 border border-border rounded-lg px-3 font-mono text-[11px] sm:text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-border/80 transition-all"
            />
          </div>
        </div>

        <button
          onClick={handleReverseSearch}
          disabled={isLoadingReverse || (!reversePrefix && !reverseSuffix)}
          className="w-full h-10 sm:h-11 bg-foreground text-background rounded-lg font-bold text-[10px] sm:text-[11px] uppercase tracking-[0.2em] hover:bg-foreground/90 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {isLoadingReverse ? (
            <><Loader2 className="w-4 h-4 animate-spin" /><span>Searching...</span></>
          ) : 'Search'}
        </button>
      </div>

      {/* Results */}
      {fullResults.length > 0 && (
        <div className="bg-transparent sm:bg-background border-none sm:border border-border rounded-none sm:rounded-xl shadow-none overflow-hidden -mx-4 sm:mx-0">

          {/* Header */}
          <div className="px-4 sm:px-6 py-5 border-b border-border flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-foreground tracking-tight">Results</h2>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">{fullResults.length.toLocaleString()} matching addresses</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => loadPageData(fullResults, currentPage - 1)}
                disabled={currentPage === 1 || isLoadingPage}
                className="h-7 w-7 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/10 disabled:opacity-30 transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <span className="px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                {currentPage} / {totalPages || 1}
              </span>
              <button
                onClick={() => loadPageData(fullResults, Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages || isLoadingPage}
                className="h-7 w-7 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/10 disabled:opacity-30 transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>

          {/* Table or Loading */}
          {isLoadingPage ? (
            <div className="py-12 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest animate-pulse">Loading volume data...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="px-4 sm:px-6 py-4 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 w-10 sm:w-16">#</th>
                    <th className="px-4 sm:px-6 py-4 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Address</th>
                    <th className="px-4 sm:px-6 py-4 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 text-right hidden sm:table-cell">All-Time Volume</th>
                    <th className="px-4 sm:px-6 py-4 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 text-right sm:hidden"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {paginatedResults.map((trader, i) => {
                    const isExpanded = expandedRow === trader.address;
                    return (
                      <React.Fragment key={i}>
                        <tr 
                          onClick={() => toggleRow(trader.address)}
                          className={cn(
                            "group hover:bg-secondary/5 transition-colors cursor-pointer sm:cursor-default",
                            isExpanded && "bg-secondary/5"
                          )}
                        >
                          <td className="px-4 sm:px-6 py-4">
                            <span className="text-[10px] sm:text-xs font-bold text-muted-foreground/30 tabular-nums">{(currentPage - 1) * ITEMS_PER_PAGE + i + 1}</span>
                          </td>
                          <td className="px-4 sm:px-6 py-4">
                            <span className="text-[10px] sm:text-xs font-mono text-muted-foreground/70 group-hover:text-foreground transition-colors truncate max-w-[200px] sm:max-w-none block">
                              {trader.address || 'N/A'}
                            </span>
                          </td>
                          <td className="px-4 sm:px-6 py-4 text-right hidden sm:table-cell">
                            <span className="text-xs font-bold text-foreground tabular-nums">
                              {trader.volume !== undefined
                                ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(trader.volume))
                                : <span className="text-muted-foreground/30">—</span>}
                            </span>
                          </td>
                          <td className="px-4 sm:px-6 py-4 text-right sm:hidden">
                            <svg className={cn("w-3 h-3 text-muted-foreground transition-transform", isExpanded && "rotate-180")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="sm:hidden bg-secondary/5 animate-in slide-in-from-top-1 duration-200">
                            <td colSpan={3} className="px-4 sm:px-6 py-4">
                              <div className="flex flex-col gap-1.5">
                                <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest">All-Time Volume</span>
                                <span className="text-[11px] font-bold text-primary tabular-nums">
                                  {trader.volume !== undefined
                                    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(trader.volume))
                                    : '—'}
                                </span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const { theme, toggleTheme, mounted } = useTheme()
  const [currentPage, setCurrentPage] = useState<'dex-status' | 'tracker' | 'portfolio' | 'leaderboard' | 'analyzer' | 'about' | 'whale-tracker' | 'assets' | 'journal' | 'demo-trading' | 'pulse' | 'funding' | 'export-history'>('dex-status')
  const [searchAddressInput, setSearchAddressInput] = useState('')
  const [trackerSearchAddress, setTrackerSearchAddress] = useState('')
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

  const navItems = [
    { id: 'dex-status', label: 'SoDex Status', icon: Activity },
    { id: 'tracker', label: 'Tracker', icon: TrendingUp },
    { id: 'portfolio', label: 'Portfolio', icon: Wallet },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
    { id: 'analyzer', label: 'Reverse Search', icon: Search },
    { id: 'assets', label: 'Assets', icon: Compass },
  ] as const;

  // Handle scroll for liquid design
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Handle tab parameter from URL - lazy load only when user navigates
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)

    return () => window.removeEventListener('resize', checkMobile)
  }, []);

  // Handle tab parameter from URL - lazy load only when user navigates
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const tabParam = searchParams.get('tab') as any;
    const addressParam = searchParams.get('address');

    // Set tracker search address if provided
    if (addressParam) {
      setTrackerSearchAddress(decodeURIComponent(addressParam));
    }

    if (tabParam && ['dex-status', 'tracker', 'portfolio', 'leaderboard', 'analyzer', 'about', 'whale-tracker', 'assets', 'demo-trading', 'pulse', 'funding', 'export-history'].includes(tabParam)) {

      setCurrentPage(tabParam);
    } else {
      // Default to dex-status on first load
      setCurrentPage('dex-status');
    }
  }, []);

  // Reset search when changing pages to prevent address persistence ("sticking")
  useEffect(() => {
    setTrackerSearchAddress('')
  }, [currentPage])

  // Reset scroll position when page changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [currentPage]);

  const handleSearchBarSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchAddressInput.trim()) {
      setTrackerSearchAddress(searchAddressInput)
      setCurrentPage('tracker')
      setSearchAddressInput('')
    }
  }

  return (
    <SidebarProvider>
      <div className={cn(
        "flex min-h-screen w-full transition-colors duration-500",
      )} style={{ background: 'var(--background)', fontFamily: 'var(--font-sans)' }}>
        {/* Sidebar Navigation */}
        <SidebarNav currentPage={currentPage} onNavigate={setCurrentPage} />

        {/* Main Content Area */}
        <SidebarInset className="flex-1 flex flex-col min-h-screen overflow-hidden relative transition-colors duration-500" style={{ background: 'var(--background)' }}>

          {/* Header */}
          <header
            className={cn(
              "sticky top-0 z-40 w-full transition-colors duration-150",
              isScrolled ? "py-2" : "py-3"
            )}
            style={{
              background: 'var(--background)',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div className="px-4 sm:px-6 flex items-center gap-3 max-w-full">

              {/* Mobile logo */}
              <div className="lg:hidden flex items-center gap-2 mr-1">
                <img
                  src={mounted && theme === 'dark'
                    ? "https://sodex.com/_next/image?url=%2Flogo%2Flogo.webp&w=256&q=75"
                    : "https://testnet.sodex.com/assets/SoDEX-Dh5Mk-Pl.svg"}
                  alt="SoDEX"
                  className="h-5 w-auto object-contain"
                />
              </div>

              {/* Search bar */}
              <div className="relative flex-1 max-w-sm">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
                  style={{ color: 'var(--muted-foreground)' }}
                />
                <input
                  type="text"
                  placeholder="Search wallet..."
                  value={searchAddressInput}
                  onChange={(e) => setSearchAddressInput(e.target.value)}
                  onKeyDown={handleSearchBarSubmit}
                  className="w-full pl-9 pr-4 py-2 text-sm focus:outline-none transition-colors duration-150"
                  style={{
                    background: 'var(--muted)',
                    border: '1px solid var(--border)',
                    color: 'var(--foreground)',
                    fontSize: '13px',
                    borderRadius: 'var(--radius-sm)',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--ring)'}
                  onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
                />
              </div>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Actions */}
              <div className="flex items-center gap-2">
                {/* Theme toggle — hidden on mobile (sidebar handles it there) */}
                {mounted && (
                  <button
                    onClick={toggleTheme}
                    className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200"
                    style={{ color: 'var(--muted-foreground)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--muted)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
                  >
                    {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                  </button>
                )}

                <a href="https://sodex.com/join/TRADING" target="_blank" rel="noopener noreferrer">
                  <button
                    className="flex items-center gap-1.5 px-3.5 py-2 text-[11px] font-bold uppercase tracking-widest transition-opacity duration-150"
                    style={{
                      background: 'var(--primary)',
                      color: 'var(--primary-foreground)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                  >
                    <span className="hidden sm:inline">Trade</span>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </button>
                </a>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto scroll-smooth relative z-10 p-3 sm:p-4 md:p-6 pb-24 lg:pb-6" style={{ maxWidth: '1600px', margin: '0 auto', width: '100%' }}>
            {/* Conditional Rendering of Tabs */}
            <div className="space-y-8 animate-in fade-in duration-500">
              {currentPage === 'dex-status' && (
                <Suspense fallback={<div className="w-full h-[60vh] flex items-center justify-center text-muted-foreground text-sm">Loading...</div>}>
                  <DexStatusDashboard onNavigate={setCurrentPage as (page: string) => void} />
                </Suspense>
              )}

              {currentPage === 'tracker' && (
                <Suspense fallback={<LoadingCard />}>
                  <TrackerSection initialSearchAddress={trackerSearchAddress} />
                </Suspense>
              )}

              {currentPage === 'portfolio' && (
                <Suspense fallback={<LoadingCard />}>
                  <PortfolioSection />
                </Suspense>
              )}

              {currentPage === 'leaderboard' && (
                <Suspense fallback={<LoadingCard />}>
                  <LeaderboardPage onBack={() => setCurrentPage('dex-status')} />
                </Suspense>
              )}

              {currentPage === 'analyzer' && (
                <Suspense fallback={<LoadingCard />}>
                  <DistributionAnalyzerPage onBack={() => setCurrentPage('dex-status')} />
                </Suspense>
              )}

              {currentPage === 'assets' && (
                <Suspense fallback={<AssetsSkeleton />}>
                  <div className="space-y-6">
                    <OverallDepositsCard />
                  </div>
                </Suspense>
              )}

              {currentPage === 'about' && (
                <Suspense fallback={<LoadingCard />}>
                  <AboutSodex />
                </Suspense>
              )}

              {currentPage === 'journal' && (
                <Suspense fallback={<LoadingCard />}>
                  <PortfolioProvider>
                    <JournalPageClient isDashboard />
                  </PortfolioProvider>
                </Suspense>
              )}

              {currentPage === 'demo-trading' && (
                <Suspense fallback={<LoadingCard />}>
                  <DemoTrading />
                </Suspense>
              )}

              {currentPage === 'pulse' && (
                <Suspense fallback={<LoadingCard />}>
                  <PulseDashboard />
                </Suspense>
              )}

              {currentPage === 'funding' && (
                <Suspense fallback={<LoadingCard />}>
                  <AccruedFunding initialSearchAddress={trackerSearchAddress} />
                </Suspense>
              )}

              {currentPage === 'export-history' && (
                <Suspense fallback={<LoadingCard />}>
                  <ExportTradeHistory />
                </Suspense>
              )}

            </div>

            {/* Mobile Footer — minimal */}
            <div className="md:hidden mt-16 pb-28 pt-6 flex flex-col items-center gap-3" style={{ borderTop: '1px solid var(--border)' }}>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-center leading-relaxed" style={{ color: 'var(--muted-foreground)', opacity: 0.3, maxWidth: 260 }}>
                Trading involves significant risk.<br/>SoDex Tracker is for informational purposes only.
              </p>
            </div>
          </main>
          
          {/* Global Announcement Overlays */}
          <AnnouncementSidePanel />
        </SidebarInset>
      </div>
      <MobileNavMenu currentPage={currentPage} onNavigate={setCurrentPage as any} />
    </SidebarProvider>
  )
}
// Deployment Nudge: 03/14/2026 17:42:03
// Final Sync: 03/14/2026 17:45:42
