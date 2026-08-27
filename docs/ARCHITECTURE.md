# Architecture

## System Overview

```
┌──────────────────────────────────────────────────────┐
│                    Telegram Client                    │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │  Mini App    │  │  Bot (Bot    │  │  Group     │ │
│  │  (WebApp)    │  │  API)        │  │  Bot       │ │
│  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘ │
└─────────┼──────────────────┼─────────────────┼────────┘
          │                  │                 │
          ▼                  ▼                 ▼
┌──────────────────────────────────────────────────────┐
│                  Next.js Application                  │
│  ┌─────────────────────────────────────────────────┐ │
│  │              Frontend (React/TS)                 │ │
│  │  ┌──────────┐ ┌──────────┐ ┌─────────────────┐ │ │
│  │  │ Game UI  │ │ Number   │ │ Wallet          │ │ │
│  │  │          │ │ Selector │ │ Connect         │ │ │
│  │  └──────────┘ └──────────┘ └─────────────────┘ │ │
│  └─────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────┐ │
│  │              API Routes (Backend)                │ │
│  │  ┌────────┐ ┌──────────┐ ┌──────────────────┐  │ │
│  │  │ Auth   │ │ Numbers  │ │ Payment          │  │ │
│  │  │ (TG)   │ │ Reserve  │ │ Verification     │  │ │
│  │  └────────┘ └──────────┘ └──────────────────┘  │ │
│  │  ┌────────┐ ┌──────────┐ ┌──────────────────┐  │ │
│  │  │ Draw   │ │ Admin    │ │ Results          │  │ │
│  │  │ Engine │ │ Panel    │ │                  │  │ │
│  │  └────────┘ └──────────┘ └──────────────────┘  │ │
│  └─────────────────────────────────────────────────┘ │
└─────────┬──────────────────┬─────────────────────────┘
          │                  │
          ▼                  ▼
┌─────────────────┐  ┌─────────────────────┐
│   PostgreSQL    │  │   Solana Blockchain  │
│  ┌───────────┐  │  │  ┌───────────────┐  │
│  │ Users     │  │  │  │ Transactions  │  │
│  │ Rounds    │  │  │  │ Balances      │  │
│  │ Numbers   │  │  │  │ Signatures    │  │
│  │ Purchases │  │  │  └───────────────┘  │
│  │ Winners   │  │  └─────────────────────┘
│  │ Draws     │  │
│  └───────────┘  │
└─────────────────┘
```

## Core Components

### 1. Authentication Layer

- **Telegram WebApp Auth**: Validates `initData` using HMAC-SHA256 with bot token
- **Session Management**: Server-side sessions with expiry
- **Admin Auth**: Separate admin secret + optional 2FA
- **No client-trusted data**: All user info validated server-side

### 2. Number Reservation System

```
User selects number 123
    │
    ▼
POST /api/numbers (reserve)
    │
    ▼
DB Transaction (atomic):
    ├── Check round status (must be OPEN)
    ├── Check number status (must be AVAILABLE)
    ├── Lock row (SELECT FOR UPDATE)
    ├── Set status = RESERVED
    ├── Set reserved_by = user_id
    ├── Set expires_at = now + 5min
    └── Create audit log
    │
    ▼
Return reservation to client
    │
    ▼
User sends payment (0.05 SOL)
    │
    ▼
POST /api/purchases (verify)
    │
    ▼
Verify on-chain:
    ├── Transaction exists
    ├── Correct sender
    ├── Correct recipient (treasury)
    ├── Correct amount
    ├── Not replayed
    └── Confirmed
    │
    ▼
DB Transaction (atomic):
    ├── Update number: PURCHASED
    ├── Create purchase record
    ├── Update prize pool
    └── Create audit log
```

### 3. Draw Engine

```
Admin closes round
    │
    ▼
Freeze all reservations
    │
    ▼
Snapshot purchased numbers (immutable hash)
    │
    ▼
Generate cryptographic randomness
    │
    ▼
Select 5 unique winners (deterministic)
    │
    ▼
Calculate prizes (pool / winners)
    │
    ▼
Store results + verification data
    │
    ▼
Publish results
```

### 4. Randomness Engine

- **Development**: SHA-256 commit-reveal pattern
- **Production**: Switchboard VRF or equivalent
- **Verification**: Anyone can recompute winners from:
  - Snapshot hash
  - Revealed seed
  - Published algorithm

### 5. Payment Architecture

- **Dev mode**: Mock payments accepted
- **Production**: Full on-chain verification
  - Transaction signature validation
  - Amount verification
  - Sender/recipient verification
  - Confirmation count checking
  - Replay protection (unique TX tracking)

## Data Flow

### Purchase Flow
1. User opens Mini App → Telegram auth
2. Browse numbers → GET /api/numbers
3. Select number → POST /api/numbers (reserve)
4. Connect wallet → Frontend Solana adapter
5. Send payment → Solana transaction
6. Submit TX → POST /api/purchases (verify)
7. Backend verifies on-chain → Atomic DB update
8. Number becomes TAKEN → WebSocket notification

### Draw Flow
1. Round ends → Admin closes round
2. Freeze entries → Expire reservations
3. Snapshot → Hash all purchased numbers
4. Generate randomness → Commit-reveal
5. Select winners → Deterministic algorithm
6. Calculate prizes → Pool / winner_count
7. Store results → RandomnessDraw + Winners
8. Publish → Update round to COMPLETED

## Scaling Considerations

- **Database**: Indexes on (roundId, number), (roundId, status), transaction signatures
- **Caching**: Redis for number grid state, rate limiting
- **WebSocket**: Real-time number status updates
- **Batch operations**: Numbers created in chunks of 1000
- **Pagination**: Number grid paginated (200 per page)

## Security Layers

1. **Network**: HTTPS, CSP headers, rate limiting
2. **Authentication**: Telegram HMAC validation, sessions
3. **Authorization**: Admin checks, user ownership checks
4. **Data Integrity**: Atomic transactions, unique constraints
5. **Blockchain**: On-chain verification, replay protection
6. **Randomness**: Commit-reveal, immutable snapshots
7. **Audit**: Full audit trail of all state changes
