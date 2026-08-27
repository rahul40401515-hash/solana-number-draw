/**
 * GET /api/draw/:id
 * GET /api/draw/:id/verify
 *
 * Draw information and verification endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import type { ApiResponse } from '@/types';
import { lamportsToSol } from '@/types';

// ── GET /api/draw/:id ────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const roundId = params.id;

    const round = await prisma.gameRound.findUnique({
      where: { id: roundId },
      include: {
        draws: {
          select: {
            id: true,
            randomnessProvider: true,
            commitment: true,
            randomnessValue: true,
            snapshotHash: true,
            verificationData: true,
            status: true,
            generatedAt: true,
          },
        },
        winners: {
          orderBy: { rank: 'asc' },
          include: {
            user: {
              select: {
                telegramUsername: true,
                firstName: true,
              },
            },
          },
        },
      },
    });

    if (!round) {
      return NextResponse.json(
        { success: false, error: { code: 'ROUND_NOT_FOUND', message: 'Round not found' } },
        { status: 404 }
      );
    }

    const totalPool = Number(round.prizePoolLamports);
    const winnerCount = round.winnerCount;
    const prizePerWinner = winnerCount > 0 ? totalPool / winnerCount : 0;

    return NextResponse.json({
      success: true,
      data: {
        round: {
          id: round.id,
          roundNumber: round.roundNumber,
          status: round.status,
          prizePoolLamports: round.prizePoolLamports.toString(),
          prizePoolSol: lamportsToSol(round.prizePoolLamports.toString()).toFixed(4),
          totalEntries: round.totalEntries,
          winnerCount,
          prizePerWinnerLamports: prizePerWinner.toString(),
          completedAt: round.completedAt?.toISOString(),
        },
        draw: round.draws[0] ? {
          id: round.draws[0].id,
          provider: round.draws[0].randomnessProvider,
          status: round.draws[0].status,
          snapshotHash: round.draws[0].snapshotHash,
          randomnessValue: round.draws[0].randomnessValue,
          commitment: round.draws[0].commitment,
          generatedAt: round.draws[0].generatedAt?.toISOString(),
          verificationData: round.draws[0].verificationData,
        } : null,
        winners: round.winners.map((w) => ({
          rank: w.rank,
          number: w.number,
          prizeLamports: w.prizeLamports.toString(),
          username: w.user.telegramUsername || `${w.user.firstName || 'Player'}`,
          walletAddress: w.payoutWallet ? shortenAddr(w.payoutWallet) : null,
          status: w.status,
          payoutTransaction: w.payoutTransaction,
        })),
      },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('Draw fetch error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch draw data' } },
      { status: 500 }
    );
  }
}

// ── Utility ──────────────────────────────────

function shortenAddr(addr: string): string {
  if (!addr || addr.length < 8) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}
