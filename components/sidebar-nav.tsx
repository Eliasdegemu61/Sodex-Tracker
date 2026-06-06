'use client'

import React from 'react'
import {
  Activity,
  TrendingUp,
  Wallet,
  Trophy,
  Zap,
  Compass,
  ChevronDown,
  LayoutDashboard,
  Search,
  Settings,
  HelpCircle,
  FileText,
  User,
  Send,
  BookOpen,
  CandlestickChart,
  MessageSquare,
  Coins,
  Layers,
  Radio,
  Target,
  Signal,
  ExternalLink,
  Moon,
  Sun,
} from 'lucide-react'
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useTheme } from '@/app/providers'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '@/components/ui/sidebar'

interface SidebarNavProps {
  currentPage: string
  onNavigate: (page: any) => void
}

const XIcon = () => (
  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.6l-5.165-6.756-5.868 6.756H1.851l7.732-8.835L1.254 2.25H8.08l4.713 6.231L18.244 2.25zM17.088 19.77h1.833L6.915 4.126H4.95L17.088 19.77z" />
  </svg>
)

const TelegramIcon = () => (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m22 2-7 20-4-9-9-4Z" />
    <path d="M22 2 11 13" />
  </svg>
)

export function SidebarNav({ currentPage, onNavigate }: SidebarNavProps) {
  const [showDisclaimer, setShowDisclaimer] = useState(false)
  const { theme, toggleTheme } = useTheme()

  const workspaceItems = [
    { id: 'dex-status', label: 'SoDex Status', icon: Signal },
    { id: 'tracker', label: 'Tracker', icon: Target },
    { id: 'portfolio', label: 'Portfolio', icon: Wallet },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
    { id: 'analyzer', label: 'Reverse Search', icon: Search },
    { id: 'assets', label: 'Assets', icon: Layers },
    { id: 'pulse', label: 'Community Pulse', icon: Radio },
    { id: 'funding', label: 'Accrued Funding', icon: Coins },
    { id: 'export-history', label: 'Trade History', icon: FileText },
  ]

  const betaItems = [
    { id: 'journal', label: 'Journal', icon: BookOpen },
    { id: 'demo-trading', label: 'Demo Trading', icon: CandlestickChart },
  ]

  const logoUrl = theme === 'dark'
    ? "https://sodex.com/_next/image?url=%2Flogo%2Flogo.webp&w=256&q=75"
    : "https://testnet.sodex.com/assets/SoDEX-Dh5Mk-Pl.svg"

  return (
    <Sidebar
      collapsible="none"
      className="hidden lg:flex sticky top-0 h-screen border-r bg-[var(--sidebar)] text-[var(--sidebar-foreground)]"
      style={{ borderColor: 'var(--sidebar-border)' }}
    >
      {/* Header */}
      <SidebarHeader className="px-5 py-5 border-b" style={{ borderColor: 'var(--sidebar-border)' }}>
        <div className="flex items-center gap-2.5">
          <img
            src={logoUrl}
            alt="SoDEX Logo"
            className="h-6 w-auto object-contain"
          />
          <span
            className="text-[10px] font-bold tracking-[0.25em] uppercase"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Tracker
          </span>
          {/* Live dot */}
          <div className="ml-auto">
            <span
              className="relative flex h-1.5 w-1.5"
              title="Live data"
            >
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50" style={{ background: 'var(--success)' }} />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: 'var(--success)' }} />
            </span>
          </div>
        </div>
      </SidebarHeader>

      {/* Main Nav */}
      <SidebarContent className="px-2 py-3 flex-1 overflow-y-auto no-scrollbar">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {workspaceItems.map((item) => {
                const isActive = currentPage === item.id
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      onClick={() => onNavigate(item.id)}
                      className={cn(
                        "group relative flex items-center gap-3 w-full px-3 py-2 rounded-none transition-colors duration-150 !bg-transparent text-left",
                        isActive
                          ? "bg-[var(--sidebar-accent)]"
                          : "hover:bg-[var(--sidebar-accent)]",
                        isActive
                          ? "text-[var(--sidebar-foreground)]"
                          : "text-[var(--muted-foreground)] hover:text-[var(--sidebar-foreground)]"
                      )}
                    >
                      {/* Active left bar */}
                      <span
                        className={cn(
                          "absolute left-0 top-0 bottom-0 w-[2px] transition-all duration-150",
                          isActive ? "opacity-100" : "opacity-0"
                        )}
                        style={{ background: 'var(--sidebar-foreground)' }}
                      />

                      {/* Icon */}
                      <item.icon
                        className={cn(
                          "h-[15px] w-[15px] flex-shrink-0 transition-colors duration-150",
                          isActive ? "opacity-100" : "opacity-40 group-hover:opacity-70"
                        )}
                      />

                      {/* Label */}
                      <span
                        className={cn(
                          "text-[13px] leading-none",
                          isActive ? "font-semibold" : "font-medium"
                        )}
                      >
                        {item.label}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Beta section */}
        <SidebarGroup className="mt-5">
          <SidebarGroupLabel
            className="px-3 mb-1 micro-label"
            style={{ color: 'var(--muted-foreground)', opacity: 0.4 }}
          >
            Beta
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {betaItems.map((item) => {
                const isActive = item.id && currentPage === item.id
                return (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton
                      onClick={() => item.id && onNavigate(item.id)}
                      className={cn(
                        "group relative flex items-center gap-3 w-full px-3 py-2 rounded-none transition-colors duration-150 !bg-transparent",
                        isActive
                          ? "bg-[var(--sidebar-accent)]"
                          : "hover:bg-[var(--sidebar-accent)]",
                        isActive
                          ? "text-[var(--sidebar-foreground)]"
                          : "text-[var(--muted-foreground)] hover:text-[var(--sidebar-foreground)]"
                      )}
                    >
                      <span
                        className={cn(
                          "absolute left-0 top-0 bottom-0 w-[2px] transition-all duration-150",
                          isActive ? "opacity-100" : "opacity-0"
                        )}
                        style={{ background: 'var(--sidebar-foreground)' }}
                      />
                      <item.icon
                        className={cn(
                          "h-[15px] w-[15px] flex-shrink-0 transition-colors",
                          isActive ? "opacity-100" : "opacity-40 group-hover:opacity-70"
                        )}
                      />
                      <span className={cn("text-[13px] leading-none font-medium")}>
                        {item.label}
                      </span>
                      <span
                        className="ml-auto text-[8px] font-bold tracking-wider uppercase border px-1.5 py-0.5"
                        style={{
                          borderColor: 'var(--border)',
                          color: 'var(--muted-foreground)',
                        }}
                      >
                        Beta
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter
        className="p-4 border-t space-y-3"
        style={{ borderColor: 'var(--sidebar-border)' }}
      >
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-none transition-colors duration-150 group"
          style={{ color: 'var(--muted-foreground)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--sidebar-accent)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4 opacity-50 group-hover:opacity-80 transition-opacity" />
          ) : (
            <Moon className="h-4 w-4 opacity-50 group-hover:opacity-80 transition-opacity" />
          )}
          <span className="text-[13px] font-medium">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
        </button>

        {/* Contact links */}
        <div className="flex items-center gap-1">
          <a
            href="https://x.com/eliasing__"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 flex-1 px-3 py-2 rounded-none text-[13px] font-medium transition-colors duration-150 group"
            style={{ color: 'var(--muted-foreground)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-accent)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          >
            <XIcon />
            <span className="group-hover:opacity-100 opacity-70 transition-opacity">X</span>
          </a>
          <a
            href="https://t.me/fallphile"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 flex-1 px-3 py-2 rounded-none text-[13px] font-medium transition-colors duration-150 group"
            style={{ color: 'var(--muted-foreground)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-accent)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          >
            <TelegramIcon />
            <span className="group-hover:opacity-100 opacity-70 transition-opacity">Telegram</span>
          </a>
        </div>

        {/* Disclaimer */}
        <button
          onClick={() => setShowDisclaimer(true)}
          className="flex items-center gap-2 w-full px-3 py-1.5 rounded-none text-[11px] transition-colors duration-150"
          style={{ color: 'var(--muted-foreground)', opacity: 0.4 }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.8'; e.currentTarget.style.background = 'var(--sidebar-accent)'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '0.4'; e.currentTarget.style.background = 'transparent'; }}
        >
          <HelpCircle className="h-3.5 w-3.5" />
          <span className="font-medium">Disclaimer · v3.0.0</span>
        </button>
      </SidebarFooter>

      {/* Disclaimer Dialog */}
      <Dialog open={showDisclaimer} onOpenChange={setShowDisclaimer}>
        <DialogContent className="max-w-lg rounded-md border" style={{ background: 'var(--popover)', borderColor: 'var(--border)' }}>
          <DialogHeader>
            <DialogTitle className="text-base font-bold" style={{ color: 'var(--foreground)' }}>Disclaimer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
            <p>
              This dashboard is an independent, community-built analytics tool created for tracking on-chain activity related to SoDEX. It is not affiliated with, endorsed by, or operated by the SoDEX team. All data is for informational purposes only and should not be considered financial advice.
            </p>
            <div
              className="pt-4 border-t flex items-center justify-between"
              style={{ borderColor: 'var(--border)' }}
            >
              <span className="text-xs font-bold italic" style={{ color: 'var(--primary)' }}>— Elias (SoDex OG)</span>
              <span className="text-[10px]" style={{ opacity: 0.3 }}>v3.0.0</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Sidebar>
  )
}
