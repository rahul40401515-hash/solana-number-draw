/**
 * Authentication helpers
 * Validates session tokens and returns user data
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';

interface AuthUser {
  id: string;
  telegramUserId: string;
  telegramUsername: string | null;
  firstName: string | null;
  lastName: string | null;
  walletAddress: string | null;
  isAdmin: boolean;
  isBlocked: boolean;
}

/**
 * Extract and validate user from request authorization
 * Supports both Telegram initData and session token auth
 */
export async function authenticateUser(request: NextRequest): Promise<AuthUser | null> {
  try {
    // Check for session token in Authorization header
    const authHeader = request.headers.get('authorization');
    const sessionToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    if (sessionToken) {
      return authenticateWithSession(sessionToken);
    }

    // Check for Telegram initData
    const tgInitData = request.headers.get('x-telegram-init-data');
    if (tgInitData) {
      return authenticateWithTelegram(tgInitData);
    }

    return null;
  } catch (error) {
    console.error('Auth error:', error);
    return null;
  }
}

/**
 * Authenticate with session token
 */
async function authenticateWithSession(token: string): Promise<AuthUser | null> {
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session) return null;
  if (session.expiresAt < new Date()) {
    // Clean up expired session
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  if (session.user.isBlocked) return null;

  return {
    id: session.user.id,
    telegramUserId: session.user.telegramUserId,
    telegramUsername: session.user.telegramUsername,
    firstName: session.user.firstName,
    lastName: session.user.lastName,
    walletAddress: session.user.walletAddress,
    isAdmin: session.user.isAdmin,
    isBlocked: session.user.isBlocked,
  };
}

/**
 * Authenticate with Telegram initData
 */
async function authenticateWithTelegram(initData: string): Promise<AuthUser | null> {
  const { validateTelegramInitData } = await import('@/lib/telegram');

  try {
    const validated = validateTelegramInitData(initData);
    const user = await prisma.user.findUnique({
      where: { telegramUserId: String(validated.user.id) },
    });

    if (!user) return null;
    if (user.isBlocked) return null;

    return {
      id: user.id,
      telegramUserId: user.telegramUserId,
      telegramUsername: user.telegramUsername,
      firstName: user.firstName,
      lastName: user.lastName,
      walletAddress: user.walletAddress,
      isAdmin: user.isAdmin,
      isBlocked: user.isBlocked,
    };
  } catch {
    return null;
  }
}

/**
 * Require admin authentication
 */
export async function requireAdmin(request: NextRequest): Promise<AuthUser | Response> {
  const user = await authenticateUser(request);

  if (!user) {
    return new Response(
      JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!user.isAdmin) {
    // Also check admin secret header
    const adminSecret = request.headers.get('x-admin-secret');
    if (adminSecret === process.env.ADMIN_SECRET) {
      return user;
    }

    return new Response(
      JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED', message: 'Admin access required' } }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return user;
}

/**
 * Development mode user (for testing without Telegram)
 */
export function getDevAuthUser(): AuthUser {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('Dev auth only available in development');
  }

  return {
    id: 'dev-user-id',
    telegramUserId: '123456789',
    telegramUsername: 'dev_user',
    firstName: 'Dev',
    lastName: 'User',
    walletAddress: null,
    isAdmin: true,
    isBlocked: false,
  };
}
