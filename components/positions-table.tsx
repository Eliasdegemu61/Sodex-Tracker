'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowUpRight, ArrowDownLeft, ChevronLeft, ChevronRight, ChevronDown, Loader2 } from 'lucide-react';
import { usePortfolio } from '@/context/portfolio-context';
import { useMemo, useState } from 'react';

export function PositionsTable() {
  const { positions, isHistoryLoading, hasMoreHistory, fetchProgress, handleContinue } = usePortfolio();
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const displayPositions = useMemo(() => {
    if (!positions || positions.length === 0) {
      return [];
    }

    return positions.map((position, idx) => {
      // Debug logging to check the actual values
      if (position.pairName === 'SILVER-USD') {
        console.log('[v0] SILVER-USD position:', {
          position_side: (position as any).position_side,
          positionSideLabel: position.positionSideLabel,
          pnl: position.realizedPnlValue,
        });
      }

      return {
        id: String(idx),
        pair: position.pairName,
        type: position.positionSideLabel === 'LONG' ? 'long' : 'short',
        entry: parseFloat(position.avg_entry_price),
        close: parseFloat(position.avg_close_price),
        size: position.closedSize,
        pnl: position.realizedPnlValue,
        pnlPercent: position.closedSize > 0 ? (position.realizedPnlValue / (parseFloat(position.avg_entry_price) * position.closedSize)) * 100 : 0,
        leverage: `${position.leverage}x`,
        marginMode: position.marginModeLabel,
        fee: position.tradingFee,
        createdAt: position.createdAtFormatted,
      };
    });
  }, [positions]);

  // Pagination logic
  const totalPages = Math.ceil(displayPositions.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedPositions = displayPositions.slice(startIndex, endIndex);

  // Reset to first page when rows per page changes
  const handleRowsPerPageChange = (newRows: number) => {
    setRowsPerPage(newRows);
    setCurrentPage(1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  if (!positions || positions.length === 0) {
    return (
      <Card className="rounded-[2rem] border border-black/8 bg-white p-6 text-foreground shadow-[0_20px_60px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-black dark:text-white dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <h3 className="mb-4 text-lg font-semibold tracking-[-0.03em] text-foreground">Position History</h3>
        <p className="text-sm text-muted-foreground">No position history available.</p>
      </Card>
    );
  }

  return (
    <Card className="rounded-[2rem] border border-black/8 bg-white p-3 sm:p-5 text-foreground shadow-[0_20px_60px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-black dark:text-white dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-[10px] font-bold text-black/35 dark:text-white/35 uppercase tracking-[0.22em]">
          Position history
        </h3>
        {(hasMoreHistory || isHistoryLoading) && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-black/30 dark:text-white/30">
              Showing recent {positions.length.toLocaleString()}
            </span>
            <Button
              onClick={handleContinue}
              disabled={isHistoryLoading || !fetchProgress.nextCursor}
              variant="outline"
              size="sm"
              className="h-8 rounded-xl px-3 text-[9px] font-semibold uppercase tracking-[0.16em]"
            >
              {isHistoryLoading ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Loading full history
                </>
              ) : (
                'Load 1K+ history'
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <style dangerouslySetInnerHTML={{ __html: `
          .no-scrollbar::-webkit-scrollbar { display: none; }
        `}} />
        <div className="no-scrollbar overflow-x-auto">
          <table className="w-full text-[11px] border-separate border-spacing-y-1.5">
            <thead>
              <tr className="text-black/35 dark:text-white/35 font-bold uppercase tracking-[0.18em]">
                <th className="text-left py-2 px-3">Pair</th>
                <th className="text-left py-2 px-3">Side</th>
                <th className="text-left py-2 px-3">Mode</th>
                <th className="text-right py-2 px-3">Entry</th>
                <th className="text-right py-2 px-3">Close</th>
                <th className="text-right py-2 px-3">Size</th>
                <th className="text-right py-2 px-3">Leverage</th>
                <th className="text-right py-2 px-3">Fee</th>
                <th className="text-right py-2 px-3">PnL</th>
                <th className="text-right py-2 px-3">%</th>
                <th className="text-left py-2 px-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {paginatedPositions.map((position) => (
                <tr key={position.id} className="group relative rounded-xl bg-black/[0.02] transition-all hover:bg-black/[0.04] dark:bg-white/[0.03] dark:hover:bg-white/[0.06]">
                  <td className="py-3 px-3 first:rounded-l-xl last:rounded-r-xl font-semibold text-foreground">{position.pair}</td>
                  <td className="py-3 px-3">
                      <span className={`rounded-md px-2 py-0.5 text-[9px] font-semibold tracking-[0.18em] ${position.type === 'long' ? 'bg-green-500/12 text-green-400' : 'bg-red-500/12 text-red-400'}`}>
                      {position.type.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="rounded bg-black/[0.04] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-black/45 dark:bg-white/[0.04] dark:text-white/45">
                      {position.marginMode}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right text-black/55 dark:text-white/55">${position.entry.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</td>
                  <td className="py-3 px-3 text-right font-semibold text-foreground">${position.close.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</td>
                  <td className="py-3 px-3 text-right text-black/55 dark:text-white/55">{position.size.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                  <td className="py-3 px-3 text-right font-semibold text-foreground">{position.leverage}</td>
                  <td className="py-3 px-3 text-right text-black/55 dark:text-white/55">${position.fee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                  <td className={`py-3 px-3 text-right font-semibold ${position.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {position.pnl >= 0 ? '+' : ''}${Math.abs(position.pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className={`flex items-center justify-end gap-1 font-semibold ${position.pnlPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {position.pnlPercent >= 0 ? '+' : ''}{position.pnlPercent.toFixed(2)}%
                    </div>
                  </td>
                  <td className="py-3 px-3 first:rounded-l-xl last:rounded-r-xl text-left text-[9px] text-black/35 dark:text-white/35">{position.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile List */}
      <div className="md:hidden space-y-3">
        {paginatedPositions.map((position) => (
          <div key={position.id} className="rounded-2xl border border-black/8 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{position.pair}</span>
                <span className={`rounded px-1.5 py-0.5 text-[8px] font-semibold tracking-[0.18em] ${position.type === 'long' ? 'bg-green-500/12 text-green-400' : 'bg-red-500/12 text-red-400'}`}>
                  {position.type.toUpperCase()}
                </span>
                <span className="rounded bg-black/[0.04] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.16em] text-black/45 dark:bg-white/[0.04] dark:text-white/45">
                  {position.marginMode}
                </span>
              </div>
              <span className={`font-semibold text-[13px] ${position.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {position.pnl >= 0 ? '+' : ''}${Math.abs(position.pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-y-3 gap-x-2 text-[10px]">
              <div className="flex flex-col">
                <span className="mb-0.5 text-[8px] font-semibold uppercase tracking-[0.16em] text-black/30 dark:text-white/30">Entry</span>
                <span className="text-black/55 dark:text-white/55">${position.entry.toFixed(2)}</span>
              </div>
              <div className="flex flex-col">
                <span className="mb-0.5 text-[8px] font-semibold uppercase tracking-[0.16em] text-black/30 dark:text-white/30">Close</span>
                <span className="text-black/55 dark:text-white/55">${position.close.toFixed(2)}</span>
              </div>
              <div className="flex flex-col">
                <span className="mb-0.5 text-[8px] font-semibold uppercase tracking-[0.16em] text-black/30 dark:text-white/30">Size</span>
                <span className="text-black/55 dark:text-white/55">{position.size.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
              </div>
              
              <div className="flex flex-col">
                <span className="mb-0.5 text-[8px] font-semibold uppercase tracking-[0.16em] text-black/30 dark:text-white/30">Lev.</span>
                <span className="text-black/55 dark:text-white/55">{position.leverage}</span>
              </div>
              <div className="flex flex-col">
                <span className="mb-0.5 text-[8px] font-semibold uppercase tracking-[0.16em] text-black/30 dark:text-white/30">Fee</span>
                <span className="text-black/55 dark:text-white/55">${position.fee.toFixed(2)}</span>
              </div>
              <div className="flex flex-col">
                <span className="mb-0.5 text-[8px] font-semibold uppercase tracking-[0.16em] text-black/30 dark:text-white/30">Return %</span>
                <span className={position.pnlPercent >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {position.pnlPercent >= 0 ? '+' : ''}{position.pnlPercent.toFixed(2)}%
                </span>
              </div>
            </div>
            
            <div className="mt-3 flex items-center justify-between border-t border-black/5 pt-2 text-[9px] text-black/35 dark:border-white/5 dark:text-white/35">
              <span>Closed</span>
              <span>{position.createdAt}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination Controls */}
      <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-black/8 pt-6 dark:border-white/8 sm:flex-row">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/30 dark:text-white/30">Show rows</span>
          <div className="flex gap-1 rounded-xl border border-black/8 bg-black/[0.03] p-1 dark:border-white/8 dark:bg-white/[0.03]">
            {[5, 10, 20, 50].map((value) => (
              <button
                key={value}
                onClick={() => handleRowsPerPageChange(value)}
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-semibold transition-all ${rowsPerPage === value
                  ? 'bg-white text-black'
                  : 'text-black/45 hover:bg-black/[0.06] hover:text-black dark:text-white/45 dark:hover:bg-white/[0.06] dark:hover:text-white'
                  }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePrevPage}
            disabled={currentPage === 1}
            className="flex items-center gap-1.5 rounded-full border border-black/10 bg-black/[0.03] px-4 py-2 text-[11px] font-semibold text-black/60 transition-all hover:bg-black/[0.07] hover:text-black disabled:cursor-not-allowed disabled:opacity-25 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/60 dark:hover:bg-white/[0.07] dark:hover:text-white"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Prev
          </button>

          <span className="min-w-[40px] text-center text-[11px] font-semibold text-black/35 dark:text-white/35">
            {currentPage} / {totalPages}
          </span>

          <button
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
            className="flex items-center gap-1.5 rounded-full border border-black/10 bg-black/[0.03] px-4 py-2 text-[11px] font-semibold text-black/60 transition-all hover:bg-black/[0.07] hover:text-black disabled:cursor-not-allowed disabled:opacity-25 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/60 dark:hover:bg-white/[0.07] dark:hover:text-white"
          >
            Next
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </Card>
  );
}
