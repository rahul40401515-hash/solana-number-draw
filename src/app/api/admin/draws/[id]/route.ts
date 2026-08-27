/**
 * POST /api/admin/draws/[id]/execute
 *
 * Execute the draw for a closed round
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { executeRoundDraw } from '@/lib/game';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;

  try {
    const roundId = params.id;

    const result = await executeRoundDraw(roundId);

    return NextResponse.json({
      success: true,
      data: {
        winners: result.winners.map((w) => ({
          rank: w.rank,
          number: w.number,
          userId: w.userId,
        })),
        snapshotHash: result.snapshotHash,
        randomnessValue: result.randomnessValue,
        message: `Draw completed! ${result.winners.length} winners selected.`,
      },
    });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      const gameError = error as { code: string; message: string };
      return NextResponse.json(
        { success: false, error: { code: gameError.code, message: gameError.message } },
        { status: 400 }
      );
    }

    console.error('Execute draw error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to execute draw' } },
      { status: 500 }
    );
  }
}
