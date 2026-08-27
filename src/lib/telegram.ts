/**
 * Telegram WebApp Authentication
 *
 * Validates initData from Telegram WebApp using HMAC-SHA256.
 * This ensures the request genuinely comes from Telegram.
 *
 * @see https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */

import crypto from 'crypto';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

export interface TelegramWebAppUser {
  id: number;
  is_bot?: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

export interface ValidatedInitData {
  user: TelegramWebAppUser;
  authDate: Date;
  hash: string;
  queryId?: string;
}

/**
 * Validates Telegram WebApp initData
 * Returns parsed user data if valid, throws if invalid
 */
export function validateTelegramInitData(initData: string): ValidatedInitData {
  if (!initData) {
    throw new Error('No initData provided');
  }

  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  }

  // Parse the initData as URL search params
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');

  if (!hash) {
    throw new Error('Missing hash in initData');
  }

  // Remove the hash from params and sort remaining
  const dataCheckString = Array.from(params.entries())
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  // Create HMAC-SHA256 secret key
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(TELEGRAM_BOT_TOKEN)
    .digest();

  // Compute hash
  const computedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  // Compare hashes (timing-safe)
  if (!timingSafeEqual(computedHash, hash)) {
    throw new Error('Invalid initData hash');
  }

  // Check auth_date is not too old (within 24 hours)
  const authDate = new Date(Number(params.get('auth_date')) * 1000);
  const now = new Date();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours

  if (now.getTime() - authDate.getTime() > maxAge) {
    throw new Error('InitData has expired');
  }

  // Parse user data
  const userJson = params.get('user');
  if (!userJson) {
    throw new Error('No user data in initData');
  }

  let user: TelegramWebAppUser;
  try {
    user = JSON.parse(userJson);
  } catch {
    throw new Error('Invalid user data in initData');
  }

  return {
    user,
    authDate,
    hash,
    queryId: params.get('query_id') || undefined,
  };
}

/**
 * Timing-safe string comparison
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');

  if (bufA.length !== bufB.length) return false;

  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Extracts Telegram auth header from request
 */
export function extractTelegramAuth(request: Request): string | null {
  const authHeader = request.headers.get('x-telegram-init-data');
  if (authHeader) return authHeader;

  const authorization = request.headers.get('authorization');
  if (authorization?.startsWith('tma ')) {
    return authorization.slice(4);
  }

  return null;
}

/**
 * Validates and extracts user from request
 */
export async function getTelegramUser(request: Request): Promise<ValidatedInitData> {
  const initData = extractTelegramAuth(request);
  if (!initData) {
    throw new Error('No Telegram authentication provided');
  }
  return validateTelegramInitData(initData);
}

/**
 * Validates admin authorization
 */
export function validateAdminAuth(request: Request): boolean {
  const adminSecret = request.headers.get('x-admin-secret');
  const expectedSecret = process.env.ADMIN_SECRET;

  if (!adminSecret || !expectedSecret) return false;
  if (adminSecret.length !== expectedSecret.length) return false;

  return crypto.timingSafeEqual(
    Buffer.from(adminSecret),
    Buffer.from(expectedSecret)
  );
}

/**
 * Development mode: bypass Telegram auth for testing
 * ONLY use in development environment
 */
export function getDevUser(): ValidatedInitData {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('Dev mode auth is only available in development');
  }

  return {
    user: {
      id: 123456789,
      first_name: 'Dev',
      last_name: 'User',
      username: 'dev_user',
      language_code: 'en',
    },
    authDate: new Date(),
    hash: 'dev-hash',
    queryId: 'dev-query',
  };
}
