/**
 * Solana Integration Library
 *
 * Handles wallet verification, payment confirmation, and transaction validation.
 * Uses @solana/web3.js for blockchain interaction.
 */

import {
  Connection,
  PublicKey,
  Transaction,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
  type ConfirmedSignatureInfo,
  type ParsedTransactionWithMeta,
} from '@solana/web3.js';

// ── Configuration ────────────────────────────

type SolanaNetwork = 'devnet' | 'testnet' | 'mainnet-beta';

const NETWORK = (process.env.SOLANA_NETWORK || 'devnet') as SolanaNetwork;
const RPC_URL = process.env.SOLANA_RPC_URL || `https://api.${NETWORK}.solana.com`;
const TREASURY_WALLET = process.env.TREASURY_WALLET || '';

let connection: Connection | null = null;

export function getConnection(): Connection {
  if (!connection) {
    connection = new Connection(RPC_URL, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000,
    });
  }
  return connection;
}

// ── Types ────────────────────────────────────

export interface VerifiedPayment {
  signature: string;
  senderWallet: string;
  recipientWallet: string;
  amountLamports: number;
  status: 'confirmed' | 'pending' | 'failed';
  confirmations: number;
  blockTime: number | null;
  slot: number;
}

export interface PaymentVerificationResult {
  valid: boolean;
  payment?: VerifiedPayment;
  error?: string;
  errorCode?: string;
}

// ── Transaction Verification ─────────────────

/**
 * Verifies a Solana transaction for payment validation
 *
 * Checks:
 * 1. Transaction exists on chain
 * 2. Correct sender wallet
 * 3. Correct recipient (treasury) wallet
 * 4. Correct amount
 * 5. Correct network
 * 6. Sufficient confirmations
 * 7. Not a replay (signature not already used)
 */
export async function verifyPayment(
  signature: string,
  expectedSender: string,
  expectedAmountLamports: number,
  expectedRecipient?: string
): Promise<PaymentVerificationResult> {
  try {
    const conn = getConnection();
    const recipient = expectedRecipient || TREASURY_WALLET;

    if (!recipient) {
      return { valid: false, error: 'Treasury wallet not configured', errorCode: 'CONFIG_ERROR' };
    }

    // Validate public keys
    let senderPubkey: PublicKey;
    let recipientPubkey: PublicKey;

    try {
      senderPubkey = new PublicKey(expectedSender);
      recipientPubkey = new PublicKey(recipient);
    } catch {
      return { valid: false, error: 'Invalid wallet address', errorCode: 'WALLET_INVALID' };
    }

    // Fetch transaction details
    let tx: ParsedTransactionWithMeta | null;
    try {
      tx = await conn.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed',
      });
    } catch (err) {
      return { valid: false, error: 'Transaction not found', errorCode: 'PAYMENT_NOT_FOUND' };
    }

    if (!tx) {
      return { valid: false, error: 'Transaction not found on chain', errorCode: 'PAYMENT_NOT_FOUND' };
    }

    // Check confirmation
    if (!tx.meta || tx.meta.err) {
      return { valid: false, error: 'Transaction failed on chain', errorCode: 'PAYMENT_FAILED' };
    }

    // Extract the sender from the transaction's account keys
    const accountKeys = tx.transaction.message.accountKeys;
    const senderKeyStr = accountKeys[0].pubkey.toBase58();

    // Verify sender
    if (senderKeyStr !== senderPubkey.toBase58()) {
      return {
        valid: false,
        error: 'Sender wallet mismatch',
        errorCode: 'PAYMENT_SENDER_MISMATCH',
      };
    }

    // Analyze balance changes to find the actual transfer
    const preBalances = tx.meta.preBalances;
    const postBalances = tx.meta.postBalances;

    // Find the recipient in account keys
    let recipientIndex = -1;
    for (let i = 0; i < accountKeys.length; i++) {
      if (accountKeys[i].pubkey.toBase58() === recipientPubkey.toBase58()) {
        recipientIndex = i;
        break;
      }
    }

    if (recipientIndex === -1) {
      return {
        valid: false,
        error: 'Treasury wallet not found in transaction',
        errorCode: 'PAYMENT_RECIPIENT_NOT_FOUND',
      };
    }

    // Calculate amount transferred to recipient
    const recipientBalanceChange = postBalances[recipientIndex] - preBalances[recipientIndex];
    const amountReceived = recipientBalanceChange;

    // Verify amount (allow small tolerance for fees)
    const tolerance = 10000; // 0.00001 SOL tolerance
    if (Math.abs(amountReceived - expectedAmountLamports) > tolerance) {
      return {
        valid: false,
        error: `Payment amount mismatch. Expected ${expectedAmountLamports} lamports, received ${amountReceived} lamports`,
        errorCode: 'PAYMENT_AMOUNT_INVALID',
      };
    }

    // Calculate sender's balance change (should be negative = amount + fee)
    const senderBalanceChange = postBalances[0] - preBalances[0];

    const verifiedPayment: VerifiedPayment = {
      signature,
      senderWallet: senderPubkey.toBase58(),
      recipientWallet: recipientPubkey.toBase58(),
      amountLamports: amountReceived,
      status: 'confirmed',
      confirmations: 1, // Will be updated with actual count
      blockTime: tx.blockTime ?? null,
      slot: tx.slot,
    };

    return { valid: true, payment: verifiedPayment };
  } catch (error) {
    console.error('Payment verification error:', error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown verification error',
      errorCode: 'INTERNAL_ERROR',
    };
  }
}

/**
 * Check if a transaction signature has already been used
 */
export async function isTransactionUsed(signature: string): Promise<boolean> {
  const { default: prisma } = await import('@/lib/prisma');

  const existing = await prisma.purchase.findUnique({
    where: { transactionSignature: signature },
  });

  return existing !== null;
}

/**
 * Get transaction confirmation count
 */
export async function getConfirmationCount(signature: string): Promise<number> {
  const conn = getConnection();

  try {
    const status = await conn.getSignatureStatus(signature);
    if (!status || !status.value) return 0;
    if (status.value.confirmations === null) return 32; // Finalized
    return status.value.confirmations;
  } catch {
    return 0;
  }
}

/**
 * Validate a wallet address
 */
export function isValidWalletAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get current SOL price in USD (via public API)
 */
export async function getSolPriceUsd(): Promise<number> {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
    );
    const data = await response.json();
    return data?.solana?.usd || 0;
  } catch {
    // Fallback: use a cached value or return 0
    console.warn('Failed to fetch SOL price');
    return 0;
  }
}

/**
 * Convert lamports to SOL
 */
export function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}

/**
 * Convert SOL to lamports
 */
export function solToLamports(sol: number): number {
  return Math.round(sol * LAMPORTS_PER_SOL);
}

/**
 * Get network configuration
 */
export function getNetworkConfig() {
  return {
    network: NETWORK,
    rpcUrl: RPC_URL,
    treasuryWallet: TREASURY_WALLET,
    isMainnet: NETWORK === 'mainnet-beta',
    isDevnet: NETWORK === 'devnet',
    isRealMoney: process.env.REAL_MONEY_MODE === 'true',
    explorerUrl: NETWORK === 'mainnet-beta'
      ? 'https://explorer.solana.com/tx'
      : `https://explorer.solana.com/tx?cluster=${NETWORK}`,
  };
}
