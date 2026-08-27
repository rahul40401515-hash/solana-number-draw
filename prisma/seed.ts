/**
 * Database Seed Script
 *
 * Creates demo data for development:
 * - Round #001 with 5000 numbers
 * - ~500 fake users
 * - ~500 purchased numbers
 *
 * Run: npx tsx prisma/seed.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Helpers ──────────────────────────────────

function randomWalletAddress(): string {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let address = '';
  for (let i = 0; i < 44; i++) {
    address += chars[Math.floor(Math.random() * chars.length)];
  }
  return address;
}

function randomUsername(): string {
  const adjectives = ['Crypto', 'Sol', 'Degen', 'Moon', 'Alpha', 'Diamond', 'Lucky', 'Fast', 'Lucky', 'Golden'];
  const nouns = ['Whale', 'Trader', 'Holder', 'Hunter', 'Master', 'King', 'Ninja', 'Wizard', 'Pro', 'Chad'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 9999);
  return `${adj}${noun}${num}`;
}

function randomName(): { first: string; last: string } {
  const firstNames = ['Alex', 'Jordan', 'Sam', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Quinn', 'Avery', 'Charlie'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
  return {
    first: firstNames[Math.floor(Math.random() * firstNames.length)],
    last: lastNames[Math.floor(Math.random() * lastNames.length)],
  };
}

// ── Main Seed ────────────────────────────────

async function main() {
  console.log('🌱 Seeding database...\n');

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
      walletAddress: randomWalletAddress(),
      isAdmin: true,
      isVerified: true,
    },
  });

  // Create 500 fake users
  console.log('👥 Creating 500 fake users...');
  const users = [];
  for (let i = 0; i < 500; i++) {
    const name = randomName();
    const user = await prisma.user.create({
      data: {
        telegramUserId: String(100000000 + i),
        telegramUsername: randomUsername(),
        firstName: name.first,
        lastName: name.last,
        walletAddress: randomWalletAddress(),
        languageCode: ['en', 'ar', 'ru', 'es', 'de'][Math.floor(Math.random() * 5)],
      },
    });
    users.push(user);
  }

  // Create Round #001
  console.log('🎮 Creating Round #001...');
  const now = new Date();
  const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

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
      treasuryWallet: process.env.TREASURY_WALLET || randomWalletAddress(),
      network: process.env.SOLANA_NETWORK || 'devnet',
    },
  });

  // Create 5000 numbers
  console.log('🔢 Creating 5000 numbers...');
  const numberChunks: any[] = [];
  for (let i = 1; i <= 5000; i++) {
    numberChunks.push({
      roundId: round.id,
      numberValue: i,
      status: 'AVAILABLE',
    });
  }

  // Batch insert
  const CHUNK_SIZE = 1000;
  for (let i = 0; i < numberChunks.length; i += CHUNK_SIZE) {
    await prisma.number.createMany({
      data: numberChunks.slice(i, i + CHUNK_SIZE),
    });
  }

  // Simulate ~500 purchases
  console.log('💰 Simulating ~500 purchases...');
  const usedNumbers = new Set<number>();
  const purchasedCount = 500 + Math.floor(Math.random() * 100); // 500-600 purchases

  let totalPrizePool = BigInt(0);

  for (let i = 0; i < purchasedCount; i++) {
    // Pick a random number that hasn't been used
    let num: number;
    do {
      num = Math.floor(Math.random() * 5000) + 1;
    } while (usedNumbers.has(num));
    usedNumbers.add(num);

    const user = users[Math.floor(Math.random() * users.length)];

    // Update the number
    await prisma.number.update({
      where: {
        roundId_numberValue: { roundId: round.id, numberValue: num },
      },
      data: {
        status: 'PURCHASED',
        userId: user.id,
        purchasedAt: new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Random date in last week
      },
    });

    // Create purchase record
    await prisma.purchase.create({
      data: {
        roundId: round.id,
        userId: user.id,
        numberId: (await prisma.number.findUnique({
          where: { roundId_numberValue: { roundId: round.id, numberValue: num } },
          select: { id: true },
        }))!.id,
        walletAddress: user.walletAddress || randomWalletAddress(),
        amountLamports: BigInt(50000000),
        transactionSignature: `dev_${Math.random().toString(36).substring(2, 30)}_${i}`,
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
      totalEntries: purchasedCount,
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

  console.log('\n✅ Seed complete!');
  console.log(`   - Admin user: @admin_user (ID: ${adminUser.id})`);
  console.log(`   - Users created: ${users.length}`);
  console.log(`   - Round: #001 (Status: OPEN)`);
  console.log(`   - Numbers: 1-5000`);
  console.log(`   - Purchased: ${purchasedCount}`);
  console.log(`   - Prize pool: ${Number(totalPrizePool) / 1e9} SOL`);
  console.log(`   - Available: ${5000 - purchasedCount}`);
  console.log('\n🚀 Ready to start development!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
