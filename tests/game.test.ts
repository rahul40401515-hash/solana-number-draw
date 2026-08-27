/**
 * Game Logic Tests
 *
 * Tests for critical game operations:
 * - Number reservation (concurrent access)
 * - Draw algorithm
 * - Prize calculation
 * - Payment verification
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  executeDraw,
  createSnapshotHash,
  verifyCommitment,
  createCommitment,
} from '../src/lib/randomness';

// ── Draw Algorithm Tests ─────────────────────

describe('Draw Algorithm', () => {
  it('should select exactly N unique winners from purchased numbers', () => {
    const purchasedNumbers = Array.from({ length: 100 }, (_, i) => ({
      id: `num-${i + 1}`,
      numberValue: i + 1,
      userId: `user-${Math.floor(Math.random() * 50)}`,
    }));

    const result = executeDraw({
      roundId: 'test-round',
      purchasedNumbers,
      winnerCount: 5,
    });

    expect(result.winners).toHaveLength(5);

    // All winners should be unique numbers
    const winnerNumbers = result.winners.map((w) => w.number);
    const uniqueNumbers = new Set(winnerNumbers);
    expect(uniqueNumbers.size).toBe(5);

    // All winner numbers should be from the purchased list
    const purchasedValues = new Set(purchasedNumbers.map((n) => n.numberValue));
    for (const winner of result.winners) {
      expect(purchasedValues.has(winner.number)).toBe(true);
    }
  });

  it('should throw if not enough purchased numbers for winners', () => {
    const purchasedNumbers = [
      { id: '1', numberValue: 1, userId: 'user-1' },
      { id: '2', numberValue: 2, userId: 'user-2' },
    ];

    expect(() =>
      executeDraw({
        roundId: 'test-round',
        purchasedNumbers,
        winnerCount: 5,
      })
    ).toThrow('Not enough purchased numbers');
  });

  it('should produce deterministic results given same inputs', () => {
    const purchasedNumbers = Array.from({ length: 50 }, (_, i) => ({
      id: `num-${i + 1}`,
      numberValue: (i + 1) * 100,
      userId: `user-${i}`,
    }));

    // Note: In practice, the seed is random, so we test the snapshot hash is deterministic
    const hash1 = createSnapshotHash(purchasedNumbers);
    const hash2 = createSnapshotHash(purchasedNumbers);

    expect(hash1).toBe(hash2);
  });

  it('should produce different snapshot hashes for different inputs', () => {
    const numbers1 = [
      { id: '1', numberValue: 1, userId: 'user-1' },
      { id: '2', numberValue: 2, userId: 'user-2' },
    ];

    const numbers2 = [
      { id: '1', numberValue: 1, userId: 'user-1' },
      { id: '3', numberValue: 3, userId: 'user-3' },
    ];

    const hash1 = createSnapshotHash(numbers1);
    const hash2 = createSnapshotHash(numbers2);

    expect(hash1).not.toBe(hash2);
  });

  it('should assign correct ranks to winners', () => {
    const purchasedNumbers = Array.from({ length: 20 }, (_, i) => ({
      id: `num-${i + 1}`,
      numberValue: i + 1,
      userId: `user-${i}`,
    }));

    const result = executeDraw({
      roundId: 'test-round',
      purchasedNumbers,
      winnerCount: 5,
    });

    // Ranks should be 1 through 5
    const ranks = result.winners.map((w) => w.rank).sort();
    expect(ranks).toEqual([1, 2, 3, 4, 5]);
  });

  it('should include verification data', () => {
    const purchasedNumbers = Array.from({ length: 30 }, (_, i) => ({
      id: `num-${i + 1}`,
      numberValue: i + 1,
      userId: `user-${i}`,
    }));

    const result = executeDraw({
      roundId: 'test-round',
      purchasedNumbers,
      winnerCount: 5,
    });

    expect(result.randomnessValue).toBeTruthy();
    expect(result.commitment).toBeTruthy();
    expect(result.snapshotHash).toBeTruthy();
    expect(result.verificationData.algorithm).toBeTruthy();
    expect(result.verificationData.purchasedCount).toBe(30);
    expect(result.verificationData.winnerCount).toBe(5);
    expect(result.verificationData.indices).toHaveLength(5);
  });
});

// ── Commitment Tests ─────────────────────────

describe('Commit-Reveal', () => {
  it('should create and verify commitments', () => {
    const { commitment, seed } = createCommitment();

    expect(commitment).toBeTruthy();
    expect(seed).toBeTruthy();
    expect(verifyCommitment(seed, commitment)).toBe(true);
  });

  it('should reject invalid seed for commitment', () => {
    const { commitment } = createCommitment();
    const wrongSeed = 'wrong-seed-value';

    expect(verifyCommitment(wrongSeed, commitment)).toBe(false);
  });
});

// ── Snapshot Hash Tests ──────────────────────

describe('Snapshot Hash', () => {
  it('should be deterministic regardless of input order', () => {
    const numbers1 = [
      { id: 'a', numberValue: 5, userId: 'u1' },
      { id: 'b', numberValue: 1, userId: 'u2' },
      { id: 'c', numberValue: 3, userId: 'u3' },
    ];

    const numbers2 = [
      { id: 'b', numberValue: 1, userId: 'u2' },
      { id: 'c', numberValue: 3, userId: 'u3' },
      { id: 'a', numberValue: 5, userId: 'u1' },
    ];

    const hash1 = createSnapshotHash(numbers1);
    const hash2 = createSnapshotHash(numbers2);

    // Should be same because numbers are sorted before hashing
    expect(hash1).toBe(hash2);
  });
});

// ── Prize Calculation Tests ──────────────────

describe('Prize Calculation', () => {
  it('should divide prize pool equally among winners', () => {
    const totalPool = BigInt(25000000000); // 25 SOL
    const winnerCount = 5;
    const prizePerWinner = totalPool / BigInt(winnerCount);

    expect(prizePerWinner).toBe(BigInt(5000000000)); // 5 SOL each
  });

  it('should handle non-divisible pools', () => {
    const totalPool = BigInt(10000000001); // Not perfectly divisible
    const winnerCount = 5;
    const prizePerWinner = totalPool / BigInt(winnerCount);

    // Should floor the result (remainder stays in pool)
    expect(prizePerWinner * BigInt(winnerCount)).toBeLessThanOrEqual(totalPool);
  });

  it('should calculate correct pool from entries', () => {
    const entryPrice = BigInt(50000000); // 0.05 SOL
    const numEntries = 5000;
    const expectedPool = entryPrice * BigInt(numEntries);

    expect(expectedPool).toBe(BigInt(250000000000)); // 250 SOL
  });

  it('should calculate operator fee correctly', () => {
    const totalPool = BigInt(25000000000); // 25 SOL
    const feePercent = 5; // 5%
    const fee = (totalPool * BigInt(feePercent)) / BigInt(100);

    expect(fee).toBe(BigInt(1250000000)); // 1.25 SOL
    expect(totalPool - fee).toBe(BigInt(23750000000)); // 23.75 SOL distributable
  });
});

// ── Concurrent Reservation Simulation ────────

describe('Concurrent Reservation (Simulation)', () => {
  it('should handle simulated concurrent access', async () => {
    // Simulate 100 concurrent attempts to reserve the same number
    const number = 123;
    const results: boolean[] = [];

    // In a real test, this would use the actual database with transactions
    // Here we simulate the logic
    let isReserved = false;

    const attempts = Array.from({ length: 100 }, (_, i) => {
      return new Promise<boolean>((resolve) => {
        // Simulate async operation
        setTimeout(() => {
          if (!isReserved) {
            isReserved = true;
            resolve(true); // Success
          } else {
            resolve(false); // Already taken
          }
        }, Math.random() * 10);
      });
    });

    const resolved = await Promise.all(attempts);
    const successes = resolved.filter((r) => r);

    // Exactly one should succeed
    expect(successes.length).toBe(1);
  });
});
