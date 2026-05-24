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
  Signal
} from 'lucide-react'
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTheme } from '@/app/providers'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { Moon, Sun } from 'lucide-react'
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
} from '@/components/ui/sidebar'

interface SidebarNavProps {
  currentPage: string
  onNavigate: (page: any) => void
}

export function SidebarNav({ currentPage, onNavigate }: SidebarNavProps) {
  const [showDisclaimer, setShowDisclaimer] = useState(false);
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

  const { theme, toggleTheme } = useTheme()
  const logoUrl = theme === 'dark' 
    ? "https://sodex.com/_next/image?url=%2Flogo%2Flogo.webp&w=256&q=75"
    : "https://testnet.sodex.com/assets/SoDEX-Dh5Mk-Pl.svg"

  return (
    <Sidebar collapsible="none" className="hidden lg:flex sticky top-0 h-screen border-r border-border bg-background text-foreground">
      <SidebarHeader className="p-5">
        <div className="flex flex-col items-end w-fit gap-1">
          <img 
            src={logoUrl} 
            alt="SoDEX Logo" 
            className="h-9 w-auto object-contain" 
          />
          <h1 className="text-[10px] font-black tracking-[0.25em] text-foreground uppercase px-1 opacity-80">Tracker</h1>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="px-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {workspaceItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    onClick={() => onNavigate(item.id)}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-lg px-3 py-2 transition-all duration-200 !bg-transparent",
                      currentPage === item.id 
                        ? "text-orange-500 font-semibold" 
                        : "text-muted-foreground hover:bg-secondary/10 hover:text-foreground"
                    )}
                  >
                    <item.icon className={cn(
                      "h-4 w-4 transition-colors",
                      currentPage === item.id ? "text-orange-500" : "text-muted-foreground"
                    )} />
                    <span className="text-sm">{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className="px-3 text-[10px] font-bold text-muted-foreground/50">
            Beta
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {betaItems.map((item) => (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton 
                    onClick={() => item.id && onNavigate(item.id)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 transition-all duration-200 !bg-transparent",
                      item.id && currentPage === item.id 
                        ? "text-orange-500 font-semibold" 
                        : "text-muted-foreground hover:bg-secondary/10 hover:text-foreground"
                    )}
                  >
                    <item.icon className={cn(
                      "h-4 w-4 transition-colors",
                      item.id && currentPage === item.id ? "text-orange-500" : "text-muted-foreground"
                    )} />
                    <span className="text-sm">{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className="px-3 text-[10px] font-bold text-muted-foreground/50">
            Contact
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <a href="https://x.com/eliasing__" target="_blank" rel="noopener noreferrer" className="w-full">
                  <SidebarMenuButton className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all duration-200 hover:bg-secondary/10 hover:text-foreground">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.6l-5.165-6.756-5.868 6.756h-3.308l7.732-8.835L2.882 2.25h6.6l4.759 6.318L18.244 2.25zM17.55 19.5h1.832L6.281 3.75H4.38L17.55 19.5z" />
                    </svg>
                    <span className="text-sm">X</span>
                  </SidebarMenuButton>
                </a>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <a href="https://t.me/fallphile" target="_blank" rel="noopener noreferrer" className="w-full">
                  <SidebarMenuButton className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all duration-200 hover:bg-secondary/10 hover:text-foreground">
                    <Send className="h-4 w-4" />
                    <span className="text-sm">Telegram</span>
                  </SidebarMenuButton>
                </a>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={() => setShowDisclaimer(true)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all duration-200 hover:bg-secondary/10 hover:text-foreground"
                >
                  <HelpCircle className="h-4 w-4" />
                  <span className="text-sm">Disclaimer</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Disclaimer Dialog */}
      <Dialog open={showDisclaimer} onOpenChange={setShowDisclaimer}>
        <DialogContent className="max-w-2xl bg-card border border-border/50 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">Disclaimer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
            <p>
              This dashboard is an independent, community built analytics tool created for tracking on-chain activity related to SoDEX. It is not affiliated with, endorsed by, or operated by the SoDEX team. All data is provided for informational purposes only and should not be considered financial advice. Always verify transactions and contract addresses directly on the blockchain before making any decisions.
            </p>
            <div className="pt-4 border-t border-border/30 flex items-center justify-between">
              <span className="text-xs font-bold text-primary italic">- Elias (SoDex OG)</span>
              <span className="text-[10px] text-muted-foreground/30">v3.0.0</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Sidebar>
  )
}
