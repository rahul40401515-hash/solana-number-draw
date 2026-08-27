'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { formatSol, lamportsToSol, shortenAddress } from '@/lib/utils';

interface WalletConnectProps {
  round: {
    id: string;
    entryPriceLamports: string;
    treasuryWallet: string;
    network: string;
  };
  selectedNumber: number;
  onClose: () => void;
  onSuccess: () => void;
}

export default function WalletConnect({ round, selectedNumber, onClose, onSuccess }: WalletConnectProps) {
  const [step, setStep] = useState<'connect' | 'confirm' | 'sending' | 'verifying' | 'success' | 'error'>('connect');
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [transactionSignature, setTransactionSignature] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manualWallet, setManualWallet] = useState('');
  const [manualSignature, setManualSignature] = useState('');

  const entryPrice = lamportsToSol(round.entryPriceLamports);

  // Simulate wallet connection (in production, use @solana/wallet-adapter)
  const handleConnectWallet = useCallback(async () => {
    setStep('confirm');

    // In development mode, we can simulate a wallet connection
    if (process.env.NODE_ENV === 'development') {
      // Use a mock wallet address for testing
      setWalletAddress('Dev' + Math.random().toString(36).substring(2, 15) + 'Wallet');
    }
  }, []);

  // Handle manual transaction input (for dev mode testing)
  const handleManualSubmit = useCallback(async () => {
    if (!manualWallet || !manualSignature) {
      setErrorMessage('Please enter both wallet address and transaction signature');
      return;
    }

    setStep('verifying');
    setWalletAddress(manualWallet);
    setTransactionSignature(manualSignature);

    try {
      // Verify payment with backend
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roundId: round.id,
          number: selectedNumber,
          transactionSignature: manualSignature,
          walletAddress: manualWallet,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setStep('success');
        setTimeout(onSuccess, 2000);
      } else {
        setErrorMessage(data.error?.message || 'Payment verification failed');
        setStep('error');
      }
    } catch (err) {
      setErrorMessage('Network error. Please try again.');
      setStep('error');
    }
  }, [manualWallet, manualSignature, round.id, selectedNumber, onSuccess]);

  // Simulate payment (dev mode)
  const handleSimulatePayment = useCallback(async () => {
    setStep('sending');

    // Simulate transaction delay
    await new Promise((r) => setTimeout(r, 2000));

    const mockSignature = 'mock_' + Math.random().toString(36).substring(2, 30);
    setTransactionSignature(mockSignature);

    setStep('verifying');

    try {
      // In development, we can bypass blockchain verification
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roundId: round.id,
          number: selectedNumber,
          transactionSignature: mockSignature,
          walletAddress: walletAddress || 'DevWallet',
        }),
      });

      const data = await res.json();

      if (data.success) {
        setStep('success');
        setTimeout(onSuccess, 2000);
      } else {
        // In dev mode, accept the mock payment
        if (process.env.NODE_ENV === 'development') {
          setStep('success');
          setTimeout(onSuccess, 2000);
        } else {
          setErrorMessage(data.error?.message || 'Payment verification failed');
          setStep('error');
        }
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        setStep('success');
        setTimeout(onSuccess, 2000);
      } else {
        setErrorMessage('Network error');
        setStep('error');
      }
    }
  }, [round.id, selectedNumber, walletAddress, onSuccess]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-solana-darker/95 backdrop-blur-lg flex items-center justify-center p-4"
    >
      <div className="glass-card p-6 w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold">Complete Purchase</h2>
          <button onClick={onClose} className="text-solana-muted hover:text-white text-xl">✕</button>
        </div>

        {/* Step: Connect Wallet */}
        {step === 'connect' && (
          <div className="space-y-4">
            <div className="text-center mb-4">
              <p className="text-4xl font-bold gradient-text">
                #{String(selectedNumber).padStart(3, '0')}
              </p>
              <p className="text-solana-muted mt-1">Entry: {entryPrice} SOL</p>
            </div>

            <button
              onClick={handleConnectWallet}
              className="btn-primary w-full"
            >
              🔗 Connect Wallet
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-solana-border/50" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-solana-card text-solana-muted">or</span>
              </div>
            </div>

            <div className="space-y-2">
              <input
                type="text"
                value={manualWallet}
                onChange={(e) => setManualWallet(e.target.value)}
                placeholder="Wallet Address"
                className="input-field text-sm font-mono"
              />
              <input
                type="text"
                value={manualSignature}
                onChange={(e) => setManualSignature(e.target.value)}
                placeholder="Transaction Signature"
                className="input-field text-sm font-mono"
              />
              <button
                onClick={handleManualSubmit}
                className="btn-secondary w-full text-sm"
              >
                Submit Transaction
              </button>
            </div>

            {process.env.NODE_ENV === 'development' && (
              <button
                onClick={() => {
                  setWalletAddress('DevWallet');
                  handleSimulatePayment();
                }}
                className="w-full text-center text-xs text-solana-muted/50 hover:text-solana-muted"
              >
                [Dev Mode] Skip to simulated payment
              </button>
            )}
          </div>
        )}

        {/* Step: Confirm Payment */}
        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="text-center mb-4">
              <p className="text-solana-muted text-sm">Sending payment for</p>
              <p className="text-3xl font-bold gradient-text mt-1">
                #{String(selectedNumber).padStart(3, '0')}
              </p>
              <p className="text-xl font-bold mt-2">{entryPrice} SOL</p>
              <p className="text-sm text-solana-muted mt-1">
                To: {shortenAddress(round.treasuryWallet || 'Treasury')}
              </p>
              {walletAddress && (
                <p className="text-xs text-solana-muted mt-2">
                  From: {shortenAddress(walletAddress)}
                </p>
              )}
            </div>

            <button onClick={handleSimulatePayment} className="btn-primary w-full">
              💰 Send {entryPrice} SOL
            </button>

            <p className="text-xs text-solana-muted text-center">
              Network: {round.network} | This is a {round.network === 'devnet' ? 'test' : 'mainnet'} transaction
            </p>
          </div>
        )}

        {/* Step: Sending */}
        {step === 'sending' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 border-4 border-solana-green/30 border-t-solana-green rounded-full animate-spin mx-auto" />
            <p className="text-lg font-semibold mt-4">Sending Transaction...</p>
            <p className="text-sm text-solana-muted mt-1">Please confirm in your wallet</p>
          </div>
        )}

        {/* Step: Verifying */}
        {step === 'verifying' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 border-4 border-solana-purple/30 border-t-solana-purple rounded-full animate-spin mx-auto" />
            <p className="text-lg font-semibold mt-4">Verifying Payment...</p>
            <p className="text-sm text-solana-muted mt-1">Checking blockchain confirmation</p>
            {transactionSignature && (
              <p className="text-xs text-solana-muted mt-3 font-mono break-all">
                TX: {shortenAddress(transactionSignature, 8)}
              </p>
            )}
          </div>
        )}

        {/* Step: Success */}
        {step === 'success' && (
          <div className="text-center py-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 10 }}
              className="text-6xl mb-4"
            >
              🎉
            </motion.div>
            <p className="text-xl font-bold text-solana-green">Purchase Confirmed!</p>
            <p className="text-solana-muted mt-2">
              You own number <span className="text-solana-purple font-bold">
                #{String(selectedNumber).padStart(3, '0')}
              </span>
            </p>
            {transactionSignature && (
              <p className="text-xs text-solana-muted mt-3 font-mono">
                TX: {shortenAddress(transactionSignature, 8)}
              </p>
            )}
          </div>
        )}

        {/* Step: Error */}
        {step === 'error' && (
          <div className="text-center py-8">
            <p className="text-4xl mb-4">❌</p>
            <p className="text-lg font-semibold text-red-400">Payment Failed</p>
            <p className="text-sm text-solana-muted mt-2">{errorMessage}</p>
            <div className="flex gap-2 mt-6">
              <button onClick={onClose} className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                onClick={() => { setStep('connect'); setErrorMessage(null); }}
                className="btn-primary flex-1"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
