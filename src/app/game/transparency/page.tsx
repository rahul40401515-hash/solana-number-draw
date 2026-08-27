'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { shortenAddress, getExplorerUrl } from '@/lib/utils';

export default function TransparencyPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/game/current');
        const result = await res.json();
        if (result.success && result.data.round) {
          const drawRes = await fetch(`/api/draw/${result.data.round.id}`);
          const drawData = await drawRes.json();
          setData(drawData.data || result.data);
        }
      } catch (err) {
        console.error('Transparency fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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
          <Link href="/" className="text-solana-muted hover:text-white">←</Link>
          <h1 className="text-xl font-bold">Transparency</h1>
        </div>
      </header>

      <div className="flex-1 px-4 space-y-4 overflow-y-auto">
        {/* How It Works */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4"
        >
          <h3 className="font-semibold text-sm mb-3">🔒 Provably Fair Algorithm</h3>
          <div className="space-y-2 text-sm text-solana-muted">
            <p>
              Our draw uses a <span className="text-white font-medium">commit-reveal</span> pattern
              with cryptographic hashing to ensure fairness:
            </p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>A random seed is generated and committed (hashed) before the draw</li>
              <li>All purchased numbers are snapshot and hashed immutably</li>
              <li>The seed is revealed after the draw</li>
              <li>Anyone can verify the result using the snapshot + seed</li>
              <li>The algorithm is deterministic: same inputs = same outputs</li>
            </ol>
          </div>
        </motion.div>

        {/* Current Round Info */}
        {data?.round && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card p-4"
          >
            <h3 className="font-semibold text-sm mb-3">📊 Current Round</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-solana-muted">Round</span>
                <span className="font-mono">#{String(data.round.roundNumber).padStart(3, '0')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-solana-muted">Status</span>
                <span className={data.round.status === 'COMPLETED' ? 'text-solana-green' : 'text-yellow-400'}>
                  {data.round.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-solana-muted">Total Entries</span>
                <span>{data.round.totalEntries?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-solana-muted">Network</span>
                <span className="font-mono text-xs">{data.round.network}</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Randomness Proof */}
        {data?.draw && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card p-4"
          >
            <h3 className="font-semibold text-sm mb-3">🎲 Randomness Proof</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-solana-muted mb-1">Provider</p>
                <p className="text-sm font-mono">{data.draw.provider}</p>
              </div>
              <div>
                <p className="text-xs text-solana-muted mb-1">Snapshot Hash</p>
                <p className="text-xs font-mono text-solana-green break-all">
                  {data.draw.snapshotHash || 'Pending...'}
                </p>
              </div>
              <div>
                <p className="text-xs text-solana-muted mb-1">Randomness Value</p>
                <p className="text-xs font-mono break-all">
                  {data.draw.randomnessValue || 'Pending...'}
                </p>
              </div>
              <div>
                <p className="text-xs text-solana-muted mb-1">Status</p>
                <p className="text-sm">{data.draw.status}</p>
              </div>
              {data.draw.generatedAt && (
                <div>
                  <p className="text-xs text-solana-muted mb-1">Generated At</p>
                  <p className="text-sm">{new Date(data.draw.generatedAt).toLocaleString()}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Winners with Wallet Info */}
        {data?.winners && data.winners.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-card p-4"
          >
            <h3 className="font-semibold text-sm mb-3">🏆 Winner Wallets</h3>
            <div className="space-y-2">
              {data.winners.map((w: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span className="text-solana-muted">#{w.number}</span>
                  <span className="font-mono text-xs">{w.walletAddress || 'N/A'}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Verification Instructions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card p-4"
        >
          <h3 className="font-semibold text-sm mb-3">✅ How to Verify</h3>
          <div className="text-sm text-solana-muted space-y-2">
            <p>To independently verify the draw result:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Take the snapshot hash (hash of all purchased numbers)</li>
              <li>Combine with the revealed seed value</li>
              <li>Apply SHA-256 to get the randomness value</li>
              <li>Use the Fisher-Yates algorithm to derive winner indices</li>
              <li>Verify the indices match the published winners</li>
            </ol>
            <p className="mt-2">
              All data on this page allows complete independent verification
              of the draw&apos;s fairness.
            </p>
          </div>
        </motion.div>

        {/* Risk Disclosure */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/20"
        >
          <h3 className="font-semibold text-sm mb-2 text-yellow-400">⚠️ Risk Disclosure</h3>
          <p className="text-xs text-solana-muted">
            This game involves chance-based outcomes. Entry fees are non-refundable.
            The probability of winning depends on the number of entries purchased relative
            to total purchased numbers. Past results do not guarantee future outcomes.
            Play responsibly. This application uses Solana {data?.round?.network || 'devnet'} network.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
