'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────

interface NumberSelectorProps {
  round: {
    id: string;
    numberMin: number;
    numberMax: number;
    status: string;
  };
  onSelect: (number: number) => void;
  onClose: () => void;
}

type NumberStatus = 'AVAILABLE' | 'TAKEN' | 'PURCHASED' | 'SELECTED' | 'RESERVED' | 'WINNER';

interface NumberCell {
  value: number;
  status: NumberStatus;
}

// ── Component ────────────────────────────────

export default function NumberSelector({ round, onSelect, onClose }: NumberSelectorProps) {
  const [numbers, setNumbers] = useState<Map<number, NumberStatus>>(new Map());
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [reserving, setReserving] = useState(false);
  const [filter, setFilter] = useState<'all' | 'available' | 'taken'>('all');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const pageSize = 200;

  // Fetch number grid data
  const fetchNumbers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        roundId: round.id,
        page: String(page),
        pageSize: String(pageSize),
      });
      if (filter !== 'all') {
        params.set('filter', filter);
      }

      const res = await fetch(`/api/numbers?${params}`);
      const data = await res.json();

      if (data.success) {
        const newMap = new Map<number, NumberStatus>();
        data.data.numbers.forEach((n: { value: number; status: string }) => {
          newMap.set(n.value, n.status as NumberStatus);
        });
        setNumbers(newMap);
      }
    } catch (err) {
      console.error('Failed to fetch numbers:', err);
    } finally {
      setLoading(false);
    }
  }, [round.id, page, filter]);

  useEffect(() => {
    fetchNumbers();
  }, [fetchNumbers]);

  // Search handler
  const handleSearch = useCallback(() => {
    const num = parseInt(searchValue);
    if (isNaN(num) || num < round.numberMin || num > round.numberMax) {
      setError(`Number must be between ${round.numberMin} and ${round.numberMax}`);
      return;
    }
    setError(null);

    // Calculate which page this number is on
    const targetPage = Math.ceil(num / pageSize);
    if (targetPage !== page) {
      setPage(targetPage);
    }

    // Check if number is available
    const status = numbers.get(num);
    if (status === 'TAKEN' || status === 'RESERVED') {
      setError(`Number ${num} is not available`);
    }
  }, [searchValue, round, page, numbers]);

  // Random available number
  const handleRandomNumber = useCallback(() => {
    const available: number[] = [];
    numbers.forEach((status, value) => {
      if (status === 'AVAILABLE') {
        available.push(value);
      }
    });

    if (available.length === 0) {
      setError('No available numbers on this page');
      return;
    }

    const randomIdx = Math.floor(Math.random() * available.length);
    const randomNum = available[randomIdx];
    setSelectedNumber(randomNum);
    setError(null);
  }, [numbers]);

  // Select a number
  const handleSelectNumber = useCallback((value: number) => {
    const status = numbers.get(value);
    if (status === 'TAKEN' || status === 'RESERVED' || status === 'WINNER') {
      return;
    }

    setSelectedNumber(value === selectedNumber ? null : value);
    setError(null);
    setSuccessMessage(null);
  }, [numbers, selectedNumber]);

  // Reserve and confirm selection
  const handleConfirmSelection = useCallback(async () => {
    if (selectedNumber === null) return;

    setReserving(true);
    setError(null);

    try {
      const res = await fetch('/api/numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roundId: round.id,
          number: selectedNumber,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccessMessage(`Number ${selectedNumber} reserved! Proceed to payment.`);

        // Update local state
        setNumbers((prev) => {
          const next = new Map(prev);
          next.set(selectedNumber, 'RESERVED');
          return next;
        });

        // Proceed to payment after short delay
        setTimeout(() => {
          onSelect(selectedNumber);
        }, 1000);
      } else {
        setError(data.error?.message || 'Failed to reserve number');

        // Update status if taken by someone else
        if (data.error?.code === 'NUMBER_ALREADY_TAKEN') {
          setNumbers((prev) => {
            const next = new Map(prev);
            next.set(selectedNumber, 'TAKEN');
            return next;
          });
          setSelectedNumber(null);
        }
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setReserving(false);
    }
  }, [selectedNumber, round.id, onSelect]);

  // Generate page numbers for display
  const displayNumbers = useMemo(() => {
    const start = (page - 1) * pageSize + round.numberMin;
    const end = Math.min(start + pageSize - 1, round.numberMax);
    const nums: number[] = [];
    for (let i = start; i <= end; i++) {
      nums.push(i);
    }
    return nums;
  }, [page, pageSize, round]);

  const totalPages = Math.ceil((round.numberMax - round.numberMin + 1) / pageSize);

  const getCellClass = (value: number): string => {
    const status = numbers.get(value);
    if (value === selectedNumber) return 'number-cell-selected';
    switch (status) {
      case 'TAKEN':
      case 'PURCHASED':
        return 'number-cell-taken';
      case 'RESERVED':
        return 'number-cell-reserved';
      case 'WINNER':
        return 'number-cell-winner';
      default:
        return 'number-cell-available';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-solana-darker/95 backdrop-blur-lg flex flex-col"
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-2 border-b border-solana-border/30">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">Choose Your Number</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-solana-card border border-solana-border/50 text-solana-muted hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Search & Filters */}
        <div className="flex gap-2 mb-3">
          <div className="flex-1 relative">
            <input
              type="number"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={`Search ${round.numberMin}-${round.numberMax}...`}
              className="input-field pr-10 text-sm"
              min={round.numberMin}
              max={round.numberMax}
            />
            <button
              onClick={handleSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-solana-muted hover:text-white"
            >
              🔍
            </button>
          </div>
          <button
            onClick={handleRandomNumber}
            className="px-3 py-2 rounded-xl bg-solana-card border border-solana-border/50 text-sm hover:border-solana-purple/50"
            title="Random available number"
          >
            🎲
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mb-2">
          {(['all', 'available', 'taken'] as const).map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(1); }}
              className={cn(
                'px-3 py-1 rounded-lg text-xs font-medium transition-colors',
                filter === f
                  ? 'bg-solana-green/20 text-solana-green border border-solana-green/30'
                  : 'bg-solana-card/50 text-solana-muted border border-transparent hover:text-white'
              )}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Error / Success messages */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-2"
            >
              ❌ {error}
            </motion.div>
          )}
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="text-solana-green text-sm bg-solana-green/10 border border-solana-green/20 rounded-lg px-3 py-2 mb-2"
            >
              ✅ {successMessage}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Number Grid */}
      <div className="flex-1 overflow-y-auto px-4 py-3 custom-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-8 h-8 border-2 border-solana-green/30 border-t-solana-green rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-8 sm:grid-cols-10 gap-1.5">
            {displayNumbers.map((num) => (
              <button
                key={num}
                onClick={() => handleSelectNumber(num)}
                disabled={numbers.get(num) === 'TAKEN' || numbers.get(num) === 'RESERVED'}
                className={cn(getCellClass(num), 'text-xs sm:text-sm py-2')}
              >
                {String(num).padStart(3, '0')}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer: Selection & Pagination */}
      <div className="px-4 py-3 border-t border-solana-border/30 bg-solana-darker">
        {/* Pagination */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded-lg bg-solana-card border border-solana-border/50 text-sm disabled:opacity-30"
          >
            ← Prev
          </button>
          <span className="text-sm text-solana-muted">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-lg bg-solana-card border border-solana-border/50 text-sm disabled:opacity-30"
          >
            Next →
          </button>
        </div>

        {/* Selected number & confirm */}
        <div className="flex items-center gap-3">
          {selectedNumber ? (
            <>
              <div className="flex-1 text-center">
                <span className="text-sm text-solana-muted">Selected: </span>
                <span className="text-lg font-bold text-solana-purple">
                  #{String(selectedNumber).padStart(3, '0')}
                </span>
              </div>
              <button
                onClick={handleConfirmSelection}
                disabled={reserving}
                className="btn-primary flex-shrink-0"
              >
                {reserving ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Reserving...
                  </span>
                ) : (
                  'CONFIRM'
                )}
              </button>
            </>
          ) : (
            <p className="flex-1 text-center text-sm text-solana-muted">
              Tap a number to select it
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
