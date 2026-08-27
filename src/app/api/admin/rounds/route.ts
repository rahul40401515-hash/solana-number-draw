/**
 * Admin API Routes
 * POST /api/admin/rounds - Create new round
 * POST /api/admin/rounds/[id]/close - Close a round
 * POST /api/admin/draws/[id]/execute - Execute draw
 * POST /api/admin/payouts/[id]/execute - Execute payouts
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { initializeRoundNumbers, closeRound, executeRoundDraw } from '@/lib/game';
import type { ApiResponse } from '@/types';

// ── POST /api/admin/rounds ───────────────────

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;

  try {
    const body = await request.json();
    const {
      roundNumber,
      title,
      description,
      startAt,
      endAt,
      entryPriceLamports,
      numberMin = 1,
      numberMax = 5000,
      winnerCount = 5,
      operatorFeePercent = 0,
      minEntries = 1,
      maxEntries,
      adminWinsUnclaimed = true,
    } = body;

    if (!roundNumber || !startAt || !endAt || !entryPriceLamports) {
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Missing required fields' } },
        { status: 400 }
      );
    }

    // Check if round number is unique
    const existing = await prisma.gameRound.findUnique({
      where: { roundNumber },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: `Round #${roundNumber} already exists` } },
        { status: 409 }
      );
    }

    // Create the round
    const round = await prisma.gameRound.create({
      data: {
        roundNumber,
        title,
        description,
        startAt: new Date(startAt),
        endAt: new Date(endAt),
        entryPriceLamports: BigInt(entryPriceLamports),
        numberMin,
        numberMax,
        winnerCount,
        operatorFeePercent,
        minEntries,
        maxEntries: maxEntries || null,
        adminWinsUnclaimed,
        treasuryWallet: process.env.TREASURY_WALLET || '',
        network: process.env.SOLANA_NETWORK || 'devnet',
        status: 'DRAFT',
      },
    });

    // Initialize all numbers for this round
    await initializeRoundNumbers(round.id, numberMin, numberMax);

    // Log the creation
    await prisma.auditLog.create({
      data: {
        roundId: round.id,
        eventType: 'ROUND_CREATED',
        actor: typeof admin === 'string' ? admin : admin.id,
        actorType: 'admin',
        data: { roundNumber, numberMin, numberMax, winnerCount, entryPriceLamports },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: round.id,
        roundNumber: round.roundNumber,
        status: round.status,
        totalNumbers: numberMax - numberMin + 1,
      },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('Create round error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create round' } },
      { status: 500 }
    );
  }
}

// ── GET /api/admin/rounds (Dashboard) ────────

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;

  try {
    const rounds = await prisma.gameRound.findMany({
      orderBy: { roundNumber: 'desc' },
      take: 20,
      select: {
        id: true,
        roundNumber: true,
        title: true,
        status: true,
        startAt: true,
        endAt: true,
        entryPriceLamports: true,
        totalEntries: true,
        prizePoolLamports: true,
        winnerCount: true,
        createdAt: true,
      },
    });

    // Dashboard stats
    const [
      totalUsers,
      totalPurchases,
      activeReservations,
      pendingPayouts,
      completedRounds,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.purchase.count({ where: { status: 'CONFIRMED' } }),
      prisma.number.count({ where: { status: 'RESERVED' } }),
      prisma.winner.count({ where: { status: { in: ['SELECTED', 'PENDING_PAYOUT'] } } }),
      prisma.gameRound.count({ where: { status: 'COMPLETED' } }),
    ]);

    const currentRound = rounds.find((r) => ['OPEN', 'CLOSING', 'DRAW_PENDING'].includes(r.status));
    const totalPrizePool = currentRound
      ? currentRound.prizePoolLamports.toString()
      : '0';

    return NextResponse.json({
      success: true,
      data: {
        rounds: rounds.map((r) => ({
          ...r,
          entryPriceLamports: r.entryPriceLamports.toString(),
          prizePoolLamports: r.prizePoolLamports.toString(),
        })),
        stats: {
          totalUsers,
          totalPurchases,
          activeReservations,
          pendingPayouts,
          completedRounds,
          totalPrizePool,
        },
      },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('Admin dashboard error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to load dashboard' } },
      { status: 500 }
    );
  }
}
