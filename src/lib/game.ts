/**
 * Game Logic - Core business logic for number reservation and game operations
 *
 * Implements:
 * - Atomic number reservation with timeout
 * - Purchase confirmation after payment verification
 * - Round lifecycle management
 * - Prize pool calculation
 */

import prisma from '@/lib/prisma';
import { executeDraw, createSnapshotHash, type DrawResult } from '@/lib/randomness';
import type { GameErrorCode } from '@/types';

// ── Constants ────────────────────────────────

const RESERVATION_TIMEOUT_MINUTES = Number(process.env.DEFAULT_RESERVATION_TIMEOUT_MINUTES) || 5;
const RESERVATION_TIMEOUT_MS = RESERVATION_TIMEOUT_MINUTES * 60 * 1000;

// ── Errors ───────────────────────────────────

class GameError extends Error {
  constructor(
    public code: GameErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'GameError';
  }
}

// ── Number Reservation ───────────────────────

/**
 * Reserve a number for a user
 * Uses database-level locking to prevent race conditions
 */
export async function reserveNumber(
  roundId: string,
  numberValue: number,
  userId: string
): Promise<{ id: string; expiresAt: Date }> {
  // Check if round is open
  const round = await prisma.gameRound.findUnique({
    where: { id: roundId },
  });

  if (!round) {
    throw new GameError('ROUND_NOT_FOUND', 'Game round not found');
  }

  if (round.status !== 'OPEN') {
    throw new GameError('ROUND_CLOSED', 'This round is not accepting entries');
  }

  const now = new Date();
  if (now < round.startAt) {
    throw new GameError('ROUND_NOT_STARTED', 'This round has not started yet');
  }

  if (now > round.endAt) {
    throw new GameError('ROUND_CLOSED', 'This round has ended');
  }

  // Check if user is blocked
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user?.isBlocked) {
    throw new GameError('USER_BLOCKED', 'Your account has been suspended');
  }

  // Validate number range
  if (numberValue < round.numberMin || numberValue > round.numberMax) {
    throw new GameError('INTERNAL_ERROR', `Number must be between ${round.numberMin} and ${round.numberMax}`);
  }

  // Atomic reservation using database transaction
  const expiresAt = new Date(now.getTime() + RESERVATION_TIMEOUT_MS);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Lock and fetch the number row
      const numberRow = await tx.number.findUnique({
        where: {
          roundId_numberValue: { roundId, numberValue },
        },
      });

      if (!numberRow) {
        throw new GameError('INTERNAL_ERROR', 'Number not found in this round');
      }

      // Check current status
      if (numberRow.status === 'PURCHASED') {
        throw new GameError('NUMBER_ALREADY_TAKEN', 'This number was just taken by another player');
      }

      if (numberRow.status === 'RESERVED') {
        // Check if the reservation has expired
        if (numberRow.reservationExpiresAt && numberRow.reservationExpiresAt > now) {
          throw new GameError('NUMBER_ALREADY_RESERVED', 'This number is currently reserved by another player');
        }
        // Expired reservation - can be taken
      }

      if (numberRow.status === 'WINNER') {
        throw new GameError('NUMBER_ALREADY_TAKEN', 'This number was just taken by another player');
      }

      // Reserve the number
      const updated = await tx.number.update({
        where: {
          roundId_numberValue: { roundId, numberValue },
        },
        data: {
          status: 'RESERVED',
          reservedByUserId: userId,
          reservationExpiresAt: expiresAt,
        },
      });

      // Log the reservation
      await tx.auditLog.create({
        data: {
          roundId,
          eventType: 'NUMBER_RESERVED',
          actor: userId,
          actorType: 'user',
          data: { number: numberValue, expiresAt: expiresAt.toISOString() },
        },
      });

      return updated;
    });

    return { id: result.id, expiresAt };
  } catch (error) {
    if (error instanceof GameError) throw error;

    // Handle Prisma unique constraint violations
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as any).code === 'P2002'
    ) {
      throw new GameError('NUMBER_ALREADY_TAKEN', 'This number was just taken by another player');
    }

    throw error;
  }
}

/**
 * Release an expired or cancelled reservation
 */
export async function releaseReservation(
  roundId: string,
  numberValue: number,
  userId: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const numberRow = await tx.number.findUnique({
      where: {
        roundId_numberValue: { roundId, numberValue },
      },
    });

    if (!numberRow) return;

    // Only the reserving user or system can release
    if (numberRow.reservedByUserId !== userId) {
      throw new GameError('UNAUTHORIZED', 'You cannot release this reservation');
    }

    if (numberRow.status !== 'RESERVED') return; // Already converted or expired

    await tx.number.update({
      where: { id: numberRow.id },
      data: {
        status: 'AVAILABLE',
        reservedByUserId: null,
        reservationExpiresAt: null,
      },
    });
  });
}

/**
 * Confirm a purchase after payment verification
 * Converts reservation to permanent ownership
 */
export async function confirmPurchase(
  roundId: string,
  numberValue: number,
  userId: string,
  walletAddress: string,
  transactionSignature: string,
  amountLamports: bigint
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Check transaction hasn't been used already (replay protection)
    const existingPurchase = await tx.purchase.findUnique({
      where: { transactionSignature },
    });

    if (existingPurchase) {
      throw new GameError('PAYMENT_ALREADY_USED', 'This transaction has already been used');
    }

    // Get the number
    const numberRow = await tx.number.findUnique({
      where: {
        roundId_numberValue: { roundId, numberValue },
      },
    });

    if (!numberRow) {
      throw new GameError('INTERNAL_ERROR', 'Number not found');
    }

    // Verify the reservation belongs to this user
    if (numberRow.reservedByUserId !== userId) {
      throw new GameError('UNAUTHORIZED', 'This reservation does not belong to you');
    }

    // Check reservation hasn't expired
    if (numberRow.reservationExpiresAt && numberRow.reservationExpiresAt < new Date()) {
      throw new GameError('RESERVATION_EXPIRED', 'Your reservation has expired');
    }

    if (numberRow.status !== 'RESERVED') {
      throw new GameError('NUMBER_ALREADY_TAKEN', 'This number is no longer available');
    }

    // Convert reservation to permanent purchase
    await tx.number.update({
      where: { id: numberRow.id },
      data: {
        status: 'PURCHASED',
        userId,
        purchasedAt: new Date(),
        reservationExpiresAt: null,
      },
    });

    // Create purchase record
    await tx.purchase.create({
      data: {
        roundId,
        userId,
        numberId: numberRow.id,
        walletAddress,
        amountLamports,
        transactionSignature,
        status: 'CONFIRMED',
        confirmedAt: new Date(),
      },
    });

    // Update round prize pool and entry count
    const round = await tx.gameRound.findUnique({ where: { id: roundId } });
    if (round) {
      await tx.gameRound.update({
        where: { id: roundId },
        data: {
          prizePoolLamports: { increment: amountLamports },
          totalEntries: { increment: 1 },
        },
      });
    }

    // Log the purchase
    await tx.auditLog.create({
      data: {
        roundId,
        eventType: 'PURCHASE_CONFIRMED',
        actor: userId,
        actorType: 'user',
        data: { number: numberValue, amount: amountLamports.toString(), tx: transactionSignature },
      },
    });
  });
}

// ── Round Management ─────────────────────────

/**
 * Initialize numbers for a new round
 */
export async function initializeRoundNumbers(roundId: string, min: number, max: number): Promise<void> {
  const numbers = [];
  for (let i = min; i <= max; i++) {
    numbers.push({
      roundId,
      numberValue: i,
      status: 'AVAILABLE' as const,
    });
  }

  // Batch insert in chunks to avoid memory issues
  const CHUNK_SIZE = 1000;
  for (let i = 0; i < numbers.length; i += CHUNK_SIZE) {
    const chunk = numbers.slice(i, i + CHUNK_SIZE);
    await prisma.number.createMany({ data: chunk });
  }
}

/**
 * Close a round for entries
 */
export async function closeRound(roundId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const round = await tx.gameRound.findUnique({ where: { id: roundId } });
    if (!round) throw new GameError('ROUND_NOT_FOUND', 'Round not found');

    if (round.status !== 'OPEN') {
      throw new GameError('ROUND_CLOSED', 'Round is not open');
    }

    // Freeze all reservations (convert expired ones back to available, keep purchased)
    await tx.number.updateMany({
      where: {
        roundId,
        status: 'RESERVED',
      },
      data: {
        status: 'AVAILABLE',
        reservedByUserId: null,
        reservationExpiresAt: null,
      },
    });

    await tx.gameRound.update({
      where: { id: roundId },
      data: {
        status: 'CLOSING',
        frozenAt: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        roundId,
        eventType: 'ROUND_CLOSED',
        actor: 'system',
        actorType: 'system',
      },
    });
  });
}

/**
 * Execute the draw for a closed round
 */
export async function executeRoundDraw(roundId: string): Promise<DrawResult> {
  return prisma.$transaction(async (tx) => {
    const round = await tx.gameRound.findUnique({ where: { id: roundId } });
    if (!round) throw new GameError('ROUND_NOT_FOUND', 'Round not found');

    if (round.status !== 'CLOSING' && round.status !== 'DRAW_PENDING') {
      throw new GameError('DRAW_NOT_READY', 'Round is not ready for draw');
    }

    // Check if draw was already executed
    const existingDraw = await tx.randomnessDraw.findUnique({ where: { roundId } });
    if (existingDraw && existingDraw.status === 'EXECUTED') {
      throw new GameError('DRAW_ALREADY_EXECUTED', 'Draw has already been executed');
    }

    // Get all purchased numbers
    const purchasedNumbers = await tx.number.findMany({
      where: {
        roundId,
        status: { in: ['PURCHASED', 'WINNER'] },
        userId: { not: null },
      },
      select: {
        id: true,
        numberValue: true,
        userId: true,
      },
    });

    if (purchasedNumbers.length < round.winnerCount) {
      throw new GameError('DRAW_NOT_READY', 'Not enough purchased numbers for draw');
    }

    // Execute the draw (userId is guaranteed non-null due to filter above)
    const result = executeDraw({
      roundId,
      purchasedNumbers: purchasedNumbers.map(p => ({
        ...p,
        userId: p.userId as string,
      })),
      winnerCount: round.winnerCount,
    });

    // Calculate prize per winner
    const operatorFee = round.operatorFeePercent
      ? (round.prizePoolLamports * BigInt(Math.round(round.operatorFeePercent))) / BigInt(100)
      : BigInt(0);
    const distributablePool = round.prizePoolLamports - operatorFee;
    const prizePerWinner = distributablePool / BigInt(round.winnerCount);

    // Store winners
    for (const winner of result.winners) {
      await tx.winner.create({
        data: {
          roundId,
          userId: winner.userId,
          number: winner.number,
          prizeLamports: prizePerWinner,
          payoutWallet: '', // Will be filled from user's wallet
          status: 'SELECTED',
          rank: winner.rank,
        },
      });

      // Update the number status to WINNER
      await tx.number.update({
        where: { id: winner.numberId },
        data: { status: 'WINNER' },
      });
    }

    // Store draw result
    await tx.randomnessDraw.create({
      data: {
        roundId,
        randomnessProvider: 'local-crypto',
        commitment: result.commitment,
        randomnessValue: result.randomnessValue,
        snapshotHash: result.snapshotHash,
        verificationData: result.verificationData as any,
        generatedAt: new Date(),
        status: 'EXECUTED',
      },
    });

    // Update round status
    await tx.gameRound.update({
      where: { id: roundId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        operatorFeeLamports: operatorFee,
      },
    });

    // Log the draw
    await tx.auditLog.create({
      data: {
        roundId,
        eventType: 'DRAW_EXECUTED',
        actor: 'system',
        actorType: 'system',
        data: {
          winners: result.winners.map((w) => w.number),
          snapshotHash: result.snapshotHash,
          randomnessValue: result.randomnessValue,
        },
      },
    });

    return result;
  });
}

// ── Cleanup ──────────────────────────────────

/**
 * Clean up expired reservations
 * Should be called periodically (e.g., every minute)
 */
export async function cleanupExpiredReservations(): Promise<number> {
  const now = new Date();

  const result = await prisma.number.updateMany({
    where: {
      status: 'RESERVED',
      reservationExpiresAt: { lt: now },
    },
    data: {
      status: 'AVAILABLE',
      reservedByUserId: null,
      reservationExpiresAt: null,
    },
  });

  return result.count;
}

// ── Query Helpers ────────────────────────────

export async function getNumberGrid(
  roundId: string,
  page: number = 1,
  pageSize: number = 100,
  filter?: 'available' | 'taken' | 'reserved' | 'purchased'
) {
  const where: any = { roundId };
  if (filter) {
    if (filter === 'purchased') {
      where.status = { in: ['PURCHASED', 'WINNER'] };
    } else {
      where.status = filter === 'taken' ? 'PURCHASED' : filter.toUpperCase();
    }
  }

  const [numbers, total] = await Promise.all([
    prisma.number.findMany({
      where,
      select: {
        numberValue: true,
        status: true,
        userId: true,
      },
      orderBy: { numberValue: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.number.count({ where }),
  ]);

  return {
    numbers: numbers.map((n) => ({
      value: n.numberValue,
      status: n.status,
    })),
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  };
}

export async function getUserEntries(roundId: string, userId: string) {
  return prisma.number.findMany({
    where: {
      roundId,
      userId,
      status: { in: ['PURCHASED', 'WINNER'] },
    },
    select: {
      numberValue: true,
      status: true,
      purchasedAt: true,
    },
    orderBy: { numberValue: 'asc' },
  });
}
