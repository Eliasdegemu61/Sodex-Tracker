'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowDown, ArrowUp, Loader2, ExternalLink, ChevronLeft, ChevronRight, ChevronDown, AlertCircle } from 'lucide-react';

interface FundFlowData {
  account: string;
  amount: string;
  chain: string;
  coin: string;
  decimals: number;
  status: string;
  statusTime: number;
  type: 'CustodyDeposit' | 'CustodyWithdraw' | string;
  token: string;
  txHash: string;
  receiver?: string;
  sender?: string;
}

interface FundFlowTableProps {
  walletAddress: string;
}

export function FundFlowTable({ walletAddress }: FundFlowTableProps) {
  const [flows, setFlows] = useState<FundFlowData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'deposit' | 'withdraw'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showingTxHash, setShowingTxHash] = useState<string | null>(null);
  const [tokenPrices, setTokenPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!walletAddress) return;
    fetchFundFlow();
  }, [walletAddress]);

  const fetchFundFlow = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/wallet/fund-flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: walletAddress }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch fund flow data');
      }

      const data = await response.json();

      if (data.code === '0' && data.data?.accountFlows) {
        const fetchedFlows = data.data.accountFlows;
        setFlows(fetchedFlows);

        // Fetch USD prices for accurate netflow calculations
        const uniqueTokens = Array.from(new Set(fetchedFlows.map((f: FundFlowData) => f.coin)));
        import('@/lib/token-price-service').then(({ getTokenPrices }) => {
          getTokenPrices(uniqueTokens as string[]).then(prices => {
            setTokenPrices(prices);
          });
        });
      } else {
        throw new Error(data.message || 'No fund flow data found');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load fund flow';
      setError(errorMessage);
      setFlows([]);
    } finally {
      setIsLoading(false);
    }
  };

  const isDeposit = (type: string) => type.includes('Deposit');
  const isWithdraw = (type: string) => type.includes('Withdraw');

  const displayFlows = useMemo(() => {
    return flows.filter(flow => {
      if (filterType === 'deposit') return isDeposit(flow.type);
      if (filterType === 'withdraw') return isWithdraw(flow.type);
      return true;
    });
  }, [flows, filterType]);

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

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

  // Pagination logic
  const totalPages = Math.ceil(displayFlows.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedFlows = displayFlows.slice(startIndex, endIndex);

  const formatAmount = (amount: string, decimals: number) => {
    const num = parseFloat(amount) / Math.pow(10, decimals);
    return num.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  };

  // Calculate netflow stats
  const netflowStats = useMemo(() => {
    const deposits = flows
      .filter(f => isDeposit(f.type))
      .reduce((sum, f) => {
        const amount = parseFloat(f.amount) / Math.pow(10, f.decimals);
        const price = tokenPrices[f.coin] || (f.coin.toUpperCase().includes('USD') ? 1 : 0);
        return sum + (amount * price);
      }, 0);

    const withdrawals = flows
      .filter(f => isWithdraw(f.type))
      .reduce((sum, f) => {
        const amount = parseFloat(f.amount) / Math.pow(10, f.decimals);
        const price = tokenPrices[f.coin] || (f.coin.toUpperCase().includes('USD') ? 1 : 0);
        return sum + (amount * price);
      }, 0);

    const netflow = deposits - withdrawals;

    return { deposits, withdrawals, netflow };
  }, [flows, tokenPrices]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const copyToClipboard = (hash: string) => {
    navigator.clipboard.writeText(hash);
  };

  const getStatusColor = (status: string) => {
    if (status === 'Success') {
      return 'bg-emerald-900/50 text-emerald-300';
    }
    return 'bg-amber-900/50 text-amber-300';
  };

  const getExplorerUrl = (txHash: string, chain: string) => {
    const chainMap: { [key: string]: string } = {
      // EVM Chains
      'ARB': 'https://arbiscan.io/tx/',
      'ARBITRUM': 'https://arbiscan.io/tx/',
      'ETH': 'https://etherscan.io/tx/',
      'ETHEREUM': 'https://etherscan.io/tx/',
      'POLYGON': 'https://polygonscan.com/tx/',
      'POLY': 'https://polygonscan.com/tx/',
      'OPTIMISM': 'https://optimistic.etherscan.io/tx/',
      'OPT': 'https://optimistic.etherscan.io/tx/',
      'BASE': 'https://basescan.org/tx/',
      'AVAX': 'https://snowtrace.io/tx/',
      'AVAXC': 'https://snowtrace.io/tx/',
      'AVALANCHE': 'https://snowtrace.io/tx/',
      'BSC': 'https://bscscan.com/tx/',
      'BSCSCAN': 'https://bscscan.com/tx/',
      'BINANCE': 'https://bscscan.com/tx/',
      'HYPERLIQUID': 'https://explorer.hyperliquid.xyz/tx/',
      'HYPE': 'https://explorer.hyperliquid.xyz/tx/',
      // Non-EVM Chains
      'SOLANA': 'https://solscan.io/tx/',
      'SOL': 'https://solscan.io/tx/',
      'SUI': 'https://suiscan.xyz/tx/',
      'TON': 'https://tonscan.org/tx/',
      'XLM': 'https://stellar.expert/explorer/public/tx/',
      'STELLAR': 'https://stellar.expert/explorer/public/tx/',
      'LTC': 'https://blockchair.com/litecoin/transaction/',
      'LITECOIN': 'https://blockchair.com/litecoin/transaction/',
      'BTC': 'https://www.blockchain.com/btc/tx/',
      'BITCOIN': 'https://www.blockchain.com/btc/tx/',
      'XRP': 'https://xrpscan.com/tx/',
      'RIPPLE': 'https://xrpscan.com/tx/',
      'DOGE': 'https://blockchair.com/dogecoin/transaction/',
      'DOGECOIN': 'https://blockchair.com/dogecoin/transaction/',
    };

    // Extract the chain name, handling formats like "BASE_ETH", "ARB_ETH", etc.
    const chainParts = chain.split('_');
    const chainName = chainParts[0].toUpperCase();

    const baseUrl = chainMap[chainName] || chainMap['ARB'];
    return `${baseUrl}${txHash}`;
  };

  if (isLoading) {
    return (
      <div className="border border-border bg-card" style={{ borderRadius: 'var(--radius-md)' }}>
        <div className="px-4 py-3 border-b border-border">
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Fund Flow</span>
        </div>
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-destructive/30 bg-card" style={{ borderRadius: 'var(--radius-md)' }}>
        <div className="px-4 py-3 border-b border-border">
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Fund Flow</span>
        </div>
        <div className="flex flex-col items-center gap-3 p-8">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-destructive">{error}</p>
          <button onClick={fetchFundFlow} className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest border border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-colors" style={{ borderRadius: 'var(--radius-sm)' }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (flows.length === 0) {
    return (
      <div className="border border-border bg-card" style={{ borderRadius: 'var(--radius-md)' }}>
        <div className="px-4 py-3 border-b border-border">
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Fund Flow</span>
        </div>
        <div className="flex items-center justify-center p-8">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40">No transfers detected</p>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-border bg-card text-foreground overflow-hidden" style={{ borderRadius: 'var(--radius-md)' }}>
      {/* Header + netflow strip */}
      <div className="border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Fund Flow</span>
        </div>
        <div className="grid grid-cols-3 divide-x divide-border border-t border-border">
          {[
            { label: 'Inflow', value: `$${netflowStats.deposits.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, tone: 'text-[var(--success)]' },
            { label: 'Outflow', value: `$${netflowStats.withdrawals.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, tone: 'text-destructive' },
            { label: 'Net', value: `${netflowStats.netflow >= 0 ? '+' : ''}$${netflowStats.netflow.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, tone: netflowStats.netflow >= 0 ? 'text-[var(--success)]' : 'text-destructive' },
          ].map((s) => (
            <div key={s.label} className="flex flex-col gap-1.5 p-3">
              <span className="text-[8px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{s.label}</span>
              <span className={`text-sm font-bold tracking-tight ${s.tone}`}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="flex items-center gap-1 px-4 py-3 border-b border-border">
        {[
          { id: 'all', label: 'All' },
          { id: 'deposit', label: 'Deposits' },
          { id: 'withdraw', label: 'Withdrawals' }
        ].map((type) => (
          <button
            key={type.id}
            onClick={() => { setFilterType(type.id as any); setCurrentPage(1); }}
            className={`px-3 py-1 text-[9px] font-bold uppercase tracking-widest border transition-colors ${
              filterType === type.id
                ? 'border-foreground bg-foreground text-background'
                : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
            }`}
            style={{ borderRadius: 'var(--radius-sm)' }}
          >
            {type.label}
          </button>
        ))}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-[10px] text-left">
          <thead>
            <tr className="border-b border-border">
              {['Type','Asset','Amount','Network','Timestamp'].map((h, i) => (
                <th key={h} className={`py-2.5 px-3 text-[8px] font-bold uppercase tracking-[0.18em] text-muted-foreground ${i === 2 ? 'text-right' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paginatedFlows.map((flow, idx) => (
              <tr key={`${startIndex}-${idx}`} className="hover:bg-muted/20 transition-colors">
                <td className="py-3 px-3">
                  <div className="flex items-center gap-1.5">
                    {isDeposit(flow.type)
                      ? <ArrowDown className="w-3 h-3 text-[var(--success)]/60" />
                      : <ArrowUp className="w-3 h-3 text-destructive/60" />}
                    <span className={`text-[9px] font-bold uppercase tracking-widest ${isDeposit(flow.type) ? 'text-[var(--success)]' : 'text-destructive'}`}>
                      {isDeposit(flow.type) ? 'Deposit' : 'Withdraw'}
                    </span>
                  </div>
                </td>
                <td className="py-3 px-3 font-bold text-foreground">{flow.coin}</td>
                <td className={`py-3 px-3 text-right font-bold ${isDeposit(flow.type) ? 'text-[var(--success)]' : 'text-destructive'}`}>
                  {isDeposit(flow.type) ? '+' : '-'}{formatAmount(flow.amount, flow.decimals)}
                </td>
                <td className="py-3 px-3">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50">{flow.chain.replace('_', ' ')}</span>
                </td>
                <td className="py-3 px-3 text-[9px] text-muted-foreground/50">{formatDate(flow.statusTime)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile List */}
      <div className="md:hidden divide-y divide-border">
        {paginatedFlows.map((flow, idx) => {
          const rowId = `${startIndex}-${idx}`;
          return (
            <div key={rowId}>
              <button onClick={() => toggleExpand(rowId)} className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-2">
                  {isDeposit(flow.type)
                    ? <ArrowDown className="w-3.5 h-3.5 text-[var(--success)]/60" />
                    : <ArrowUp className="w-3.5 h-3.5 text-destructive/60" />}
                  <span className={`text-[9px] font-bold uppercase tracking-widest ${isDeposit(flow.type) ? 'text-[var(--success)]' : 'text-destructive'}`}>
                    {isDeposit(flow.type) ? 'Deposit' : 'Withdraw'}
                  </span>
                  <span className="text-[9px] font-bold text-muted-foreground/50">{flow.coin} · {flow.chain.replace('_', ' ')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-bold text-sm ${isDeposit(flow.type) ? 'text-[var(--success)]' : 'text-destructive'}`}>
                    {isDeposit(flow.type) ? '+' : '-'}{formatAmount(flow.amount, flow.decimals)}
                  </span>
                  <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground/40 transition-transform ${expandedRows.has(rowId) ? 'rotate-180' : ''}`} />
                </div>
              </button>
              {expandedRows.has(rowId) && (
                <div className="px-4 pb-4 grid grid-cols-2 gap-3 border-t border-border pt-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/50">Network</span>
                    <span className="text-[11px] font-bold text-foreground">{flow.chain.replace('_', ' ')}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/50">Timestamp</span>
                    <span className="text-[11px] font-bold text-muted-foreground/60">{formatDate(flow.statusTime)}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
        <div className="flex items-center gap-1">
          {[5, 10, 20, 50].map((value) => (
            <button key={value} onClick={() => handleRowsPerPageChange(value)}
              className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest border transition-colors ${
                rowsPerPage === value ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
              }`} style={{ borderRadius: 'var(--radius-sm)' }}>
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

