/**
 * POST /api/admin/rounds/[id]
 *
 * Round management: open, pause, close, cancel
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { closeRound } from '@/lib/game';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;

  try {
    const { action } = await request.json();
    const roundId = params.id;

    const round = await prisma.gameRound.findUnique({ where: { id: roundId } });
    if (!round) {
      return NextResponse.json(
        { success: false, error: { code: 'ROUND_NOT_FOUND', message: 'Round not found' } },
        { status: 404 }
      );
    }

    switch (action) {
      case 'open': {
        if (round.status !== 'DRAFT') {
          return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Can only open DRAFT rounds' } },
            { status: 400 }
          );
        }
        await prisma.gameRound.update({
          where: { id: roundId },
          data: { status: 'OPEN' },
        });
        await prisma.auditLog.create({
          data: { roundId, eventType: 'ROUND_OPENED', actor: 'admin', actorType: 'admin' },
        });
        break;
      }

      case 'pause': {
        if (round.status !== 'OPEN') {
          return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Can only pause OPEN rounds' } },
            { status: 400 }
          );
        }
        await prisma.gameRound.update({
          where: { id: roundId },
          data: { status: 'PAUSED' },
        });
        await prisma.auditLog.create({
          data: { roundId, eventType: 'ROUND_PAUSED', actor: 'admin', actorType: 'admin' },
        });
        break;
      }

      case 'resume': {
        if (round.status !== 'PAUSED') {
          return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Can only resume PAUSED rounds' } },
            { status: 400 }
          );
        }
        await prisma.gameRound.update({
          where: { id: roundId },
          data: { status: 'OPEN' },
        });
        await prisma.auditLog.create({
          data: { roundId, eventType: 'ROUND_RESUMED', actor: 'admin', actorType: 'admin' },
        });
        break;
      }

      case 'close': {
        await closeRound(roundId);
        break;
      }

      case 'cancel': {
        await prisma.gameRound.update({
          where: { id: roundId },
          data: { status: 'CANCELLED', cancelledAt: new Date() },
        });
        await prisma.auditLog.create({
          data: { roundId, eventType: 'ROUND_CANCELLED', actor: 'admin', actorType: 'admin' },
        });
        break;
      }

      default:
        return NextResponse.json(
          { success: false, error: { code: 'INTERNAL_ERROR', message: 'Invalid action' } },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true, data: { action } });
  } catch (error) {
    console.error('Round action error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to perform action' } },
      { status: 500 }
    );
  }
}
