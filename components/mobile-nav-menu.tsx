'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Search,
  Wallet,
  Trophy,
  FileText,
  Layers,
  Radio,
  Coins,
  Target,
  Signal,
  BookOpen,
  CandlestickChart,
  MoreHorizontal,
  X,
  Moon,
  Sun,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/app/providers';

interface MobileNavMenuProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const primaryNav = [
  { id: 'dex-status', label: 'Status', icon: Signal },
  { id: 'tracker', label: 'Tracker', icon: Target },
  { id: 'portfolio', label: 'Portfolio', icon: Wallet },
  { id: 'leaderboard', label: 'Board', icon: Trophy },
];

const allNav = [
  { id: 'dex-status', label: 'SoDex Status', icon: Signal },
  { id: 'tracker', label: 'Tracker', icon: Target },
  { id: 'portfolio', label: 'Portfolio', icon: Wallet },
  { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  { id: 'assets', label: 'Assets', icon: Layers },
  { id: 'pulse', label: 'Community Pulse', icon: Radio },
  { id: 'funding', label: 'Accrued Funding', icon: Coins },
  { id: 'export-history', label: 'Trade History', icon: FileText },
  { id: 'analyzer', label: 'Reverse Search', icon: Search },
  { id: 'journal', label: 'Journal', icon: BookOpen },
  { id: 'demo-trading', label: 'Demo Trading', icon: CandlestickChart },
];

export function MobileNavMenu({ currentPage, onNavigate }: MobileNavMenuProps) {
  const { theme, toggleTheme } = useTheme();
  const [moreOpen, setMoreOpen] = useState(false);

  const isPrimary = primaryNav.some(i => i.id === currentPage);
  const isMore = !isPrimary;

  const handleNav = (id: string) => {
    onNavigate(id);
    setMoreOpen(false);
  };

  return (
    <>
      {/* More drawer overlay */}
      {moreOpen && (
        <div
          className="lg:hidden fixed inset-0 z-[100]"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setMoreOpen(false)}
        />
      )}

      {/* More drawer */}
      <div
        className={cn(
          "lg:hidden fixed bottom-[72px] left-0 right-0 z-[105] border-t p-4 transition-all duration-200",
          moreOpen
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 translate-y-2 pointer-events-none"
        )}
        style={{
          background: 'var(--background)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <span
            className="text-[9px] font-black tracking-[0.2em] uppercase"
            style={{ color: 'var(--muted-foreground)' }}
          >
            All Pages
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="w-6 h-6 rounded-full flex items-center justify-center"
              style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
              title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
            >
              {theme === 'dark' ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
            </button>
            <button
              onClick={() => setMoreOpen(false)}
              className="w-6 h-6 rounded-full flex items-center justify-center"
              style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {allNav.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={cn(
                  "flex flex-col items-center gap-2 p-3 transition-colors duration-150 text-center",
                )}
                style={{
                  background: isActive ? 'var(--muted)' : 'transparent',
                  color: isActive ? 'var(--foreground)' : 'var(--muted-foreground)',
                  border: `1px solid ${isActive ? 'var(--border-strong)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[9px] font-bold tracking-wide leading-tight">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom nav bar */}
      <div
        className="lg:hidden fixed bottom-0 left-0 right-0 z-[110]"
      >
        <div
          className="flex items-center justify-around px-2 py-2 border-t"
          style={{
            background: 'var(--background)',
            borderColor: 'var(--border)',
          }}
        >
          {primaryNav.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className="relative flex flex-col items-center gap-1 px-4 py-2 transition-colors duration-150 flex-1"
                style={{
                  color: isActive ? 'var(--foreground)' : 'var(--muted-foreground)',
                }}
              >
                <Icon className={cn("w-4 h-4 transition-opacity", isActive ? "opacity-100" : "opacity-40")} />
                <span
                  className="text-[8px] font-bold tracking-wide"
                  style={{ opacity: isActive ? 1 : 0.5 }}
                >
                  {item.label}
                </span>
              </button>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className="flex flex-col items-center gap-1 px-4 py-2 transition-colors duration-150 flex-1"
            style={{
              color: (moreOpen || isMore) ? 'var(--foreground)' : 'var(--muted-foreground)',
            }}
          >
            <MoreHorizontal className={cn("w-4 h-4 transition-opacity", (moreOpen || isMore) ? "opacity-100" : "opacity-40")} />
            <span
              className="text-[8px] font-bold tracking-wide"
              style={{ opacity: (moreOpen || isMore) ? 1 : 0.5 }}
            >
              More
            </span>
          </button>
        </div>

        <div className="h-[env(safe-area-inset-bottom)] bg-[var(--background)]" />
      </div>
    </>
  );
}
