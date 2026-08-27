/**
 * POST /api/purchases/verify
 *
 * Verify a Solana payment transaction and confirm the number purchase
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticateUser } from '@/lib/auth';
import { verifyPayment, isTransactionUsed, isValidWalletAddress } from '@/lib/solana';
import { confirmPurchase } from '@/lib/game';
import type { ApiResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await authenticateUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { roundId, number: numberValue, transactionSignature, walletAddress } = body;

    // Validate inputs
    if (!roundId || !numberValue || !transactionSignature || !walletAddress) {
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Missing required fields' } },
        { status: 400 }
      );
    }

    if (!isValidWalletAddress(walletAddress)) {
      return NextResponse.json(
        { success: false, error: { code: 'WALLET_INVALID', message: 'Invalid wallet address' } },
        { status: 400 }
      );
    }

    // Check if transaction already used (replay protection)
    const txUsed = await isTransactionUsed(transactionSignature);
    if (txUsed) {
      return NextResponse.json(
        { success: false, error: { code: 'PAYMENT_ALREADY_USED', message: 'This transaction has already been used' } },
        { status: 409 }
      );
    }

    // Get round info for price
    const round = await prisma.gameRound.findUnique({
      where: { id: roundId },
      select: { entryPriceLamports: true, status: true, treasuryWallet: true },
    });

    if (!round) {
      return NextResponse.json(
        { success: false, error: { code: 'ROUND_NOT_FOUND', message: 'Round not found' } },
        { status: 404 }
      );
    }

    if (round.status !== 'OPEN' && round.status !== 'CLOSING') {
      return NextResponse.json(
        { success: false, error: { code: 'ROUND_CLOSED', message: 'Round is not accepting entries' } },
        { status: 400 }
      );
    }

    // Verify the blockchain transaction
    const verification = await verifyPayment(
      transactionSignature,
      walletAddress,
      Number(round.entryPriceLamports),
      round.treasuryWallet
    );

    if (!verification.valid) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: verification.errorCode || 'PAYMENT_NOT_FOUND',
            message: verification.error || 'Payment verification failed',
          },
        },
        { status: 400 }
      );
    }

    // Verify sender matches authenticated user's wallet
    if (user.walletAddress && verification.payment?.senderWallet !== user.walletAddress) {
      return NextResponse.json(
        { success: false, error: { code: 'PAYMENT_SENDER_MISMATCH', message: 'Wallet address mismatch' } },
        { status: 403 }
      );
    }

    // Confirm the purchase (atomic operation)
    await confirmPurchase(
      roundId,
      numberValue,
      user.id,
      walletAddress,
      transactionSignature,
      round.entryPriceLamports
    );

    // Update user's wallet address if not set
    if (!user.walletAddress) {
      await prisma.user.update({
        where: { id: user.id },
        data: { walletAddress },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        number: numberValue,
        transactionSignature,
        amountLamports: round.entryPriceLamports.toString(),
        status: 'CONFIRMED',
        message: `Number ${numberValue} successfully purchased!`,
      },
    } satisfies ApiResponse);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      const gameError = error as { code: string; message: string };
      return NextResponse.json(
        { success: false, error: { code: gameError.code, message: gameError.message } },
        { status: 400 }
      );
    }

    console.error('Purchase verification error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Payment verification failed' } },
      { status: 500 }
    );
  }
}
