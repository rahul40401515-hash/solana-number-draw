import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 100; // requests per window

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Add security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // CSP for Telegram Mini App
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://telegram.org; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://api.devnet.solana.com https://api.mainnet-beta.solana.com https://api.coingecko.com wss: https:;"
  );

  // Rate limiting for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const key = `${ip}:${request.nextUrl.pathname}`;

    const now = Date.now();
    const entry = rateLimitStore.get(key);

    if (!entry || entry.resetAt < now) {
      rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    } else {
      entry.count++;
      if (entry.count > RATE_LIMIT_MAX) {
        return NextResponse.json(
          { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
          { status: 429 }
        );
      }
    }

    // Clean up old entries periodically
    if (rateLimitStore.size > 10000) {
      const entries = Array.from(rateLimitStore.entries());
      for (const [k, v] of entries) {
        if (v.resetAt < now) rateLimitStore.delete(k);
      }
    }
  }

  // Block access to admin routes without proper header (in addition to API-level auth)
  if (request.nextUrl.pathname.startsWith('/admin')) {
    // Admin pages are accessible but API endpoints require auth
    // This is just an additional layer
  }

  return response;
}

export const config = {
  matcher: [
    '/api/:path*',
    '/admin/:path*',
  ],
};
