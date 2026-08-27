/**
 * GET /api/game/my-entries
 *
 * Get the authenticated user's entries and profile
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticateUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // In development, use mock user if no auth
    let userId: string;

    if (process.env.NODE_ENV === 'development') {
      const user = await authenticateUser(request);
      if (user) {
        userId = user.id;
      } else {
        // Dev fallback: get first user
        const firstUser = await prisma.user.findFirst();
        if (!firstUser) {
          return NextResponse.json({
            success: true,
            data: {
              user: { id: 'dev', username: 'dev_user', firstName: 'Dev', walletAddress: null },
              entries: [],
              totalSpent: '0',
            },
          });
        }
        userId = firstUser.id;
      }
    } else {
      const user = await authenticateUser(request);
      if (!user) {
        return NextResponse.json(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
          { status: 401 }
        );
      }
      userId = user.id;
    }

    // Get user data
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        telegramUsername: true,
        firstName: true,
        walletAddress: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'User not found' } },
        { status: 404 }
      );
    }

    // Get current round
    const currentRound = await prisma.gameRound.findFirst({
      where: { status: { in: ['OPEN', 'CLOSING', 'DRAW_PENDING'] } },
      orderBy: { startAt: 'desc' },
    });

    // Get user's entries in current round
    let entries: any[] = [];
    let totalSpent = BigInt(0);

    if (currentRound) {
      entries = await prisma.number.findMany({
        where: {
          roundId: currentRound.id,
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

      // Calculate total spent
      const purchases = await prisma.purchase.findMany({
        where: {
          roundId: currentRound.id,
          userId,
          status: 'CONFIRMED',
        },
        select: { amountLamports: true },
      });

      totalSpent = purchases.reduce((sum, p) => sum + p.amountLamports, BigInt(0));
    }

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: dbUser.id,
          username: dbUser.telegramUsername,
          firstName: dbUser.firstName,
          walletAddress: dbUser.walletAddress,
        },
        entries: entries.map((e) => ({
          numberValue: e.numberValue,
          status: e.status,
          purchasedAt: e.purchasedAt?.toISOString() || null,
        })),
        totalSpent: totalSpent.toString(),
      },
    });
  } catch (error) {
    console.error('My entries error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch entries' } },
      { status: 500 }
    );
  }
}
