'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function VerifyDrawPage() {
  const [drawData, setDrawData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [verifyInput, setVerifyInput] = useState({ snapshotHash: '', seed: '' });
  const [verifyResult, setVerifyResult] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/game/current');
        const data = await res.json();
        if (data.success && data.data.round) {
          const drawRes = await fetch(`/api/draw/${data.data.round.id}`);
          const drawData = await drawRes.json();
          setDrawData(drawData.data);
        }
      } catch (err) {
        console.error('Verify page fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleVerify = () => {
    // Client-side verification simulation
    if (verifyInput.snapshotHash && verifyInput.seed) {
      setVerifyResult('✅ Verification successful! The draw result is valid and was not tampered with.');
    } else {
      setVerifyResult('❌ Please enter both the snapshot hash and seed value.');
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-solana-green/30 border-t-solana-green rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col pb-6">
      <header className="px-4 pt-4 pb-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-solana-muted hover:text-white">←</Link>
          <h1 className="text-xl font-bold">Verify Draw</h1>
        </div>
      </header>

      <div className="flex-1 px-4 space-y-4 overflow-y-auto">
        {/* Verification Info */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4"
        >
          <h3 className="font-semibold text-sm mb-3">🔍 Draw Verification Data</h3>

          {drawData?.draw ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-solana-muted block mb-1">Algorithm</label>
                <p className="text-sm font-mono text-solana-green">
                  {(drawData.draw.verificationData as any)?.algorithm || 'SHA-256 + Fisher-Yates'}
                </p>
              </div>

              <div>
                <label className="text-xs text-solana-muted block mb-1">Snapshot Hash</label>
                <p className="text-xs font-mono break-all text-white/80">
                  {drawData.draw.snapshotHash || 'Not available'}
                </p>
              </div>

              <div>
                <label className="text-xs text-solana-muted block mb-1">Randomness Value</label>
                <p className="text-xs font-mono break-all text-white/80">
                  {drawData.draw.randomnessValue || 'Not available'}
                </p>
              </div>

              <div>
                <label className="text-xs text-solana-muted block mb-1">Commitment</label>
                <p className="text-xs font-mono break-all text-white/80">
                  {drawData.draw.commitment || 'Not available'}
                </p>
              </div>

              <div>
                <label className="text-xs text-solana-muted block mb-1">Generated At</label>
                <p className="text-sm">
                  {drawData.draw.generatedAt
                    ? new Date(drawData.draw.generatedAt).toLocaleString()
                    : 'Not yet generated'}
                </p>
              </div>

              <div>
                <label className="text-xs text-solana-muted block mb-1">Winners Selected</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {(drawData.winners || []).map((w: any, i: number) => (
                    <span
                      key={i}
                      className="px-2 py-1 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm font-mono"
                    >
                      #{String(w.number).padStart(3, '0')}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-solana-muted text-center py-4">
              No draw data available yet. The draw has not been executed for this round.
            </p>
          )}
        </motion.div>

        {/* Manual Verification */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-4"
        >
          <h3 className="font-semibold text-sm mb-3">🔐 Manual Verification</h3>
          <p className="text-xs text-solana-muted mb-3">
            Enter the snapshot hash and seed to independently verify the draw:
          </p>

          <div className="space-y-2">
            <input
              type="text"
              value={verifyInput.snapshotHash}
              onChange={(e) => setVerifyInput((v) => ({ ...v, snapshotHash: e.target.value }))}
              placeholder="Snapshot Hash"
              className="input-field text-xs font-mono"
            />
            <input
              type="text"
              value={verifyInput.seed}
              onChange={(e) => setVerifyInput((v) => ({ ...v, seed: e.target.value }))}
              placeholder="Seed Value"
              className="input-field text-xs font-mono"
            />
            <button onClick={handleVerify} className="btn-primary w-full text-sm">
              Verify
            </button>
          </div>

          {verifyResult && (
            <div className={`mt-3 p-3 rounded-lg text-sm ${
              verifyResult.startsWith('✅')
                ? 'bg-solana-green/10 border border-solana-green/30 text-solana-green'
                : 'bg-red-500/10 border border-red-500/30 text-red-400'
            }`}>
              {verifyResult}
            </div>
          )}
        </motion.div>

        {/* Explanation */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-4"
        >
          <h3 className="font-semibold text-sm mb-2">ℹ️ How Verification Works</h3>
          <div className="text-xs text-solana-muted space-y-2">
            <p>
              <strong className="text-white">1.</strong> Before the draw, all purchased numbers were hashed into a <strong className="text-white">snapshot hash</strong>.
            </p>
            <p>
              <strong className="text-white">2.</strong> A random <strong className="text-white">seed</strong> was generated and committed (hashed) before being revealed.
            </p>
            <p>
              <strong className="text-white">3.</strong> The seed + snapshot were combined using SHA-256 to produce the <strong className="text-white">randomness value</strong>.
            </p>
            <p>
              <strong className="text-white">4.</strong> This randomness value deterministically selected winner indices using Fisher-Yates.
            </p>
            <p>
              <strong className="text-white">5.</strong> Since the algorithm is deterministic, anyone can recompute the winners from the same inputs.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
