// ============================================
// Type Definitions - Solana Number Draw
// ============================================

// ── Game Types ───────────────────────────────

export type RoundStatus = 'DRAFT' | 'OPEN' | 'PAUSED' | 'CLOSING' | 'DRAW_PENDING' | 'COMPLETED' | 'CANCELLED';
export type NumberStatus = 'AVAILABLE' | 'RESERVED' | 'PURCHASED' | 'WINNER';
export type PurchaseStatus = 'PENDING' | 'CONFIRMED' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
export type DrawStatus = 'PENDING' | 'COMMITTED' | 'REVEALED' | 'EXECUTED' | 'VERIFIED' | 'FAILED';
export type WinnerStatus = 'SELECTED' | 'PENDING_PAYOUT' | 'PAID' | 'FAILED' | 'UNCLAIMED';

// ── Telegram Types ───────────────────────────

export interface TelegramUser {
  id: number;
  username?: string;
  first_name: string;
  last_name?: string;
  photo_url?: string;
  language_code?: string;
}

export interface TelegramWebAppInitData {
  query_id?: string;
  user?: TelegramUser;
  auth_date: number;
  hash: string;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: TelegramWebAppInitData;
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: Record<string, string>;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  ready: () => void;
  expand: () => void;
  close: () => void;
  MainButton: {
    text: string;
    isVisible: boolean;
    isActive: boolean;
    isProgressVisible: boolean;
    setText: (text: string) => void;
    onClick: (callback: () => void) => void;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    showProgress: (leaveActive: boolean) => void;
    hideProgress: () => void;
  };
  BackButton: {
    isVisible: boolean;
    onClick: (callback: () => void) => void;
    show: () => void;
    hide: () => void;
  };
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
  openTelegramLink: (url: string) => void;
  openLink: (url: string) => void;
  showAlert: (message: string, callback?: (ok: boolean) => void) => void;
  showConfirm: (message: string, callback?: (ok: boolean) => void) => void;
}

// ── Game Data Types ──────────────────────────

export interface GameRoundData {
  id: string;
  roundNumber: number;
  title: string | null;
  status: RoundStatus;
  startAt: string;
  endAt: string;
  entryPriceLamports: string;
  numberMin: number;
  numberMax: number;
  winnerCount: number;
  prizePoolLamports: string;
  totalEntries: number;
  operatorFeePercent: number;
  treasuryWallet: string;
  network: string;
  createdAt: string;
}

export interface NumberData {
  id: string;
  numberValue: number;
  status: NumberStatus;
  userId?: string;
  purchasedAt?: string;
}

export interface NumberGridData {
  roundId: string;
  total: number;
  available: number;
  taken: number;
  reserved: number;
  numbers: Array<{
    value: number;
    status: NumberStatus;
  }>;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface PurchaseData {
  id: string;
  numberValue: number;
  amountLamports: string;
  status: PurchaseStatus;
  transactionSignature?: string;
  createdAt: string;
}

export interface WinnerData {
  id: string;
  userId: string;
  number: number;
  prizeLamports: string;
  payoutWallet: string;
  payoutTransaction?: string;
  status: WinnerStatus;
  rank: number;
  username?: string;
}

export interface DrawData {
  id: string;
  roundId: string;
  randomnessProvider: string;
  commitment?: string;
  randomnessValue?: string;
  snapshotHash?: string;
  status: DrawStatus;
  generatedAt?: string;
  verificationData?: Record<string, unknown>;
}

// ── API Types ────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ── Payment Types ────────────────────────────

export interface PaymentVerification {
  signature: string;
  senderWallet: string;
  recipientWallet: string;
  amountLamports: number;
  status: 'confirmed' | 'pending' | 'failed';
  confirmations: number;
  blockTime?: number;
}

export interface ReserveNumberRequest {
  roundId: string;
  number: number;
}

export interface VerifyPaymentRequest {
  roundId: string;
  number: number;
  transactionSignature: string;
  walletAddress: string;
}

// ── Admin Types ──────────────────────────────

export interface AdminDashboardData {
  currentRound: GameRoundData | null;
  stats: {
    totalUsers: number;
    totalPurchases: number;
    totalPrizePool: string;
    activeReservations: number;
    pendingPayouts: number;
    completedRounds: number;
  };
  recentActivity: Array<{
    type: string;
    description: string;
    timestamp: string;
  }>;
}

export interface CreateRoundRequest {
  roundNumber: number;
  title?: string;
  description?: string;
  startAt: string;
  endAt: string;
  entryPriceLamports: string;
  numberMin?: number;
  numberMax?: number;
  winnerCount?: number;
  operatorFeePercent?: number;
  minEntries?: number;
  maxEntries?: number;
  adminWinsUnclaimed?: boolean;
}

// ── Error Codes ──────────────────────────────

export type GameErrorCode =
  | 'NUMBER_ALREADY_TAKEN'
  | 'NUMBER_ALREADY_RESERVED'
  | 'RESERVATION_EXPIRED'
  | 'PAYMENT_NOT_FOUND'
  | 'PAYMENT_AMOUNT_INVALID'
  | 'PAYMENT_NETWORK_INVALID'
  | 'PAYMENT_ALREADY_USED'
  | 'WALLET_INVALID'
  | 'ROUND_CLOSED'
  | 'ROUND_NOT_STARTED'
  | 'ROUND_NOT_FOUND'
  | 'DRAW_ALREADY_EXECUTED'
  | 'DRAW_NOT_READY'
  | 'PAYOUT_FAILED'
  | 'USER_BLOCKED'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export const ERROR_MESSAGES: Record<GameErrorCode, string> = {
  NUMBER_ALREADY_TAKEN: 'This number was just taken by another player. Please choose another number.',
  NUMBER_ALREADY_RESERVED: 'This number is currently reserved by another player.',
  RESERVATION_EXPIRED: 'Your reservation has expired. Please try again.',
  PAYMENT_NOT_FOUND: 'Payment transaction not found on the blockchain.',
  PAYMENT_AMOUNT_INVALID: 'Payment amount does not match the entry price.',
  PAYMENT_NETWORK_INVALID: 'Payment was made on the wrong network.',
  PAYMENT_ALREADY_USED: 'This transaction has already been used for another purchase.',
  WALLET_INVALID: 'Invalid wallet address. Please check and try again.',
  ROUND_CLOSED: 'This round is no longer accepting entries.',
  ROUND_NOT_STARTED: 'This round has not started yet.',
  ROUND_NOT_FOUND: 'Game round not found.',
  DRAW_ALREADY_EXECUTED: 'The draw for this round has already been executed.',
  DRAW_NOT_READY: 'The draw is not ready to be executed yet.',
  PAYOUT_FAILED: 'Payout transaction failed. Please contact support.',
  USER_BLOCKED: 'Your account has been suspended.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',
  INTERNAL_ERROR: 'An unexpected error occurred. Please try again later.',
};

// ── WebSocket Events ─────────────────────────

export interface WSEvents {
  'number:reserved': { roundId: string; number: number; reservedBy: string };
  'number:released': { roundId: string; number: number };
  'number:purchased': { roundId: string; number: number; purchasedBy: string };
  'round:status': { roundId: string; status: RoundStatus };
  'prize-pool:updated': { roundId: string; prizePoolLamports: string; totalEntries: number };
  'draw:executed': { roundId: string; winners: WinnerData[] };
  'draw:countdown': { roundId: string; secondsRemaining: number };
}

// ── Utility Types ────────────────────────────

export function lamportsToSol(lamports: bigint | string): number {
  return Number(BigInt(lamports)) / 1_000_000_000;
}

export function solToLamports(sol: number): bigint {
  return BigInt(Math.round(sol * 1_000_000_000));
}

export function formatSol(lamports: bigint | string, decimals = 4): string {
  const sol = lamportsToSol(lamports);
  return `${sol.toFixed(decimals)} SOL`;
}

export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}
