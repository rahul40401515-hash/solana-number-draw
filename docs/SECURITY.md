# Security Model

## Threat Model

| Threat | Mitigation |
|--------|-----------|
| Fake Telegram auth | Server-side HMAC-SHA256 validation |
| Race condition (double buy) | Atomic DB transactions + unique constraints |
| Payment replay | Unique transaction signature tracking |
| Fake payment claims | On-chain verification before confirmation |
| Admin abuse | Full audit logging + separation of duties |
| Bot/automation | Rate limiting + Telegram auth required |
| Private key exposure | Never in frontend, env-only on backend |
| XSS/CSRF | CSP headers, input sanitization, no dangerous eval |
| Database injection | Prisma ORM (parameterized queries) |

## Authentication

### Telegram WebApp

```typescript
// Server validates initData from Telegram
// Uses HMAC-SHA256 with bot token as key
// Timing-safe comparison prevents side-channel attacks
```

### Session Tokens

- Stored in database with expiry
- Rotated on each request in production
- Associated with IP + user agent

### Admin Access

- Separate ADMIN_SECRET required
- Optional 2FA via TOTP
- All admin actions logged

## Authorization

- Users can only reserve/purchase for their own account
- Users can only release their own reservations
- Admin endpoints require admin authentication
- No user can modify another user's data

## Data Integrity

### Atomic Operations

All critical operations use database transactions:
- Number reservation: check + reserve in one atomic step
- Purchase confirmation: verify payment + update number + create record
- Draw execution: snapshot + select + store in one transaction

### Unique Constraints

- `UNIQUE(round_id, number_value)` - prevents duplicate number assignments
- `UNIQUE(transaction_signature)` - prevents payment replay
- `UNIQUE(round_id, rank)` - prevents duplicate winner ranks

## Blockchain Verification

Before confirming any purchase:

1. ✅ Transaction exists on Solana blockchain
2. ✅ Transaction is confirmed (not pending)
3. ✅ Sender wallet matches claimed wallet
4. ✅ Recipient is the treasury wallet
5. ✅ Amount matches entry price (±tolerance)
6. ✅ Network is correct (devnet/mainnet)
7. ✅ Transaction signature not already used

## Rate Limiting

- API routes: 100 requests/minute per IP
- Number reservation: 10 reservations/minute per user
- Payment verification: 5 verifications/minute per user
- Admin endpoints: 30 requests/minute per admin

## Private Key Management

### NEVER Store Private Keys:
- ❌ In frontend code
- ❌ In client-side bundles
- ❌ In git repositories
- ❌ In browser-accessible env vars

### Production Key Storage:
- ✅ Hardware Security Module (HSM)
- ✅ AWS KMS / GCP KMS
- ✅ HashiCorp Vault
- ✅ Multisig wallet for payouts

## Safety Switch

```env
REAL_MONEY_MODE=false  # DEFAULT - Devnet only
```

When `false`:
- Only Solana Devnet connections
- Mock payments accepted
- No real SOL transfers
- No real payouts

To enable mainnet:
1. Set `REAL_MONEY_MODE=true`
2. Configure mainnet RPC endpoint
3. Set treasury wallet on mainnet
4. Complete compliance checklist (see COMPLIANCE.md)

## Audit Trail

Every state change is logged:

| Event | Data Stored |
|-------|------------|
| ROUND_CREATED | Round config, admin who created |
| ROUND_OPENED | Timestamp |
| NUMBER_RESERVED | User, number, expiry |
| PURCHASE_CONFIRMED | TX signature, amount |
| ROUND_CLOSED | Final entry count |
| DRAW_EXECUTED | Winners, randomness proof |
| PAYOUT_SENT | TX signature, amount |

## Security Headers

All responses include:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy` (restricted)
- HTTPS-only cookies in production
