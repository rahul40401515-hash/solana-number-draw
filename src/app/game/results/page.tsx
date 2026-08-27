'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { lamportsToSol, shortenAddress } from '@/lib/utils';

interface Winner {
  rank: number;
  number: number;
  username: string;
  prizeSol: string;
  walletAddress: string;
  status: string;
  payoutTransaction: string | null;
}

interface RoundResult {
  id: string;
  roundNumber: number;
  title: string;
  status: string;
  prizePoolSol: string;
  totalEntries: number;
  winnerCount: number;
  completedAt: string;
  network: string;
}

export default function ResultsPage() {
  const [round, setRound] = useState<RoundResult | null>(null);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        // Get latest completed round
        const res = await fetch('/api/game/current');
        const data = await res.json();
        if (data.success && data.data.round) {
          // Fetch results for this round
          const resultsRes = await fetch(`/api/results/${data.data.round.id}`);
          const resultsData = await resultsRes.json();

          if (resultsData.success) {
            setRound(resultsData.data.round);
            setWinners(resultsData.data.winners);
          }
        }
      } catch (err) {
        console.error('Failed to fetch results:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-solana-green/30 border-t-solana-green rounded-full animate-spin" />
      </div>
    );
  }

  if (!round) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-4xl mb-4">🏆</p>
          <h2 className="text-xl font-bold mb-2">No Results Yet</h2>
          <p className="text-solana-muted">Results will appear here after a round completes.</p>
          <Link href="/" className="btn-primary mt-6 inline-block">
            Back to Game
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col pb-6">
      {/* Header */}
      <header className="px-4 pt-4 pb-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-solana-muted hover:text-white">←</Link>
          <h1 className="text-xl font-bold">Round Results</h1>
        </div>
      </header>

      <div className="flex-1 px-4 space-y-4">
        {/* Round Summary */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6 text-center"
        >
          <p className="text-3xl mb-2">🏆</p>
          <h2 className="text-lg font-bold gradient-text">
            {round.title} COMPLETE
          </h2>
          <p className="text-3xl font-bold mt-3">{round.prizePoolSol} SOL</p>
          <p className="text-sm text-solana-muted mt-1">Total Prize Pool</p>

          <div className="flex justify-center gap-6 mt-4">
            <div className="text-center">
              <p className="text-xl font-bold">{round.totalEntries}</p>
              <p className="text-xs text-solana-muted">Entries</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold">{round.winnerCount}</p>
              <p className="text-xs text-solana-muted">Winners</p>
            </div>
          </div>
        </motion.div>

        {/* Winners */}
        <div className="space-y-3">
          <h3 className="font-semibold text-solana-muted">Winners</h3>

          {winners.map((winner, idx) => (
            <motion.div
              key={winner.rank}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="glass-card p-4 flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center text-lg">
                🏆
              </div>
              <div className="flex-1">
                <p className="font-bold">
                  #{String(winner.number).padStart(3, '0')}
                </p>
                <p className="text-sm text-solana-muted">@{winner.username}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-solana-green">{winner.prizeSol} SOL</p>
                <p className="text-xs text-solana-muted">
                  {winner.status === 'PAID' ? '✅ Paid' : '⏳ Pending'}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Verify Draw Link */}
        <Link
          href={`/game/verify?round=${round.id}`}
          className="btn-secondary w-full text-center block"
        >
          🔍 Verify Draw
        </Link>
      </div>
    </div>
  );
}
