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
      <div className="border border-border bg-card" style={{ borderRadius: 'var(--radius-md)' }}>
        <div className="px-4 py-3 border-b border-border">
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Position History</span>
        </div>
        <div className="flex items-center justify-center p-8">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40">No position history available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-border bg-card text-foreground overflow-hidden" style={{ borderRadius: 'var(--radius-md)' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Position History</span>
        {(hasMoreHistory || isHistoryLoading) && (
          <div className="flex items-center gap-3">
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">
              {positions.length.toLocaleString()} records
            </span>
            <button
              onClick={handleContinue}
              disabled={isHistoryLoading || !fetchProgress.nextCursor}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest border border-border text-muted-foreground hover:text-foreground hover:border-foreground disabled:opacity-30 transition-colors"
              style={{ borderRadius: 'var(--radius-sm)' }}
            >
              {isHistoryLoading ? <><Loader2 className="h-3 w-3 animate-spin" /> Loading</> : 'Load More'}
            </button>
          </div>
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-[10px] text-left">
          <thead>
            <tr className="border-b border-border">
              {['Pair','Side','Mode','Entry','Close','Size','Lev.','Fee','PnL','%','Date'].map((h,i) => (
                <th key={h} className={`py-2.5 px-3 text-[8px] font-bold uppercase tracking-[0.18em] text-muted-foreground ${i > 2 && i < 10 ? 'text-right' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paginatedPositions.map((position) => (
              <tr key={position.id} className="hover:bg-muted/20 transition-colors">
                <td className="py-3 px-3 font-bold text-foreground">{position.pair}</td>
                <td className="py-3 px-3">
                  <span className={`text-[9px] font-bold tracking-widest ${position.type === 'long' ? 'text-[var(--success)]' : 'text-destructive'}`}>
                    {position.type.toUpperCase()}
                  </span>
                </td>
                <td className="py-3 px-3">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{position.marginMode}</span>
                </td>
                <td className="py-3 px-3 text-right text-muted-foreground">${position.entry.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</td>
                <td className="py-3 px-3 text-right font-bold text-foreground">${position.close.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</td>
                <td className="py-3 px-3 text-right text-muted-foreground">{position.size.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                <td className="py-3 px-3 text-right font-bold text-foreground">{position.leverage}</td>
                <td className="py-3 px-3 text-right text-muted-foreground">${position.fee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                <td className={`py-3 px-3 text-right font-bold ${position.pnl >= 0 ? 'text-[var(--success)]' : 'text-destructive'}`}>
                  {position.pnl >= 0 ? '+' : ''}${Math.abs(position.pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                </td>
                <td className={`py-3 px-3 text-right font-bold ${position.pnlPercent >= 0 ? 'text-[var(--success)]' : 'text-destructive'}`}>
                  {position.pnlPercent >= 0 ? '+' : ''}{position.pnlPercent.toFixed(2)}%
                </td>
                <td className="py-3 px-3 text-left text-[9px] text-muted-foreground/50">{position.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile List */}
      <div className="md:hidden divide-y divide-border">
        {paginatedPositions.map((position) => (
          <div key={position.id} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-foreground">{position.pair}</span>
                <span className={`text-[8px] font-bold tracking-widest ${position.type === 'long' ? 'text-[var(--success)]' : 'text-destructive'}`}>
                  {position.type.toUpperCase()}
                </span>
                <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/50">{position.marginMode}</span>
              </div>
              <span className={`font-bold text-sm ${position.pnl >= 0 ? 'text-[var(--success)]' : 'text-destructive'}`}>
                {position.pnl >= 0 ? '+' : ''}${Math.abs(position.pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-y-2.5 gap-x-2">
              {[['Entry', `$${position.entry.toFixed(2)}`], ['Close', `$${position.close.toFixed(2)}`], ['Size', position.size.toLocaleString(undefined,{maximumFractionDigits:4})], ['Lev.', position.leverage], ['Fee', `$${position.fee.toFixed(2)}`], ['Return', `${position.pnlPercent >= 0 ? '+' : ''}${position.pnlPercent.toFixed(2)}%`]].map(([label, val]) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/50">{label}</span>
                  <span className="text-[11px] font-bold text-muted-foreground">{val}</span>
                </div>
              ))}
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-border flex justify-between text-[9px] text-muted-foreground/40 font-bold uppercase tracking-widest">
              <span>Closed</span><span>{position.createdAt}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
        <div className="flex items-center gap-1">
          {[5, 10, 20, 50].map((value) => (
            <button
              key={value}
              onClick={() => handleRowsPerPageChange(value)}
              className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest border transition-colors ${rowsPerPage === value
                ? 'border-foreground bg-foreground text-background'
                : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
                }`}
              style={{ borderRadius: 'var(--radius-sm)' }}
            >
              {value}
            </button>
          ))}
        </div>
        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">{currentPage} / {totalPages}</span>
        <div className="flex gap-1">
          <button onClick={handlePrevPage} disabled={currentPage === 1} className="p-1.5 border border-border text-muted-foreground hover:text-foreground hover:border-foreground disabled:opacity-25 transition-colors" style={{ borderRadius: 'var(--radius-sm)' }}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button onClick={handleNextPage} disabled={currentPage === totalPages} className="p-1.5 border border-border text-muted-foreground hover:text-foreground hover:border-foreground disabled:opacity-25 transition-colors" style={{ borderRadius: 'var(--radius-sm)' }}>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
