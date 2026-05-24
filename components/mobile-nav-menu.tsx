'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronRight,
  Activity,
  Search,
  Wallet,
  Trophy,
  Zap,
  Info,
  Menu,
  X,
  TrendingUp,
  Compass,
  Shield,
  BookOpen,
  CandlestickChart,
  MessageSquare,
  Coins,
  FileText,
  Layers,
  Radio,
  Target,
  Signal
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/app/providers';

interface MobileNavMenuProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export function MobileNavMenu({ currentPage, onNavigate }: MobileNavMenuProps) {
  const { theme } = useTheme();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showRightHint, setShowRightHint] = useState(false);
  const [showLeftHint, setShowLeftHint] = useState(false);

  // Check scroll position to show/hide hints
  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftHint(scrollLeft > 10);
      setShowRightHint(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    const scrollArea = scrollRef.current;
    if (scrollArea) {
      scrollArea.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
    }
    return () => {
      if (scrollArea) {
        scrollArea.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      }
    };
  }, []);

  const navItems = [
    { section: 'Main Navigation', items: [
      { id: 'dex-status', label: 'SoDex Status', icon: Signal },
      { id: 'tracker', label: 'Tracker', icon: Target },
      { id: 'portfolio', label: 'Portfolio', icon: Wallet },
      { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
      { id: 'assets', label: 'Assets', icon: Layers },
      { id: 'pulse', label: 'Community Pulse', icon: Radio },
      { id: 'funding', label: 'Accrued Funding', icon: Coins },
      { id: 'export-history', label: 'Trade History', icon: FileText },
      { id: 'analyzer', label: 'Reverse Search', icon: Search },
    ]},
    { section: 'Beta', items: [
      { id: 'journal', label: 'Journal', icon: BookOpen },
      { id: 'demo-trading', label: 'Demo Trading', icon: CandlestickChart },
    ]}
  ];

  const handleNavClick = (pageId: string) => {
    onNavigate(pageId);
  };


  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[110] border-t bg-background/95 backdrop-blur-md">
      <div className="relative w-full overflow-hidden">
        {/* Left Scroll Hint */}
        <div className={cn(
          "absolute left-0 top-0 bottom-0 w-12 z-10 pointer-events-none transition-opacity duration-300 bg-gradient-to-r from-background to-transparent",
          showLeftHint ? "opacity-100" : "opacity-0"
        )} />

        <div 
          ref={scrollRef}
          className="flex items-center gap-7 px-8 py-4 overflow-x-auto no-scrollbar scroll-smooth relative"
        >
          {navItems.flatMap(group => group.items).map((item, idx) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={cn(
                  "flex flex-col items-center gap-1.5 min-w-fit transition-all duration-300",
                  "animate-in fade-in slide-in-from-right-4",
                  isActive 
                    ? "text-orange-500 scale-105" 
                    : "text-muted-foreground/40 hover:text-muted-foreground/80"
                )}
                style={{ animationDelay: `${idx * 40}ms`, animationFillMode: 'both' }}
              >
                <Icon className={cn("w-4 h-4", isActive ? "stroke-[2.5px]" : "stroke-[2px]")} />
                <span className="text-[8px] font-black uppercase tracking-[0.12em] whitespace-nowrap opacity-70">
                  {item.label === 'Community Pulse' ? 'Pulse' : 
                   item.label === 'Accrued Funding' ? 'Funding' : 
                   item.label === 'Reverse Search' ? 'Search' :
                   item.label === 'SoDex Status' ? 'Status' :
                   item.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right Scroll Hint */}
        <div className={cn(
          "absolute right-0 top-0 bottom-0 w-16 z-10 pointer-events-none transition-opacity duration-500 bg-gradient-to-l from-background via-background/60 to-transparent flex items-center justify-end pr-2",
          showRightHint ? "opacity-100" : "opacity-0"
        )}>
          <ChevronRight className="w-3 h-3 text-orange-500/50 animate-pulse" />
        </div>
      </div>
      {/* Bottom Safe Area for Mobile Browsers */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </div>
  );
}
