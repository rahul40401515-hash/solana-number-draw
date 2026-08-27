# 🎰 Solana Number Draw

A production-quality Telegram Mini App for a Solana-based number draw game. Players purchase unique numbers for 0.05 SOL, and 5 winning numbers are drawn at round end using provably fair randomness.

## 📋 Overview

| Feature | Details |
|---------|---------|
| **Game** | Number draw (1-5000), 5 winners per round |
| **Entry Price** | 0.05 SOL |
| **Prize Pool** | Dynamic (entries × 0.05 SOL) |
| **Network** | Solana Devnet (dev) / Mainnet (prod) |
| **Platform** | Telegram Mini App |
| **Randomness** | Cryptographic commit-reveal (SHA-256) |

## 🏗️ Tech Stack

- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS
- **Backend**: Next.js API Routes + TypeScript
- **Database**: PostgreSQL + Prisma ORM
- **Blockchain**: Solana (@solana/web3.js)
- **Bot**: node-telegram-bot-api
- **Real-time**: WebSocket/SSE ready
- **Auth**: Telegram WebApp initData validation

## 📁 Project Structure

```
solana-number-draw/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx           # Main game page
│   │   ├── profile/           # User profile
│   │   ├── admin/             # Admin dashboard
│   │   ├── game/
│   │   │   ├── results/       # Round results
│   │   │   ├── transparency/  # Verifiability page
│   │   │   └── verify/        # Draw verification
│   │   └── api/               # API routes
│   │       ├── auth/telegram/ # Telegram auth
│   │       ├── game/          # Game data endpoints
│   │       ├── numbers/       # Number grid + reservation
│   │       ├── purchases/     # Payment verification
│   │       ├── draw/          # Draw data
│   │       ├── results/       # Results data
│   │       └── admin/         # Admin endpoints
│   ├── components/
│   │   └── game/
│   │       └── NumberSelector.tsx  # Interactive number grid
│   └── lib/
│       ├── prisma.ts          # Database client
│       ├── telegram.ts        # Telegram auth
│       ├── solana.ts          # Solana verification
│       ├── randomness.ts      # Draw engine
│       ├── game.ts            # Business logic
│       └── auth.ts            # Session auth
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── seed.ts                # Dev seed data
├── scripts/
│   └── bot.ts                 # Telegram bot
├── docker-compose.yml         # Local dev infrastructure
├── Dockerfile                 # Production build
└── docs/                      # Documentation
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+ (or Docker)
- Solana CLI (optional, for testing)
- Telegram Bot Token (from @BotFather)

### 1. Clone and Install

```bash
cd solana-number-draw
npm install
```

### 2. Environment Setup

```bash
cp .env.example .env.local
```

Edit `.env.local` with your settings. For development, minimum required:

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/numberdraw
SOLANA_NETWORK=devnet
REAL_MONEY_MODE=false
```

### 3. Database Setup

```bash
# Start PostgreSQL (option A: Docker)
docker-compose up -d postgres redis

# OR option B: use your own PostgreSQL

# Run migrations
npx prisma generate
npx prisma db push

# Seed demo data
npm run db:seed
```

### 4. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Start Telegram Bot (optional)

```bash
# Set TELEGRAM_BOT_TOKEN in .env.local first
npm run bot
```

## 🎮 How to Play

1. Open the Telegram Mini App
2. View the current round's prize pool and countdown
3. Tap "CHOOSE YOUR NUMBER"
4. Browse or search the number grid
5. Select an available number
6. Connect your Solana wallet
7. Confirm payment of 0.05 SOL
8. Wait for the draw — if your number wins, you receive your share!

## 🔒 Security

- **REAL_MONEY_MODE=false** by default (Devnet only)
- Telegram initData validated server-side (HMAC-SHA256)
- Atomic number reservations prevent race conditions
- Payment verified on-chain before confirming ownership
- Transaction replay protection (unique signatures)
- Rate limiting on all API endpoints
- Admin 2FA ready
- No private keys in frontend code

See [SECURITY.md](docs/SECURITY.md) for details.

## 📚 Documentation

- [SETUP.md](docs/SETUP.md) - Detailed setup guide
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - System architecture
- [API.md](docs/API.md) - API reference
- [DATABASE.md](docs/DATABASE.md) - Database schema
- [RANDOMNESS.md](docs/RANDOMNESS.md) - Randomness engine
- [SECURITY.md](docs/SECURITY.md) - Security model
- [DEPLOYMENT.md](docs/DEPLOYMENT.md) - Production deployment
- [COMPLIANCE.md](docs/COMPLIANCE.md) - Legal/compliance notes
- [TESTING.md](docs/TESTING.md) - Testing guide

## ⚠️ Legal Disclaimer

This software involves cryptocurrency payments and chance-based prizes. Before deploying with real funds:

1. Consult legal counsel in your jurisdiction
2. Obtain required gambling/gaming licenses
3. Implement geographic restrictions
4. Add age verification where required
5. Comply with all applicable regulations

**The default configuration uses Devnet only. Mainnet/real-money mode must be explicitly enabled after compliance review.**

## 📄 License

MIT
