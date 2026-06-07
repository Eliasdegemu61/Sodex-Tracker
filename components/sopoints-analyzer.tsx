'use client';

import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Loader2, Calendar as CalendarIcon, Search, X, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { formatNumber } from '@/lib/format-number';
import { cn } from '@/lib/utils';
import React from 'react';

interface UserVolumeData {
  userId: string;
  address: string;
  futuresVolGained: number;
  spotVolGained: number;
  totalVolGained: number;
}

interface AnalysisState {
  hasFuturesData: boolean;
  hasSpotData: boolean;
}

export function SopointsAnalyzer() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<UserVolumeData[]>([]);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState<'total' | 'futures' | 'spot'>('total');
  const [analysisState, setAnalysisState] = useState<AnalysisState>({ hasFuturesData: false, hasSpotData: false });
  const [rowsPerPage, setRowsPerPage] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const validateDateRange = (start: string, end: string): boolean => {
    const startD = new Date(start);
    const endD = new Date(end);
    const diffTime = Math.abs(endD.getTime() - startD.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 7;
  };

  const getDateString = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const handleAnalyze = async () => {
    if (!startDate || !endDate) {
      setError('Please select both start and end dates');
      return;
    }
    if (startDate > endDate) {
      setError('Start date must be before end date');
      return;
    }
    if (!validateDateRange(startDate, endDate)) {
      setError('Date range must not exceed 7 days');
      return;
    }

    setIsLoading(true);
    setError('');
    setResults([]);
    setAnalysisState({ hasFuturesData: true, hasSpotData: true });

    try {
      const startD = new Date(startDate);
      const endD = new Date(endDate);
      const allDates: string[] = [];
      const currentDate = new Date(startD);
      while (currentDate <= endD) {
        allDates.push(getDateString(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }

      let futuresDataByDate: Record<string, any[]> = {};
      let hasFuturesData = false;
      for (const date of allDates) {
        try {
          const url = `https://raw.githubusercontent.com/Eliasdegemu61/Sodex-Tracker-new-v1/main/history/daily/${date}.json`;
          const res = await fetch(url);
          if (res.ok) { futuresDataByDate[date] = await res.json(); hasFuturesData = true; }
        } catch {}
      }

      let spotDataByDate: Record<string, Record<string, { total_volume: number }>> = {};
      let hasSpotData = false;
      for (const date of allDates) {
        try {
          const url = `https://raw.githubusercontent.com/Eliasdegemu61/sodex-spot-volume-data/refs/heads/main/daily_stats/${date}.json`;
          const res = await fetch(url);
          if (res.ok) { spotDataByDate[date] = await res.json(); hasSpotData = true; }
        } catch {}
      }

      setAnalysisState({ hasFuturesData, hasSpotData });

      if (!hasFuturesData && !hasSpotData) {
        setError('No data available for selected date range');
        setIsLoading(false);
        return;
      }

      const usersMap = new Map<string, UserVolumeData>();
      const userFirstLast = new Map<string, { firstFuturesDate: string | null; lastFuturesDate: string | null; firstSpotDate: string | null; lastSpotDate: string | null }>();

      if (hasFuturesData) {
        Object.entries(futuresDataByDate).forEach(([date, data]: [string, any]) => {
          data.forEach((entry: any) => {
            if (!userFirstLast.has(entry.address)) userFirstLast.set(entry.address, { firstFuturesDate: null, lastFuturesDate: null, firstSpotDate: null, lastSpotDate: null });
            const user = userFirstLast.get(entry.address)!;
            if (!user.firstFuturesDate) user.firstFuturesDate = date;
            user.lastFuturesDate = date;
          });
        });
      }

      if (hasSpotData) {
        Object.entries(spotDataByDate).forEach(([date, data]: [string, any]) => {
          Object.keys(data).forEach((address: string) => {
            if (!userFirstLast.has(address)) userFirstLast.set(address, { firstFuturesDate: null, lastFuturesDate: null, firstSpotDate: null, lastSpotDate: null });
            const user = userFirstLast.get(address)!;
            if (!user.firstSpotDate) user.firstSpotDate = date;
            user.lastSpotDate = date;
          });
        });
      }

      userFirstLast.forEach((dateRange, address) => {
        let futuresVolGained = 0;
        let spotVolGained = 0;
        if (dateRange.firstFuturesDate && dateRange.lastFuturesDate && hasFuturesData) {
          const firstEntry = futuresDataByDate[dateRange.firstFuturesDate].find((e: any) => e.address === address);
          const lastEntry = futuresDataByDate[dateRange.lastFuturesDate].find((e: any) => e.address === address);
          if (firstEntry && lastEntry) futuresVolGained = Math.max(0, (parseFloat(lastEntry.vol) || 0) - (parseFloat(firstEntry.vol) || 0));
        }
        if (dateRange.firstSpotDate && dateRange.lastSpotDate && hasSpotData) {
          const firstData = spotDataByDate[dateRange.firstSpotDate];
          const lastData = spotDataByDate[dateRange.lastSpotDate];
          if (firstData[address] && lastData[address]) spotVolGained = Math.max(0, (lastData[address].total_volume || 0) - (firstData[address].total_volume || 0));
        }
        const totalVolGained = futuresVolGained + spotVolGained;
        if (totalVolGained > 0) usersMap.set(address, { userId: '', address, futuresVolGained, spotVolGained, totalVolGained });
      });

      await new Promise(resolve => setTimeout(resolve, 0));
      const resultsArray = Array.from(usersMap.values());
      if (resultsArray.length === 0) {
        setError('No trading volume detected across all date combinations in the selected range');
        setIsLoading(false);
        return;
      }
      setResults([...resultsArray].sort((a, b) => b.totalVolGained - a.totalVolGained));
    } catch (err) {
      setError('Failed to analyze data. Please try again.');
    } finally {
      setIsLoading(false);
      setCurrentPage(1);
    }
  };

  const sortedResults = [...results].sort((a, b) => {
    if (sortBy === 'total') return b.totalVolGained - a.totalVolGained;
    if (sortBy === 'futures') return b.futuresVolGained - a.futuresVolGained;
    return b.spotVolGained - a.spotVolGained;
  });

  const filteredResults = sortedResults.filter(u => u.address.toLowerCase().includes(searchQuery.toLowerCase()));
  const totalPages = Math.ceil(filteredResults.length / rowsPerPage);
  const startIdx = (currentPage - 1) * rowsPerPage;
  const displayedRows = filteredResults.slice(startIdx, startIdx + rowsPerPage);
  const totalWeightedVolume = sortedResults.reduce((s, u) => s + u.futuresVolGained + u.spotVolGained * 2, 0);

  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

  const toggleRow = (address: string) => {
    setExpandedRow(expandedRow === address ? null : address);
  };

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  return (
    <div className="space-y-0 pb-16 animate-in fade-in duration-500">

      {/* Page Header */}
      <div className="pb-6 border-b border-border">
        <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground/50 mb-1">SoDex Tracker</p>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground" style={{ letterSpacing: '-0.04em' }}>Reverse Search</h1>
        <p className="mt-1 text-sm text-muted-foreground/60">Volume analysis · Max 7-day window</p>
      </div>

      {/* Controls */}
      <div className="mt-6 border border-border bg-card p-5 sm:p-6 space-y-5" style={{ borderRadius: 'var(--radius-md)' }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Start Date */}
          <div className="space-y-2">
            <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.18em]">Start Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <button className={cn(
                  "w-full flex items-center gap-2 h-10 px-3 border text-left transition-all text-sm",
                  startDate ? "border-border bg-muted/20 text-foreground" : "border-border text-muted-foreground hover:border-foreground/30"
                )} style={{ borderRadius: 'var(--radius-sm)' }}>
                  <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                  <span className="font-medium text-xs">{startDate ? formatDate(startDate) : 'Select date'}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 border border-border bg-card" style={{ borderRadius: 'var(--radius-md)' }}>
                <Calendar
                  mode="single"
                  selected={startDate ? new Date(startDate + 'T00:00:00') : undefined}
                  onSelect={(date) => { if (date) setStartDate(date.toLocaleDateString('en-CA')); }}
                  disabled={(date) => { const t = new Date(); t.setHours(0,0,0,0); return date > t; }}
                  className="border-none"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* End Date */}
          <div className="space-y-2">
            <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.18em]">End Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <button className={cn(
                  "w-full flex items-center gap-2 h-10 px-3 border text-left transition-all text-sm",
                  endDate ? "border-border bg-muted/20 text-foreground" : "border-border text-muted-foreground hover:border-foreground/30"
                )} style={{ borderRadius: 'var(--radius-sm)' }}>
                  <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                  <span className="font-medium text-xs">{endDate ? formatDate(endDate) : 'Select date'}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 border border-border bg-card" style={{ borderRadius: 'var(--radius-md)' }}>
                <Calendar
                  mode="single"
                  selected={endDate ? new Date(endDate + 'T00:00:00') : undefined}
                  onSelect={(date) => { if (date) setEndDate(date.toLocaleDateString('en-CA')); }}
                  disabled={(date) => { const t = new Date(); t.setHours(0,0,0,0); return date > t; }}
                  className="border-none"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {error && (
          <p className="text-[10px] font-bold text-destructive">{error}</p>
        )}

        <button
          onClick={handleAnalyze}
          disabled={isLoading || !startDate || !endDate}
          className="w-full h-10 bg-foreground text-background font-bold text-[11px] uppercase tracking-[0.2em] hover:opacity-80 transition-opacity disabled:opacity-25 flex items-center justify-center gap-2"
          style={{ borderRadius: 'var(--radius-sm)' }}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Analyzing...</span>
            </>
          ) : 'Analyze Volume'}
        </button>

        {isLoading && (
          <p className="text-[10px] text-muted-foreground/50 text-center uppercase tracking-widest animate-pulse">
            Fetching data across all dates… this may take a moment
          </p>
        )}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="mt-6 border border-border bg-card shadow-none overflow-hidden" style={{ borderRadius: 'var(--radius-md)' }}>

          {/* Results Header */}
          <div className="px-5 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-foreground tracking-tight">Results</h2>
              <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest mt-0.5">{filteredResults.length.toLocaleString()} addresses</p>
            </div>

            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search address..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="h-9 pl-9 pr-8 w-44 border border-border bg-muted/20 text-xs font-mono text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-foreground/30 transition-all"
                  style={{ borderRadius: 'var(--radius-sm)' }}
                />
                {searchQuery && (
                  <button onClick={() => { setSearchQuery(''); setCurrentPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2">
                    <X className="w-3.5 h-3.5 text-muted-foreground/40 hover:text-foreground" />
                  </button>
                )}
              </div>

              {/* Sort */}
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger className="h-9 w-32 text-xs border-border bg-transparent" style={{ borderRadius: 'var(--radius-sm)' }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="total">Total Vol</SelectItem>
                  <SelectItem value="futures">Futures Vol</SelectItem>
                  <SelectItem value="spot">Spot Vol</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Data Notice */}
          {(!analysisState.hasFuturesData || !analysisState.hasSpotData) && (
            <div className="px-5 py-2.5 border-b border-border bg-muted/10">
              <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">
                {!analysisState.hasFuturesData ? 'Spot data only for this range' : 'Futures data only for this range'}
              </p>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-3 text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground/40 w-10">#</th>
                  <th className="px-5 py-3 text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground/40">Address</th>
                  {analysisState.hasFuturesData && (
                    <th className="px-5 py-3 text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground/40 text-right hidden sm:table-cell">Futures</th>
                  )}
                  {analysisState.hasSpotData && (
                    <th className="px-5 py-3 text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground/40 text-right hidden sm:table-cell">Spot</th>
                  )}
                  <th className="px-5 py-3 text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground/40 text-right hidden sm:table-cell">Total Vol</th>
                  <th className="px-5 py-3 text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground/40 text-right hidden sm:table-cell">Est. SO</th>
                  <th className="px-5 py-3 text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground/40 text-right sm:hidden w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {searchQuery && filteredResults.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-xs text-muted-foreground/40">
                      No results for "{searchQuery}"
                    </td>
                  </tr>
                ) : displayedRows.map((user, idx) => {
                  const rank = startIdx + idx + 1;
                  const weightedVol = user.futuresVolGained + user.spotVolGained * 2;
                  const estimatedSoPoints = totalWeightedVolume > 0 ? (weightedVol / totalWeightedVolume) * 1_000_000 : 0;
                  const isExpanded = expandedRow === user.address;
                  const justCopied = copiedAddress === user.address;

                  return (
                    <React.Fragment key={user.address}>
                      <tr 
                        onClick={() => toggleRow(user.address)}
                        className={cn(
                          "group hover:bg-muted/10 transition-colors duration-150 cursor-pointer sm:cursor-default",
                          isExpanded && "bg-muted/10"
                        )}
                      >
                        <td className="px-5 py-3">
                          <span className={cn(
                            "text-[10px] font-bold tabular-nums",
                            rank === 1 ? "text-foreground" : rank <= 3 ? "text-foreground/60" : "text-muted-foreground/30"
                          )}>
                            {rank}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] sm:text-xs font-mono text-muted-foreground/60 truncate max-w-[160px] sm:max-w-xs block group-hover:text-foreground transition-colors">
                              {user.address}
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCopyAddress(user.address); }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Copy address"
                            >
                              {justCopied ? (
                                <Check className="w-3 h-3 text-[var(--success)]" />
                              ) : (
                                <Copy className="w-3 h-3 text-muted-foreground/40 hover:text-foreground" />
                              )}
                            </button>
                          </div>
                        </td>
                        {analysisState.hasFuturesData && (
                          <td className="px-5 py-3 text-[10px] sm:text-xs text-muted-foreground/60 text-right tabular-nums hidden sm:table-cell">
                            {formatNumber(user.futuresVolGained)}
                          </td>
                        )}
                        {analysisState.hasSpotData && (
                          <td className="px-5 py-3 text-[10px] sm:text-xs text-muted-foreground/60 text-right tabular-nums hidden sm:table-cell">
                            {formatNumber(user.spotVolGained)}
                          </td>
                        )}
                        <td className="px-5 py-3 text-[10px] sm:text-xs font-bold text-foreground text-right tabular-nums hidden sm:table-cell">
                          {formatNumber(user.totalVolGained)}
                        </td>
                        <td className="px-5 py-3 text-[10px] sm:text-xs text-muted-foreground/50 text-right tabular-nums hidden sm:table-cell">
                          {formatNumber(estimatedSoPoints)}
                        </td>
                        <td className="px-5 py-3 text-right sm:hidden">
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground/40" /> : <ChevronDown className="w-4 h-4 text-muted-foreground/40" />}
                        </td>
                      </tr>
                      {/* Mobile Expanded View */}
                      {isExpanded && (
                        <tr className="sm:hidden bg-muted/10 animate-in slide-in-from-top-1 duration-200">
                          <td colSpan={3} className="px-5 py-4">
                            <div className="grid grid-cols-2 gap-4 pb-2">
                              {analysisState.hasFuturesData && (
                                <div className="space-y-1">
                                  <p className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest">Futures Vol</p>
                                  <p className="text-xs font-bold text-foreground tabular-nums">{formatNumber(user.futuresVolGained)}</p>
                                </div>
                              )}
                              {analysisState.hasSpotData && (
                                <div className="space-y-1">
                                  <p className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest">Spot Vol</p>
                                  <p className="text-xs font-bold text-foreground tabular-nums">{formatNumber(user.spotVolGained)}</p>
                                </div>
                              )}
                              <div className="space-y-1">
                                <p className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest">Total Vol</p>
                                <p className="text-xs font-bold text-foreground tabular-nums">{formatNumber(user.totalVolGained)}</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest">Est. SO</p>
                                <p className="text-xs font-bold text-muted-foreground/60 tabular-nums">{formatNumber(estimatedSoPoints)}</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-5 py-3 border-t border-border flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Rows</span>
              <Select value={rowsPerPage.toString()} onValueChange={(v) => { setRowsPerPage(parseInt(v)); setCurrentPage(1); }}>
                <SelectTrigger className="h-7 w-16 text-xs border-border bg-transparent" style={{ borderRadius: 'var(--radius-sm)' }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="1000">1000</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest">
              {filteredResults.length === 0 ? 'No results' : `${startIdx + 1}–${Math.min(startIdx + rowsPerPage, filteredResults.length)} of ${filteredResults.length}`}
            </span>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="h-7 w-7 flex items-center justify-center border border-border text-muted-foreground hover:text-foreground hover:bg-muted/20 disabled:opacity-25 disabled:cursor-not-allowed transition-all"
                style={{ borderRadius: 'var(--radius-sm)' }}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                {currentPage} / {totalPages || 1}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                disabled={currentPage >= totalPages}
                className="h-7 w-7 flex items-center justify-center border border-border text-muted-foreground hover:text-foreground hover:bg-muted/20 disabled:opacity-25 disabled:cursor-not-allowed transition-all"
                style={{ borderRadius: 'var(--radius-sm)' }}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="px-5 py-2.5 border-t border-border/30">
            <p className="text-[9px] text-muted-foreground/30 uppercase tracking-widest font-medium">
              Est. SO Points is calculated from volume proportion — for estimation only, not official.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
