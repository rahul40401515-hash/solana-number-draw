/**
 * GET /api/game/current
 *
 * Returns the current active game round data
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import type { ApiResponse } from '@/types';

export async function GET(request: NextRequest) {
  try {
    // Find the current open round
    const round = await prisma.gameRound.findFirst({
      where: {
        status: { in: ['OPEN', 'CLOSING', 'DRAW_PENDING'] },
      },
      orderBy: { startAt: 'desc' },
      select: {
        id: true,
        roundNumber: true,
        title: true,
        description: true,
        status: true,
        startAt: true,
        endAt: true,
        entryPriceLamports: true,
        numberMin: true,
        numberMax: true,
        winnerCount: true,
        prizePoolLamports: true,
        totalEntries: true,
        operatorFeePercent: true,
        treasuryWallet: true,
        network: true,
        createdAt: true,
      },
    });

    if (!round) {
      // Check if there are any rounds at all
      const lastRound = await prisma.gameRound.findFirst({
        orderBy: { roundNumber: 'desc' },
        select: { status: true, roundNumber: true },
      });

      return NextResponse.json({
        success: true,
        data: {
          round: null,
          message: lastRound
            ? 'No active round. Next round starting soon.'
            : 'Welcome! The first round is being prepared.',
        },
      });
    }

    // Get stats
    const [availableCount, takenCount, reservedCount] = await Promise.all([
      prisma.number.count({ where: { roundId: round.id, status: 'AVAILABLE' } }),
      prisma.number.count({ where: { roundId: round.id, status: { in: ['PURCHASED', 'WINNER'] } } }),
      prisma.number.count({ where: { roundId: round.id, status: 'RESERVED' } }),
    ]);

    const totalNumbers = round.numberMax - round.numberMin + 1;

    return NextResponse.json({
      success: true,
      data: {
        round: {
          id: round.id,
          roundNumber: round.roundNumber,
          title: round.title || `Round #${String(round.roundNumber).padStart(3, '0')}`,
          status: round.status,
          startAt: round.startAt.toISOString(),
          endAt: round.endAt.toISOString(),
          entryPriceLamports: round.entryPriceLamports.toString(),
          numberMin: round.numberMin,
          numberMax: round.numberMax,
          winnerCount: round.winnerCount,
          prizePoolLamports: round.prizePoolLamports.toString(),
          totalEntries: round.totalEntries,
          operatorFeePercent: round.operatorFeePercent,
          treasuryWallet: round.treasuryWallet,
          network: round.network,
        },
        stats: {
          totalNumbers,
          available: availableCount,
          taken: takenCount,
          reserved: reservedCount,
          soldPercent: Math.round((takenCount / totalNumbers) * 100),
        },
      },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('Game current error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch game data' } },
      { status: 500 }
    );
  }
}
