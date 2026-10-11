# Blockers

Items that need human-supplied credentials or decisions before they can be fully implemented.
Agents use mocks/stubs and keep building.

## Credentials Needed

| Credential                                       | Needed for                                  | Status     | Workaround                                                                             |
| ------------------------------------------------ | ------------------------------------------- | ---------- | -------------------------------------------------------------------------------------- |
| Cloudinary cloud name, API key, API secret       | Image uploads (G2)                          | ❌ Missing | Stub upload service, skip image upload in dev                                          |
| Razorpay test key ID, key secret, webhook secret | Payments (G3)                               | ❌ Missing | Mock payment verification, skip gateway call                                           |
| Google Maps API key                              | Reverse-geocoded location labels (optional) | ❌ Missing | Browser geolocation and MongoDB 2dsphere support distance filtering without map labels |
| JWT access secret                                | Auth tokens (G1)                            | ❌ Missing | Use placeholder in .env, document in setup                                             |
| JWT refresh secret                               | Token refresh (G1)                          | ❌ Missing | Use placeholder in .env, document in setup                                             |
| OTP secret                                       | OTP HMAC (G1)                               | ❌ Missing | Use placeholder in .env, document in setup                                             |
| SMTP provider (production)                       | Real email delivery (G5)                    | ❌ Missing | Mailpit in dev                                                                         |
| MongoDB Atlas cluster (production)               | Production database (G5)                    | ❌ Missing | Local MongoDB via Docker                                                               |
| ADMIN_SEED_EMAIL                                 | Admin account seed (G1)                     | ❌ Missing | Default to admin@pccoepune.org in seed                                                 |

## Decisions Needed

| Decision                | Context                                                  | Status                 |
| ----------------------- | -------------------------------------------------------- | ---------------------- |
| Seller payout mechanism | How online payments reach sellers (Razorpay Route?)      | ❌ Out of scope for v1 |
| Auto-completion policy  | What happens if buyer never taps "I received it"         | ❌ Out of scope for v1 |
| Real PCCOE email format | Confirm name.surname24 is universal                      | ❌ Assumed for now     |
| Google Workspace status | Whether PCCOE uses Google Workspace (for Google Sign-In) | ❌ Not required for v1 |

## Listing storage decision

The first listing implementation used Supabase, but publishing returned `503` because the required server-side
service-role key was not configured. At the user's request, listings now use the project's existing MongoDB server;
small JPEG, PNG, and WebP images are stored as binary data with each item record. No Supabase or Cloudinary keys are
required for this listing flow. Resello's HttpOnly-cookie authentication remains authoritative, and the server sets
seller ownership from the authenticated account. The API contract is documented in `docs/openapi.yaml`.

## Local development environment

| Blocker                                                                                | Impact                                                                                                                                                           | Workaround                                                                                                                      |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Docker Desktop daemon was unavailable during the G1 implementation session             | The local MongoDB and Mailpit containers could not be started, so the API and full register → verify browser flow could not be exercised against local services. | Start Docker Desktop and run `docker compose up -d`; the backend tests use `mongodb-memory-server` and a mocked SMTP transport. |
| `npm install` reported 56 dependency audit findings (10 moderate, 44 high, 2 critical) | Findings have not been individually triaged; G5 requires a real dependency security audit.                                                                       | Run `npm audit`, review affected dependency paths, and address safe compatible updates without unrequested major upgrades.      |

## Gate scope note

The spec's acceptance item 8 requires first-time seller onboarding, while the execution plan lists the onboarding screen in G2. The spec takes precedence, so the onboarding screen and its existing API integration were included in the G1 shell. This touches `client/src/features/sell/`, owned by Workstream C.
