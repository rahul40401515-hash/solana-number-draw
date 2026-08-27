'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { formatNumber, lamportsToSol, shortenAddress } from '@/lib/utils';

interface Round {
  id: string;
  roundNumber: number;
  title: string;
  status: string;
  startAt: string;
  endAt: string;
  entryPriceLamports: string;
  totalEntries: number;
  prizePoolLamports: string;
  winnerCount: number;
}

interface Stats {
  totalUsers: number;
  totalPurchases: number;
  activeReservations: number;
  pendingPayouts: number;
  completedRounds: number;
  totalPrizePool: string;
}

export default function AdminPage() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateRound, setShowCreateRound] = useState(false);
  const [adminSecret, setAdminSecret] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Simple admin auth (in production, use proper auth with 2FA)
  const handleAuth = useCallback(() => {
    if (process.env.NODE_ENV === 'development') {
      setIsAuthenticated(true);
      return;
    }
    // Check against admin secret
    if (adminSecret) {
      setIsAuthenticated(true);
    }
  }, [adminSecret]);

  // Fetch dashboard data
  const fetchDashboard = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const res = await fetch('/api/admin/rounds', {
        headers: { 'x-admin-secret': adminSecret || 'dev' },
      });
      const data = await res.json();

      if (data.success) {
        setRounds(data.data.rounds);
        setStats(data.data.stats);
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, adminSecret]);

  useEffect(() => {
    if (isAuthenticated) fetchDashboard();
  }, [isAuthenticated, fetchDashboard]);

  // Round actions
  const handleRoundAction = useCallback(async (roundId: string, action: string) => {
    setActionLoading(`${roundId}-${action}`);

    try {
      const res = await fetch(`/api/admin/rounds/${roundId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret || 'dev',
        },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();
      if (data.success) {
        fetchDashboard();
      } else {
        alert(data.error?.message || 'Action failed');
      }
    } catch (err) {
      alert('Network error');
    } finally {
      setActionLoading(null);
    }
  }, [adminSecret, fetchDashboard]);

  // Execute draw
  const handleExecuteDraw = useCallback(async (roundId: string) => {
    if (!confirm('Are you sure you want to execute the draw? This cannot be undone.')) return;

    setActionLoading(`${roundId}-draw`);

    try {
      const res = await fetch(`/api/admin/draws/${roundId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret || 'dev',
        },
      });

      const data = await res.json();
      if (data.success) {
        alert(`Draw executed! Winners: ${data.data.winners.map((w: any) => `#${w.number}`).join(', ')}`);
        fetchDashboard();
      } else {
        alert(data.error?.message || 'Draw failed');
      }
    } catch (err) {
      alert('Network error');
    } finally {
      setActionLoading(null);
    }
  }, [adminSecret, fetchDashboard]);

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="glass-card p-6 w-full max-w-sm">
          <h2 className="text-xl font-bold text-center mb-4">Admin Access</h2>

          <div className="space-y-3">
            <input
              type="password"
              value={adminSecret}
              onChange={(e) => setAdminSecret(e.target.value)}
              placeholder="Admin Secret"
              className="input-field"
              onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
            />
            <button onClick={handleAuth} className="btn-primary w-full">
              Authenticate
            </button>
          </div>

          <Link href="/" className="block text-center text-sm text-solana-muted mt-4 hover:text-white">
            ← Back to Game
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-solana-green/30 border-t-solana-green rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col pb-6">
      {/* Header */}
      <header className="px-4 pt-4 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-solana-muted hover:text-white">←</Link>
            <h1 className="text-xl font-bold">Admin Dashboard</h1>
          </div>
          <span className="badge badge-completed">Admin</span>
        </div>
      </header>

      <div className="flex-1 px-4 space-y-4 overflow-y-auto custom-scrollbar">
        {/* Stats Grid */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-3 gap-2"
          >
            <div className="glass-card p-3 text-center">
              <p className="text-lg font-bold">{formatNumber(stats.totalUsers)}</p>
              <p className="text-xs text-solana-muted">Users</p>
            </div>
            <div className="glass-card p-3 text-center">
              <p className="text-lg font-bold">{formatNumber(stats.totalPurchases)}</p>
              <p className="text-xs text-solana-muted">Purchases</p>
            </div>
            <div className="glass-card p-3 text-center">
              <p className="text-lg font-bold">{stats.activeReservations}</p>
              <p className="text-xs text-solana-muted">Reservations</p>
            </div>
            <div className="glass-card p-3 text-center">
              <p className="text-lg font-bold">{stats.pendingPayouts}</p>
              <p className="text-xs text-solana-muted">Pending Payouts</p>
            </div>
            <div className="glass-card p-3 text-center">
              <p className="text-lg font-bold">{stats.completedRounds}</p>
              <p className="text-xs text-solana-muted">Completed</p>
            </div>
            <div className="glass-card p-3 text-center">
              <p className="text-lg font-bold text-solana-green">
                {lamportsToSol(stats.totalPrizePool).toFixed(1)}
              </p>
              <p className="text-xs text-solana-muted">Prize Pool</p>
            </div>
          </motion.div>
        )}

        {/* Create Round Button */}
        <button
          onClick={() => setShowCreateRound(true)}
          className="btn-primary w-full"
        >
          + Create New Round
        </button>

        {/* Rounds List */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm text-solana-muted">Game Rounds</h3>

          {rounds.map((round) => (
            <motion.div
              key={round.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-semibold">
                    Round #{String(round.roundNumber).padStart(3, '0')}
                  </p>
                  <span className={`badge ${
                    round.status === 'OPEN' ? 'badge-open' :
                    round.status === 'COMPLETED' ? 'badge-completed' :
                    round.status === 'CLOSING' ? 'badge-pending' :
                    'badge-closed'
                  }`}>
                    {round.status}
                  </span>
                </div>
                <p className="text-sm text-solana-muted">
                  {round.totalEntries} entries
                </p>
              </div>

              <div className="flex items-center justify-between text-sm mb-3">
                <span className="text-solana-muted">
                  Prize: {lamportsToSol(round.prizePoolLamports).toFixed(2)} SOL
                </span>
                <span className="text-solana-muted">
                  {round.winnerCount} winners
                </span>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {round.status === 'DRAFT' && (
                  <button
                    onClick={() => handleRoundAction(round.id, 'open')}
                    disabled={actionLoading === `${round.id}-open`}
                    className="flex-1 btn-primary text-xs py-2"
                  >
                    Open Round
                  </button>
                )}
                {round.status === 'OPEN' && (
                  <>
                    <button
                      onClick={() => handleRoundAction(round.id, 'pause')}
                      className="flex-1 btn-secondary text-xs py-2"
                    >
                      Pause
                    </button>
                    <button
                      onClick={() => handleRoundAction(round.id, 'close')}
                      className="flex-1 btn-secondary text-xs py-2"
                    >
                      Close
                    </button>
                  </>
                )}
                {round.status === 'PAUSED' && (
                  <button
                    onClick={() => handleRoundAction(round.id, 'resume')}
                    className="flex-1 btn-primary text-xs py-2"
                  >
                    Resume
                  </button>
                )}
                {(round.status === 'CLOSING' || round.status === 'DRAW_PENDING') && (
                  <button
                    onClick={() => handleExecuteDraw(round.id)}
                    disabled={actionLoading === `${round.id}-draw`}
                    className="flex-1 btn-primary text-xs py-2"
                  >
                    {actionLoading === `${round.id}-draw` ? 'Executing...' : 'Execute Draw'}
                  </button>
                )}
                {round.status === 'COMPLETED' && (
                  <Link
                    href={`/game/results?round=${round.id}`}
                    className="flex-1 btn-secondary text-xs py-2 text-center"
                  >
                    View Results
                  </Link>
                )}
              </div>
            </motion.div>
          ))}

          {rounds.length === 0 && (
            <p className="text-center text-solana-muted py-8">
              No rounds created yet
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
