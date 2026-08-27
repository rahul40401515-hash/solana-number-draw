# API Reference

## Authentication

All user endpoints require authentication via one of:
- `Authorization: Bearer <session_token>` header
- `x-telegram-init-data: <initData>` header

Admin endpoints require:
- `x-admin-secret: <admin_secret>` header

## Public Endpoints

### GET /api/game/current

Get the current active game round.

**Response:**
```json
{
  "success": true,
  "data": {
    "round": {
      "id": "uuid",
      "roundNumber": 1,
      "title": "Monthly Number Draw #001",
      "status": "OPEN",
      "startAt": "2024-01-01T00:00:00Z",
      "endAt": "2024-02-01T00:00:00Z",
      "entryPriceLamports": "50000000",
      "numberMin": 1,
      "numberMax": 5000,
      "winnerCount": 5,
      "prizePoolLamports": "12500000000",
      "totalEntries": 250,
      "network": "devnet"
    },
    "stats": {
      "totalNumbers": 5000,
      "available": 4750,
      "taken": 250,
      "reserved": 0,
      "soldPercent": 5
    }
  }
}
```

### GET /api/numbers?roundId=xxx&page=1&pageSize=200&filter=available&search=123

Get number grid data for a round.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| roundId | string | Required. Round UUID |
| page | number | Page number (default: 1) |
| pageSize | number | Items per page (default: 200) |
| filter | string | "available", "taken", "reserved" |
| search | number | Search for specific number |

## Authenticated Endpoints

### POST /api/auth/telegram

Authenticate with Telegram WebApp initData.

**Request:**
```json
{
  "initData": "<telegram_webapp_initData>"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "session_token",
    "user": {
      "id": "uuid",
      "username": "player1",
      "firstName": "John",
      "walletAddress": null,
      "isAdmin": false
    }
  }
}
```

### POST /api/numbers (Reserve Number)

Reserve a number for purchase.

**Request:**
```json
{
  "roundId": "round-uuid",
  "number": 123
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "reservationId": "uuid",
    "number": 123,
    "expiresAt": "2024-01-15T12:05:00Z"
  }
}
```

**Errors:**
- `NUMBER_ALREADY_TAKEN` - Someone else bought this number
- `NUMBER_ALREADY_RESERVED` - Currently reserved by another user
- `ROUND_CLOSED` - Round is not accepting entries
- `RESERVATION_EXPIRED` - Previous reservation expired

### DELETE /api/numbers?roundId=xxx&number=123

Release a reservation.

### POST /api/purchases (Verify Payment)

Verify a Solana transaction and confirm purchase.

**Request:**
```json
{
  "roundId": "round-uuid",
  "number": 123,
  "transactionSignature": "5xxxx...",
  "walletAddress": "WalletPublicKey..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "number": 123,
    "transactionSignature": "5xxxx...",
    "amountLamports": "50000000",
    "status": "CONFIRMED"
  }
}
```

**Errors:**
- `PAYMENT_NOT_FOUND` - TX not on blockchain
- `PAYMENT_AMOUNT_INVALID` - Wrong amount sent
- `PAYMENT_ALREADY_USED` - TX already used for another purchase
- `PAYMENT_NETWORK_INVALID` - Wrong network (e.g., mainnet vs devnet)
- `WALLET_INVALID` - Invalid wallet address format

### GET /api/draw/:id

Get draw data for a round.

### GET /api/results/:id

Get completed round results.

## Admin Endpoints

### GET /api/admin/rounds

Get dashboard data and round list.

### POST /api/admin/rounds

Create a new round.

**Request:**
```json
{
  "roundNumber": 2,
  "title": "Monthly Draw #002",
  "startAt": "2024-02-01T00:00:00Z",
  "endAt": "2024-03-01T00:00:00Z",
  "entryPriceLamports": "50000000",
  "numberMin": 1,
  "numberMax": 5000,
  "winnerCount": 5,
  "operatorFeePercent": 0
}
```

### POST /api/admin/rounds/:id

Manage round lifecycle.

**Request:**
```json
{
  "action": "open" | "pause" | "resume" | "close" | "cancel"
}
```

### POST /api/admin/draws/:id

Execute the draw for a closed round.

## Error Format

All errors follow this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| NUMBER_ALREADY_TAKEN | 409 | Number purchased by another user |
| NUMBER_ALREADY_RESERVED | 409 | Number reserved by another user |
| RESERVATION_EXPIRED | 400 | Reservation timed out |
| PAYMENT_NOT_FOUND | 400 | TX not found on chain |
| PAYMENT_AMOUNT_INVALID | 400 | Wrong payment amount |
| PAYMENT_ALREADY_USED | 409 | TX already used |
| PAYMENT_NETWORK_INVALID | 400 | Wrong network |
| WALLET_INVALID | 400 | Bad wallet address |
| ROUND_CLOSED | 400 | Round not accepting entries |
| ROUND_NOT_STARTED | 400 | Round hasn't started |
| ROUND_NOT_FOUND | 404 | Invalid round ID |
| DRAW_ALREADY_EXECUTED | 400 | Draw already done |
| USER_BLOCKED | 403 | Account suspended |
| UNAUTHORIZED | 401 | Auth required/invalid |
| RATE_LIMITED | 429 | Too many requests |
