/**
 * POST /api/auth/telegram
 *
 * Authenticate Telegram WebApp user and return a session token
 * Also creates/updates user in database
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateTelegramInitData, getDevUser } from '@/lib/telegram';
import prisma from '@/lib/prisma';
import type { ApiResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    let userData;

    if (process.env.NODE_ENV === 'development' && !process.env.TELEGRAM_BOT_TOKEN) {
      // Dev mode: use mock user
      userData = getDevUser();
    } else {
      // Production: validate Telegram initData
      const body = await request.json();
      const initData = body.initData;

      if (!initData) {
        return NextResponse.json(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'No Telegram authentication data' } },
          { status: 401 }
        );
      }

      try {
        userData = validateTelegramInitData(initData);
      } catch (error) {
        return NextResponse.json(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid Telegram authentication' } },
          { status: 401 }
        );
      }
    }

    const tgUser = userData.user;

    // Upsert user in database
    const user = await prisma.user.upsert({
      where: { telegramUserId: String(tgUser.id) },
      update: {
        telegramUsername: tgUser.username || null,
        firstName: tgUser.first_name || null,
        lastName: tgUser.last_name || null,
        profilePhotoUrl: tgUser.photo_url || null,
        languageCode: tgUser.language_code || null,
        updatedAt: new Date(),
      },
      create: {
        telegramUserId: String(tgUser.id),
        telegramUsername: tgUser.username || null,
        firstName: tgUser.first_name || null,
        lastName: tgUser.last_name || null,
        profilePhotoUrl: tgUser.photo_url || null,
        languageCode: tgUser.language_code || null,
      },
    });

    // Check if user is blocked
    if (user.isBlocked) {
      return NextResponse.json(
        { success: false, error: { code: 'USER_BLOCKED', message: 'Your account has been suspended' } },
        { status: 403 }
      );
    }

    // Create session token (simple JWT-like token for API auth)
    const token = Buffer.from(
      JSON.stringify({
        userId: user.id,
        telegramUserId: user.telegramUserId,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      })
    ).toString('base64');

    // Store session
    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || null,
      },
    });

    // Clean up old sessions for this user
    await prisma.session.deleteMany({
      where: {
        userId: user.id,
        expiresAt: { lt: new Date() },
      },
    });

    const response: ApiResponse = {
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          telegramUserId: user.telegramUserId,
          username: user.telegramUsername,
          firstName: user.firstName,
          lastName: user.lastName,
          walletAddress: user.walletAddress,
          isAdmin: user.isAdmin,
        },
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Authentication failed' } },
      { status: 500 }
    );
  }
}
