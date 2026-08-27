# Compliance & Legal

## ⚠️ Important Notice

This application involves **cryptocurrency payments** and **chance-based prizes**, which may be classified as gambling, gaming, or lottery activity depending on your jurisdiction.

**This document is NOT legal advice. Consult a qualified attorney before deploying.**

## Default Safety Configuration

The application ships with `REAL_MONEY_MODE=false`, which means:
- Only Solana Devnet (test tokens with no real value)
- No real SOL transactions
- No real monetary payouts
- Full game functionality for testing

## Before Enabling Mainnet (REAL_MONEY_MODE=true)

### Legal Checklist

- [ ] Consult gaming/gambling attorney in your jurisdiction
- [ ] Determine if a gambling/gaming license is required
- [ ] Apply for and obtain required licenses
- [ ] Review tax obligations (winnings reporting)
- [ ] Draft Terms of Service
- [ ] Draft Privacy Policy
- [ ] Implement responsible gaming measures
- [ ] Set up dispute resolution process

### Geographic Restrictions

Configure blocked/allowed countries in `.env.local`:

```env
# Block all restricted jurisdictions
BLOCKED_COUNTRIES=US,GB,FR,AU

# Or allowlist approach (more restrictive)
ALLOWED_COUNTRIES=AE,SA
```

Common restricted jurisdictions for gambling:
- United States (varies by state)
- United Kingdom (requires UKGC license)
- France (requires ARJEL license)
- Australia (Interactive Gambling Act)
- Many others

### Age Verification

Configure minimum age:

```env
MINIMUM_AGE=18  # or 21 depending on jurisdiction
```

Implement age verification before allowing participation.

### Financial Compliance

- **AML/KYC**: May be required for payouts above threshold
- **Sanctions**: Screen wallet addresses against sanctions lists
- **Tax reporting**: Report winnings as required by local law

### Technical Requirements for Compliance

1. **Geographic Blocking**: IP-based geolocation to block restricted areas
2. **Age Gates**: Date of birth verification
3. **Self-Exclusion**: Allow users to ban themselves
4. **Deposit Limits**: Configurable spending limits
5. **Reality Checks**: Notifications about time/money spent
6. **Audit Trail**: Complete history of all transactions

## Responsible Gaming

The application includes responsible gaming features:

- Clear display of entry costs
- Probability transparency (show available vs taken numbers)
- Risk warnings in UI
- No misleading language ("guaranteed win", etc.)
- Links to gambling help resources

### Add to Your Terms:

```
This game involves chance. Entry fees are non-refundable.
The probability of winning depends on the number of entries
relative to total purchased numbers. Past results do not
indicate future performance. Only participate with funds
you can afford to lose.
```

## Data Protection

### GDPR Considerations (EU/EEA)
- Privacy policy required
- Right to data access/deletion
- Data processing agreements
- Cookie consent

### CCPA Considerations (California)
- Privacy policy required
- Right to opt-out of data sale
- Disclosure requirements

## Smart Contract / Blockchain Disclaimer

```
This application interacts with the Solana blockchain.
Transactions are irreversible once confirmed.
Wallet addresses are publicly visible on the blockchain.
The operator is not responsible for losses due to
wallet compromise, transaction errors, or blockchain
network issues.
```

## Insurance / Reserve Fund

Consider maintaining a reserve fund to:
- Cover payouts if treasury is compromised
- Handle dispute resolution
- Cover operational costs during low participation

## Regular Audits

- Regular security audits of the application
- Randomness verification audits
- Financial reconciliation audits
- Compliance audits
