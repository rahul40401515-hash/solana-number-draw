/**
 * POST /api/admin/seed
 *
 * One-click database seeding for development/testing.
 * Creates Round #001 with 5000 numbers and demo data.
 *
 * SECURITY: In production, this endpoint should be removed
 * or protected with strong authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    // Dev mode: allow seeding without auth
    // In production, uncomment the admin secret check below
    /*
    const adminSecret = request.headers.get('x-admin-secret');
    if (adminSecret !== process.env.ADMIN_SECRET) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid admin secret' } },
        { status: 403 }
      );
    }
    */

    console.log('🌱 Starting database seed...');

    // Clean existing data
    console.log('🧹 Cleaning existing data...');
    await prisma.auditLog.deleteMany();
    await prisma.winner.deleteMany();
    await prisma.randomnessDraw.deleteMany();
    await prisma.purchase.deleteMany();
    await prisma.number.deleteMany();
    await prisma.session.deleteMany();
    await prisma.gameRound.deleteMany();
    await prisma.user.deleteMany();

    // Create admin user
    console.log('👤 Creating admin user...');
    const adminUser = await prisma.user.create({
      data: {
        telegramUserId: '999999999',
        telegramUsername: 'admin_user',
        firstName: 'Admin',
        lastName: 'User',
        isAdmin: true,
        isVerified: true,
      },
    });

    // Create 50 demo users
    console.log(' Creating 50 demo users...');
    const users = [];
    const firstNames = ['Alex', 'Jordan', 'Sam', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Quinn', 'Avery', 'Charlie'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];

    for (let i = 0; i < 50; i++) {
      const first = firstNames[i % firstNames.length];
      const last = lastNames[i % lastNames.length];
      const user = await prisma.user.create({
        data: {
          telegramUserId: String(100000000 + i),
          telegramUsername: `${first.toLowerCase()}${last.toLowerCase()}${i}`,
          firstName: first,
          lastName: last,
        },
      });
      users.push(user);
    }

    // Create Round #001
    console.log('🎮 Creating Round #001...');
    const now = new Date();
    const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const round = await prisma.gameRound.create({
      data: {
        roundNumber: 1,
        title: 'Monthly Number Draw #001',
        description: 'First monthly draw with 5000 numbers',
        status: 'OPEN',
        startAt: now,
        endAt: endDate,
        entryPriceLamports: BigInt(50000000), // 0.05 SOL
        numberMin: 1,
        numberMax: 5000,
        winnerCount: 5,
        prizePoolLamports: BigInt(0),
        totalEntries: 0,
        operatorFeePercent: 0,
        treasuryWallet: process.env.TREASURY_WALLET || '',
        network: process.env.SOLANA_NETWORK || 'devnet',
      },
    });

    // Create 5000 numbers
    console.log('🔢 Creating 5000 numbers...');
    const CHUNK_SIZE = 500;
    for (let i = 0; i < 5000; i += CHUNK_SIZE) {
      const chunk = [];
      for (let j = i + 1; j <= Math.min(i + CHUNK_SIZE, 5000); j++) {
        chunk.push({
          roundId: round.id,
          numberValue: j,
          status: 'AVAILABLE' as const,
        });
      }
      await prisma.number.createMany({ data: chunk });
    }

    // Simulate ~200 purchases
    console.log('💰 Simulating ~200 purchases...');
    const usedNumbers = new Set<number>();
    const purchaseCount = 200;
    let totalPrizePool = BigInt(0);

    for (let i = 0; i < purchaseCount; i++) {
      let num: number;
      do {
        num = Math.floor(Math.random() * 5000) + 1;
      } while (usedNumbers.has(num));
      usedNumbers.add(num);

      const user = users[i % users.length];

      await prisma.number.update({
        where: {
          roundId_numberValue: { roundId: round.id, numberValue: num },
        },
        data: {
          status: 'PURCHASED',
          userId: user.id,
          purchasedAt: new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        },
      });

      await prisma.purchase.create({
        data: {
          roundId: round.id,
          userId: user.id,
          numberId: (await prisma.number.findUnique({
            where: { roundId_numberValue: { roundId: round.id, numberValue: num } },
            select: { id: true },
          }))!.id,
          walletAddress: `DevWallet${i}`,
          amountLamports: BigInt(50000000),
          transactionSignature: `dev_seed_${Math.random().toString(36).substring(2, 20)}_${i}`,
          status: 'CONFIRMED',
          confirmedAt: new Date(),
        },
      });

      totalPrizePool += BigInt(50000000);
    }

    // Update round totals
    await prisma.gameRound.update({
      where: { id: round.id },
      data: {
        prizePoolLamports: totalPrizePool,
        totalEntries: purchaseCount,
      },
    });

    // Create audit logs
    await prisma.auditLog.create({
      data: {
        roundId: round.id,
        eventType: 'ROUND_CREATED',
        actor: adminUser.id,
        actorType: 'admin',
        data: { roundNumber: 1 },
      },
    });

    await prisma.auditLog.create({
      data: {
        roundId: round.id,
        eventType: 'ROUND_OPENED',
        actor: adminUser.id,
        actorType: 'admin',
      },
    });

    console.log('✅ Seed complete!');

    return NextResponse.json({
      success: true,
      data: {
        message: 'Database seeded successfully!',
        round: {
          id: round.id,
          roundNumber: round.roundNumber,
          title: round.title,
          status: round.status,
          totalNumbers: 5000,
          purchased: purchaseCount,
          available: 5000 - purchaseCount,
          prizePoolSol: (Number(totalPrizePool) / 1e9).toFixed(2),
        },
        users: users.length,
      },
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Seed failed', details: String(error) } },
      { status: 500 }
    );
  }
}

// Also allow GET for easy triggering from browser
export async function GET(request: NextRequest) {
  return POST(request);
}
