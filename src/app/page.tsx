'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { formatNumber, formatSol, formatTimeRemaining, lamportsToSol } from '@/lib/utils';
import NumberSelector from '@/components/game/NumberSelector';
import WalletConnect from '@/components/payment/WalletConnect';

// ── Types ────────────────────────────────────

interface RoundData {
  id: string;
  roundNumber: number;
  title: string;
  status: string;
  startAt: string;
  endAt: string;
  entryPriceLamports: string;
  numberMin: number;
  numberMax: number;
  winnerCount: number;
  prizePoolLamports: string;
  totalEntries: number;
  treasuryWallet: string;
  network: string;
}

interface RoundStats {
  totalNumbers: number;
  available: number;
  taken: number;
  reserved: number;
  soldPercent: number;
}

// ── Main Page ────────────────────────────────

export default function HomePage() {
  const [round, setRound] = useState<RoundData | null>(null);
  const [stats, setStats] = useState<RoundStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNumberSelector, setShowNumberSelector] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [showWallet, setShowWallet] = useState(false);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: false });
  const [solPrice, setSolPrice] = useState(0);

  // Fetch current round data
  const fetchRound = useCallback(async () => {
    try {
      const res = await fetch('/api/game/current');
      const data = await res.json();

      if (data.success && data.data.round) {
        setRound(data.data.round);
        setStats(data.data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch round:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch SOL price
  const fetchSolPrice = useCallback(async () => {
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
      const data = await res.json();
      setSolPrice(data?.solana?.usd || 0);
    } catch {
      // Fallback
      setSolPrice(0);
    }
  }, []);

  useEffect(() => {
    fetchRound();
    fetchSolPrice();

    // Poll for updates every 10 seconds
    const interval = setInterval(() => {
      fetchRound();
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchRound, fetchSolPrice]);

  // Countdown timer
  useEffect(() => {
    if (!round?.endAt) return;

    const updateCountdown = () => {
      const result = formatTimeRemaining(new Date(round.endAt));
      setCountdown(result);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [round?.endAt]);

  const prizePoolSol = lamportsToSol(round?.prizePoolLamports || '0');
  const prizePoolUsd = solPrice > 0 ? prizePoolSol * solPrice : 0;
  const entryPriceSol = lamportsToSol(round?.entryPriceLamports || '50000000');

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-solana-green/30 border-t-solana-green rounded-full animate-spin mx-auto" />
          <p className="text-solana-muted mt-4">Loading game...</p>
        </div>
      </div>
    );
  }

  if (!round) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-6xl mb-4">🎮</div>
          <h2 className="text-xl font-bold mb-2">No Active Round</h2>
          <p className="text-solana-muted">The next game round is being prepared. Check back soon!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col pb-6">
      {/* Header */}
      <header className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏆</span>
            <div>
              <h1 className="text-lg font-bold gradient-text">{round.title}</h1>
              <span className={`badge ${round.status === 'OPEN' ? 'badge-open' : 'badge-closed'}`}>
                {round.status}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/profile" className="p-2 rounded-xl bg-solana-card border border-solana-border/50">
              <span className="text-lg">👤</span>
            </Link>
            <Link href="/admin" className="p-2 rounded-xl bg-solana-card border border-solana-border/50">
              <span className="text-lg">⚙️</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 px-4 space-y-4 overflow-y-auto custom-scrollbar">
        {/* Prize Pool Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6 text-center"
        >
          <p className="text-solana-muted text-sm mb-1">Prize Pool</p>
          <p className="prize-pool-value">{prizePoolSol.toFixed(2)} SOL</p>
          {solPrice > 0 && (
            <p className="prize-pool-usd">
              ≈ ${(prizePoolUsd / 1000000).toFixed(2)}M USD
              <span className="text-xs ml-1 text-solana-muted/50">(estimate)</span>
            </p>
          )}

          <div className="flex items-center justify-center gap-6 mt-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{formatNumber(stats?.taken || 0)}</p>
              <p className="text-xs text-solana-muted">Entries</p>
            </div>
            <div className="w-px h-8 bg-solana-border" />
            <div className="text-center">
              <p className="text-2xl font-bold text-solana-green">{formatNumber(stats?.available || 0)}</p>
              <p className="text-xs text-solana-muted">Available</p>
            </div>
            <div className="w-px h-8 bg-solana-border" />
            <div className="text-center">
              <p className="text-2xl font-bold text-solana-purple">{round.winnerCount}</p>
              <p className="text-xs text-solana-muted">Winners</p>
            </div>
          </div>
        </motion.div>

        {/* Countdown Timer */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-solana-muted">Draw Ends In</p>
            <span className="badge badge-open">{round.status}</span>
          </div>

          <div className="flex items-center justify-center gap-3">
            <div className="countdown-segment">
              <span className="countdown-value">{String(countdown.days).padStart(2, '0')}</span>
              <span className="countdown-label">Days</span>
            </div>
            <span className="text-2xl text-solana-muted">:</span>
            <div className="countdown-segment">
              <span className="countdown-value">{String(countdown.hours).padStart(2, '0')}</span>
              <span className="countdown-label">Hours</span>
            </div>
            <span className="text-2xl text-solana-muted">:</span>
            <div className="countdown-segment">
              <span className="countdown-value">{String(countdown.minutes).padStart(2, '0')}</span>
              <span className="countdown-label">Mins</span>
            </div>
            <span className="text-2xl text-solana-muted">:</span>
            <div className="countdown-segment">
              <span className="countdown-value text-solana-green">{String(countdown.seconds).padStart(2, '0')}</span>
              <span className="countdown-label">Secs</span>
            </div>
          </div>
        </motion.div>

        {/* Entry Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-solana-muted">Entry Price</p>
              <p className="text-xl font-bold text-white">{entryPriceSol} SOL</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-solana-muted">Per Winner</p>
              <p className="text-xl font-bold text-solana-green">
                {(prizePoolSol / round.winnerCount).toFixed(2)} SOL
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3">
            <div className="flex justify-between text-xs text-solana-muted mb-1">
              <span>Sold: {stats?.soldPercent || 0}%</span>
              <span>{formatNumber(stats?.taken || 0)} / {formatNumber(stats?.totalNumbers || 0)}</span>
            </div>
            <div className="h-2 bg-solana-dark rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-solana-green to-solana-purple rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${stats?.soldPercent || 0}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        </motion.div>

        {/* Choose Number Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <button
            onClick={() => setShowNumberSelector(true)}
            disabled={round.status !== 'OPEN'}
            className="btn-primary w-full text-lg py-4"
          >
            {round.status === 'OPEN' ? '🎯 CHOOSE YOUR NUMBER' : '⏳ Round Not Open'}
          </button>
        </motion.div>

        {/* Rules Summary */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="glass-card p-4"
        >
          <h3 className="font-semibold text-sm mb-2">How it works</h3>
          <div className="space-y-2 text-sm text-solana-muted">
            <div className="flex items-start gap-2">
              <span className="text-solana-green">1.</span>
              <span>Choose a number from {round.numberMin} to {round.numberMax}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-solana-green">2.</span>
              <span>Pay {entryPriceSol} SOL to enter</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-solana-green">3.</span>
              <span>{round.winnerCount} winning numbers are drawn when round ends</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-solana-green">4.</span>
              <span>Prize pool is split equally among winners</span>
            </div>
          </div>
        </motion.div>

        {/* Disclaimer */}
        <p className="text-xs text-solana-muted/50 text-center px-4">
          ⚠️ This game involves chance. Entry price is non-refundable.
          Play responsibly. {process.env.NODE_ENV === 'development' && '(Devnet Mode)'}
        </p>
      </div>

      {/* Number Selector Modal */}
      <AnimatePresence>
        {showNumberSelector && round && (
          <NumberSelector
            round={round}
            onSelect={(num) => {
              setSelectedNumber(num);
              setShowNumberSelector(false);
              setShowWallet(true);
            }}
            onClose={() => setShowNumberSelector(false)}
          />
        )}
      </AnimatePresence>

      {/* Wallet Connect Modal */}
      <AnimatePresence>
        {showWallet && selectedNumber && round && (
          <WalletConnect
            round={round}
            selectedNumber={selectedNumber}
            onClose={() => {
              setShowWallet(false);
              setSelectedNumber(null);
            }}
            onSuccess={() => {
              setShowWallet(false);
              setSelectedNumber(null);
              fetchRound();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
