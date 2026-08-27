/**
 * GET /api/results/:id
 *
 * Get results for a completed round
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { lamportsToSol } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const roundId = params.id;

    const round = await prisma.gameRound.findUnique({
      where: { id: roundId },
      select: {
        id: true,
        roundNumber: true,
        title: true,
        status: true,
        prizePoolLamports: true,
        totalEntries: true,
        numberMin: true,
        numberMax: true,
        winnerCount: true,
        operatorFeeLamports: true,
        completedAt: true,
        network: true,
      },
    });

    if (!round) {
      return NextResponse.json(
        { success: false, error: { code: 'ROUND_NOT_FOUND', message: 'Round not found' } },
        { status: 404 }
      );
    }

    if (round.status !== 'COMPLETED') {
      return NextResponse.json(
        { success: false, error: { code: 'DRAW_NOT_READY', message: 'Round is not yet completed' } },
        { status: 400 }
      );
    }

    const winners = await prisma.winner.findMany({
      where: { roundId },
      orderBy: { rank: 'asc' },
      include: {
        user: {
          select: {
            telegramUsername: true,
            firstName: true,
            walletAddress: true,
          },
        },
      },
    });

    const draw = await prisma.randomnessDraw.findUnique({
      where: { roundId },
    });

    const prizePool = lamportsToSol(round.prizePoolLamports.toString());
    const prizePerWinner = winners.length > 0
      ? lamportsToSol(winners[0].prizeLamports.toString())
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        round: {
          id: round.id,
          roundNumber: round.roundNumber,
          title: round.title || `Round #${String(round.roundNumber).padStart(3, '0')}`,
          status: round.status,
          prizePoolSol: prizePool.toFixed(4),
          prizePoolLamports: round.prizePoolLamports.toString(),
          totalEntries: round.totalEntries,
          numberRange: `${round.numberMin}-${round.numberMax}`,
          winnerCount: round.winnerCount,
          operatorFeeSol: lamportsToSol(round.operatorFeeLamports.toString()).toFixed(4),
          completedAt: round.completedAt?.toISOString(),
          network: round.network,
        },
        winners: winners.map((w) => ({
          rank: w.rank,
          number: w.number,
          username: w.user.telegramUsername || w.user.firstName || 'Anonymous',
          prizeSol: lamportsToSol(w.prizeLamports.toString()).toFixed(4),
          prizeLamports: w.prizeLamports.toString(),
          walletAddress: w.payoutWallet,
          status: w.status,
          payoutTransaction: w.payoutTransaction,
        })),
        verification: draw ? {
          provider: draw.randomnessProvider,
          snapshotHash: draw.snapshotHash,
          randomnessValue: draw.randomnessValue,
          commitment: draw.commitment,
          generatedAt: draw.generatedAt?.toISOString(),
          algorithm: (draw.verificationData as any)?.algorithm || 'SHA-256',
        } : null,
      },
    });
  } catch (error) {
    console.error('Results error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch results' } },
      { status: 500 }
    );
  }
}
