# Blockers

Items that need human-supplied credentials or decisions before they can be fully implemented.
Agents use mocks/stubs and keep building.

## Credentials Needed

| Credential | Needed for | Status | Workaround |
|-----------|-----------|--------|------------|
| Cloudinary cloud name, API key, API secret | Image uploads (G2) | ❌ Missing | Stub upload service, skip image upload in dev |
| Razorpay test key ID, key secret, webhook secret | Payments (G3) | ❌ Missing | Mock payment verification, skip gateway call |
| Google Maps API key | Geolocation, distance (G2) | ❌ Missing | Hardcode PCCOE coordinates, skip distance calc |
| JWT access secret | Auth tokens (G1) | ❌ Missing | Use placeholder in .env, document in setup |
| JWT refresh secret | Token refresh (G1) | ❌ Missing | Use placeholder in .env, document in setup |
| OTP secret | OTP HMAC (G1) | ❌ Missing | Use placeholder in .env, document in setup |
| SMTP provider (production) | Real email delivery (G5) | ❌ Missing | Mailpit in dev |
| MongoDB Atlas cluster (production) | Production database (G5) | ❌ Missing | Local MongoDB via Docker |
| ADMIN_SEED_EMAIL | Admin account seed (G1) | ❌ Missing | Default to admin@pccoepune.org in seed |

## Decisions Needed

| Decision | Context | Status |
|---------|---------|--------|
| Seller payout mechanism | How online payments reach sellers (Razorpay Route?) | ❌ Out of scope for v1 |
| Auto-completion policy | What happens if buyer never taps "I received it" | ❌ Out of scope for v1 |
| Real PCCOE email format | Confirm name.surname24 is universal | ❌ Assumed for now |
| Google Workspace status | Whether PCCOE uses Google Workspace (for Google Sign-In) | ❌ Not required for v1 |
