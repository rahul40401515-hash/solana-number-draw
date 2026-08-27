# Setup Guide

## Prerequisites

- Node.js 20+ (LTS recommended)
- npm or yarn
- PostgreSQL 15+ (or Docker for local dev)
- Redis 7+ (optional, for caching/rate limiting)
- Telegram account (for bot testing)

## Step-by-Step Setup

### 1. Clone & Install

```bash
cd solana-number-draw
npm install
```

### 2. Environment Configuration

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Required for development
DATABASE_URL=postgresql://numberdraw:numberdraw_dev@localhost:5432/numberdraw
SOLANA_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
REAL_MONEY_MODE=false

# Telegram (get from @BotFather)
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Admin
ADMIN_SECRET=your_admin_secret

# Security
NEXTAUTH_SECRET=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 32)
```

### 3. Start Infrastructure

**Option A: Docker (recommended)**

```bash
# Start PostgreSQL and Redis
docker-compose up -d postgres redis

# Wait for health checks
docker-compose ps
```

**Option B: Local PostgreSQL**

```bash
# Create database
createdb numberdraw

# Update DATABASE_URL in .env.local
```

### 4. Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Verify
npx prisma studio  # Opens database GUI
```

### 5. Seed Development Data

```bash
npm run db:seed
```

This creates:
- 1 admin user (`@admin_user`)
- 500 test users
- Round #001 (1-5000, OPEN status)
- ~500 simulated purchases
- Prize pool of ~25 SOL

### 6. Start Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

### 7. Start Telegram Bot (optional)

```bash
# Make sure TELEGRAM_BOT_TOKEN is set
npm run bot
```

### 8. Create Telegram Bot

1. Open Telegram and search for `@BotFather`
2. Send `/newbot`
3. Choose a name (e.g., "Solana Number Draw")
4. Choose a username (e.g., "sol_number_draw_bot")
5. Copy the token
6. Send `/setmenubutton` to configure the Mini App button
7. Set the URL to your app's public URL

### 9. Configure Mini App Webhook

```bash
# In production:
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-domain.com/api/webhook"}'
```

## Testing the Full Flow

### Test Number Purchase

1. Open the app
2. Browse available numbers
3. Select a number (e.g., 42)
4. Confirm reservation
5. In dev mode: simulate payment or enter mock TX
6. Verify number shows as TAKEN

### Test Draw Execution

1. Go to Admin panel (/admin)
2. Authenticate (dev mode: any input works)
3. Close the round
4. Execute draw
5. View results

### Test Verification

1. After draw, go to /game/transparency
2. Verify snapshot hash is displayed
3. Verify randomness value is displayed
4. Check winner selection is correct

## Troubleshooting

### Database Connection Error

```bash
# Check if PostgreSQL is running
docker-compose ps

# Restart if needed
docker-compose restart postgres
```

### Telegram Auth Failing

- Ensure TELEGRAM_BOT_TOKEN is correct
- In dev mode without token, mock auth is used
- Check that initData is being passed correctly

### Numbers Not Loading

- Run `npx prisma db push` to ensure schema is up to date
- Run `npm run db:seed` to populate numbers
- Check the database for numbers in the `numbers` table

### Payment Verification Failing

- In dev mode: mock payments are accepted
- In production: ensure SOLANA_RPC_URL is correct
- Check TREASURY_WALLET is configured
- Verify transaction on Solana Explorer

## Production Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for production setup including:
- SSL/HTTPS configuration
- Environment hardening
- Database backup strategy
- Monitoring setup
- Load balancing
