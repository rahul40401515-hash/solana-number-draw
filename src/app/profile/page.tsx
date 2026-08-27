'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { formatSol, lamportsToSol, shortenAddress } from '@/lib/utils';

interface UserEntry {
  numberValue: number;
  status: string;
  purchasedAt: string | null;
}

interface UserProfile {
  user: {
    id: string;
    username: string | null;
    firstName: string | null;
    walletAddress: string | null;
  };
  entries: UserEntry[];
  totalSpent: string;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    try {
      // In production, this would use the auth token
      const res = await fetch('/api/game/my-entries');
      const data = await res.json();
      if (data.success) {
        setProfile(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

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
        <div className="flex items-center gap-3">
          <Link href="/" className="text-solana-muted hover:text-white">
            ← Back
          </Link>
          <h1 className="text-xl font-bold">My Profile</h1>
        </div>
      </header>

      <div className="flex-1 px-4 space-y-4">
        {/* User Info */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-solana-green/10 border border-solana-green/30 flex items-center justify-center text-2xl">
              👤
            </div>
            <div>
              <p className="font-semibold">
                {profile?.user?.username ? `@${profile.user.username}` : profile?.user?.firstName || 'Player'}
              </p>
              {profile?.user?.walletAddress ? (
                <p className="text-sm text-solana-muted font-mono">
                  {shortenAddress(profile.user.walletAddress)}
                </p>
              ) : (
                <p className="text-sm text-solana-muted">No wallet connected</p>
              )}
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-4"
        >
          <h3 className="font-semibold text-sm mb-3 text-solana-muted">Current Round</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-2xl font-bold">{profile?.entries?.length || 0}</p>
              <p className="text-xs text-solana-muted">Numbers Owned</p>
            </div>
            <div>
              <p className="text-2xl font-bold">
                {profile?.totalSpent ? lamportsToSol(profile.totalSpent).toFixed(2) : '0.00'} SOL
              </p>
              <p className="text-xs text-solana-muted">Total Spent</p>
            </div>
          </div>
        </motion.div>

        {/* My Numbers */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-4"
        >
          <h3 className="font-semibold text-sm mb-3 text-solana-muted">My Numbers</h3>

          {profile?.entries && profile.entries.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {profile.entries.map((entry) => (
                <div
                  key={entry.numberValue}
                  className={`px-3 py-1.5 rounded-lg text-sm font-mono font-medium border ${
                    entry.status === 'WINNER'
                      ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                      : 'bg-solana-purple/10 border-solana-purple/30 text-solana-purple'
                  }`}
                >
                  {entry.status === 'WINNER' ? '🏆 ' : ''}
                  #{String(entry.numberValue).padStart(3, '0')}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-solana-muted text-center py-4">
              No numbers purchased yet
            </p>
          )}
        </motion.div>

        {/* Previous Rounds (placeholder) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-4"
        >
          <h3 className="font-semibold text-sm mb-3 text-solana-muted">Previous Rounds</h3>
          <p className="text-sm text-solana-muted text-center py-4">
            No previous round history
          </p>
        </motion.div>

        {/* Quick Links */}
        <div className="flex gap-2">
          <Link href="/game/results" className="btn-secondary flex-1 text-center text-sm">
            🏆 Results
          </Link>
          <Link href="/game/transparency" className="btn-secondary flex-1 text-center text-sm">
            🔍 Transparency
          </Link>
        </div>
      </div>
    </div>
  );
}
