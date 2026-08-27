/**
 * GET  /api/numbers?roundId=xxx&page=1&filter=available
 * POST /api/numbers/reserve
 *
 * Number grid listing and reservation endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { reserveNumber, releaseReservation } from '@/lib/game';
import { authenticateUser } from '@/lib/auth';
import type { ApiResponse } from '@/types';

// ── GET: Number Grid ─────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roundId = searchParams.get('roundId');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '200');
    const filter = searchParams.get('filter') as string | null;
    const search = searchParams.get('search');

    if (!roundId) {
      return NextResponse.json(
        { success: false, error: { code: 'ROUND_NOT_FOUND', message: 'Round ID is required' } },
        { status: 400 }
      );
    }

    // Build query
    const where: any = { roundId };

    if (filter) {
      switch (filter) {
        case 'available':
          where.status = 'AVAILABLE';
          break;
        case 'taken':
          where.status = { in: ['PURCHASED', 'WINNER'] };
          break;
        case 'reserved':
          where.status = 'RESERVED';
          break;
      }
    }

    if (search) {
      const searchNum = parseInt(search);
      if (!isNaN(searchNum)) {
        where.numberValue = searchNum;
      }
    }

    const [numbers, total, roundStats] = await Promise.all([
      prisma.number.findMany({
        where,
        select: {
          numberValue: true,
          status: true,
        },
        orderBy: { numberValue: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.number.count({ where }),
      prisma.number.groupBy({
        by: ['status'],
        where: { roundId },
        _count: true,
      }),
    ]);

    const stats = {
      available: roundStats.find((s) => s.status === 'AVAILABLE')?._count || 0,
      reserved: roundStats.find((s) => s.status === 'RESERVED')?._count || 0,
      purchased: roundStats.find((s) => s.status === 'PURCHASED')?._count || 0,
      winner: roundStats.find((s) => s.status === 'WINNER')?._count || 0,
    };

    return NextResponse.json({
      success: true,
      data: {
        numbers: numbers.map((n) => ({
          value: n.numberValue,
          status: n.status,
        })),
        stats,
        total,
        page,
        pageSize,
        hasMore: page * pageSize < total,
      },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('Numbers GET error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch numbers' } },
      { status: 500 }
    );
  }
}

// ── POST: Reserve Number ─────────────────────

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
    const { roundId, number } = body;

    if (!roundId || !number) {
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Round ID and number are required' } },
        { status: 400 }
      );
    }

    if (typeof number !== 'number' || !Number.isInteger(number) || number < 1) {
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Invalid number value' } },
        { status: 400 }
      );
    }

    // Reserve the number
    const result = await reserveNumber(roundId, number, user.id);

    return NextResponse.json({
      success: true,
      data: {
        reservationId: result.id,
        number,
        expiresAt: result.expiresAt.toISOString(),
      },
    } satisfies ApiResponse);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      const gameError = error as { code: string; message: string };
      const statusMap: Record<string, number> = {
        NUMBER_ALREADY_TAKEN: 409,
        NUMBER_ALREADY_RESERVED: 409,
        ROUND_CLOSED: 400,
        ROUND_NOT_STARTED: 400,
        ROUND_NOT_FOUND: 404,
        USER_BLOCKED: 403,
      };

      return NextResponse.json(
        { success: false, error: { code: gameError.code, message: gameError.message } },
        { status: statusMap[gameError.code] || 500 }
      );
    }

    console.error('Reserve number error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to reserve number' } },
      { status: 500 }
    );
  }
}

// ── DELETE: Release Reservation ───────────────

export async function DELETE(request: NextRequest) {
  try {
    const user = await authenticateUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const roundId = searchParams.get('roundId');
    const number = parseInt(searchParams.get('number') || '0');

    if (!roundId || !number) {
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Round ID and number are required' } },
        { status: 400 }
      );
    }

    await releaseReservation(roundId, number, user.id);

    return NextResponse.json({ success: true } satisfies ApiResponse);
  } catch (error) {
    console.error('Release reservation error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to release reservation' } },
      { status: 500 }
    );
  }
}
