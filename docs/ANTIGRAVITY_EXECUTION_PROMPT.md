# RESELLO — Antigravity Execution Prompt (v2)

How to get Google Antigravity to build Resello from the specification: setup, standing rules, a gated build order,
who owns what, and prompts you can paste. Read together with:

- `RESELLO_ANTIGRAVITY_PROMPT.md` — the specification (college-email registration, Buy | Sell storefronts, rules, API)
- `RESELLO_UI_UX_WIREFRAMES.md` — layouts, switcher behaviour, components

---

## 1. Setup (about 15 minutes, done by you)

1. Create a folder `resello/`, run `git init`, and create `docs/` inside it.
2. Copy all three files (this one, the spec, the wireframes) into `resello/docs/`. Keep the file names.
3. Create `resello/AGENTS.md` and paste the block in **§2**. Antigravity agents read `AGENTS.md` at the workspace root
   for standing instructions. (The name of the optional rules folder differs between Antigravity versions, so rely on `AGENTS.md`.)
4. Open `resello/` as the workspace in Antigravity. In the Agent Manager pick the model you have access to
   and choose the **Review-driven** autonomy profile, so agents stop for your approval at checkpoints instead of running unattended.
5. Install Docker (for local MongoDB and Mailpit) and Node 20+.
6. In the Agent Manager, start **one conversation per workstream** and paste the kickoff prompts from **§6**, one gate at a time.
   Each request runs as its own agent and publishes Artifacts (plans, screenshots, recordings) that you can comment on.
7. Review each gate's artifact against its acceptance list. Approve, or comment, before starting the next gate.

Practical notes:
- The free preview has usage limits that reset periodically. The gates below are sized so one gate fits comfortably; if you hit a limit, pause and resume at the same gate.
- Agents work in minutes to hours, not days. There are no daily meetings. Progress is checked at gates.

---

## 2. `AGENTS.md` (paste as the file's content)

```markdown
# AGENTS.md — Resello

You are building Resello, a campus marketplace for PCCOE students.
Before any task, read /docs/RESELLO_ANTIGRAVITY_PROMPT.md (spec), /docs/RESELLO_UI_UX_WIREFRAMES.md (layout)
and /docs/ANTIGRAVITY_EXECUTION_PROMPT.md (gates and ownership). If documents disagree, the spec wins.
If the human's instruction disagrees with the spec, raise it in your artifact instead of silently choosing.

## Non-negotiables
1. College-email-only registration and login, proven by OTP (spec section 2). The allowed domains come from
   ALLOWED_EMAIL_DOMAINS (default pccoepune.org). Compare the text after the last "@" for exact equality, on the SERVER.
   Reject aliases containing "+".
2. One account per person. Two storefronts inside it: Buy (/buy/*) and Sell (/sell/*), switched by a ModeSwitcher at the
   top of every authenticated screen (spec section 3). The active mode is UI state only. Authorise on the server by
   ownership (buyer === me, seller === me), never by mode.
3. Every listing is one unique item. No quantity, shipping fees, tax or promo codes.
4. Users cannot buy their own listings; own listings are excluded from Buy feeds and search.
5. Checkout reserves a listing atomically (ACTIVE -> PENDING) to prevent double-selling.
6. No secrets in code or git. Use .env (gitignored) and .env.example. Use Razorpay and Cloudinary TEST keys.
7. Auth tokens live in HttpOnly cookies, never localStorage.
8. Verify Razorpay signatures on the server. Load Razorpay Checkout via its script tag; do not import it in the client bundle.
9. Never send real email from a dev machine. In development, print OTPs to the server console and deliver mail to Mailpit.

## Stack and conventions
TypeScript everywhere.
client/: Vite + React 18, React Router 6, Tailwind, TanStack Query, Zustand (UI and mode state), React Hook Form + Zod, Framer Motion, lucide-react.
server/: Node 20, Express, Mongoose, Zod validation, Helmet, express-rate-limit, Jest + Supertest, mongodb-memory-server.
e2e/: Playwright. Lint with ESLint, format with Prettier. Conventional commits. One branch per workstream, e.g. feat/backend-auth.

## Contract first
docs/openapi.yaml is the single source of truth for the API. Change it first, then the code, and mention the change in your artifact.
The frontend uses MSW mocks derived from the contract until the real endpoint lands.

## Reporting (important)
Report only what you actually ran: the command and a summary of its output. Never write coverage, Lighthouse, accessibility
or performance numbers you did not measure. If you could not run something, say so plainly.

## Blockers
If a credential or decision is missing, add it to docs/BLOCKERS.md, use a mock or stub, and keep going.

## Working style
Work gate by gate. At the start of a task publish a short plan artifact. At the end of a gate stop and publish:
(1) what changed, (2) how to run it, (3) screenshots or a browser recording of the acceptance flows in BOTH storefronts,
(4) test output summary, (5) open issues. Do not begin the next gate until the human approves.

## Do not
Add features not in the spec. Restructure folders. Upgrade major dependency versions unprompted.
Edit files owned by another workstream without noting it in your artifact.
```

---

## 3. Repository layout

```
resello/
├─ AGENTS.md
├─ docs/                     spec, wireframes, this file, openapi.yaml, BLOCKERS.md, SEED.md
├─ docker-compose.yml        MongoDB + Mailpit (web UI on http://localhost:8025)
├─ client/                   Vite + React + TS
│  └─ src/
│     ├─ app/                router, ModeShell, guards, providers
│     ├─ styles/tokens.css   colour, spacing and motion tokens from spec section 4
│     ├─ components/ui/      shared primitives
│     └─ features/
│        ├─ auth/  buy/  sell/  shared/  admin/
├─ server/                   Express + TS
│  └─ src/  models/ routes/ controllers/ middleware/ validators/ services/ config/
├─ shared/                   types generated from openapi.yaml
└─ e2e/                      Playwright specs
```

File ownership (to avoid merge conflicts):

| Workstream | Owns |
|---|---|
| **A — Backend** | `server/**` except `server/src/services/**` |
| **B — Frontend: shell, auth, Buy** | `client/src/app/**`, `client/src/styles/**`, `client/src/components/ui/**`, `client/src/features/{auth,buy,shared}/**` |
| **C — Frontend: Sell and Admin** | `client/src/features/{sell,admin}/**` |
| **D — Integrations and QA** | `server/src/services/**`, `e2e/**`, CI config, `docker-compose.yml`, seed script |

The design tokens and `ModeSwitcher` are built by B at G1; C consumes them from G2 onward.

---

## 4. Gates

Each gate ends with a stop-and-review. Acceptance numbers refer to the spec's section 13.

### G0 — Foundation and contract (one agent, run as workstream A)
Deliver: monorepo scaffold with lint, format and test tooling; `docker-compose.yml` (MongoDB + Mailpit); both `.env.example` files;
`docs/openapi.yaml` covering every endpoint in spec §10 with schemas and error codes; `client/src/styles/tokens.css` from spec §4;
`shared/` types generated from the contract; `docs/SEED.md` describing the seed data plan.
Accept when: `docker compose up` starts MongoDB and Mailpit; `npm run dev` starts client and server; `/api/health` returns OK;
`npm run lint` and `npm test` pass; the OpenAPI file lints cleanly.

### G1 — Identity and shell (A, B and D in parallel)
- **A:** `User` and `OtpToken` models; register, verify-email, resend-otp, login, logout, refresh, forgot and reset password, `me`;
  the domain and alias validator with unit tests; OTP generation, hashing, expiry, attempt limits and rate limits; HttpOnly cookies;
  `PATCH /api/me/mode`; admin seed script (refuses to run when `NODE_ENV=production`).
- **B:** `/welcome`, `/join`, `/verify`, `/login`, `/forgot`, `/reset`; `ModeShell`, `ModeSwitcher` (all behaviour in spec §3.1), both bottom navs,
  placeholder homes for Buy and Sell, route guards. Use MSW mocks until A's endpoints exist.
- **D:** SMTP and Mailpit mail service and the OTP email template; Playwright setup; CI workflow (lint, unit tests, e2e smoke);
  email-validation fixtures (see §8).
- **Accept when:** acceptance items 1–8 pass, and item 16 passes on the placeholder screens.

### G2 — Sell to Buy loop (A, B, C and D)
- **A:** `Category`, `Listing`, `ProductImage`; seller listings CRUD; search, filters, sorting and nearby (`2dsphere`) with `excludeMine`;
  seller onboarding; signed upload params.
- **B:** Buy home, search and filters, listing detail with all variants (own, `PENDING`, `SOLD`), wishlist.
- **C:** seller onboarding screen, Sell dashboard (real listing data), My listings, Quick List with `ImageUploader` (progress, retry, remove).
- **D:** Cloudinary signing service; Maps helpers (reverse geocode, distance); seed script with categories and demo listings;
  e2e "seller posts a listing → another user finds it in Buy".
- **Accept when:** items 9 and 10 pass.

### G3 — Transact (A, B, C and D)
- **A:** cart; checkout with atomic reservation and one order per listing; payments (ONLINE and COD); Razorpay order, verify and webhook;
  seller confirm, cancel and cash-received; buyer cancel and confirm-receipt; reviews; messages; real badge counts; notifications.
- **B:** cart, three-step checkout with the failure and unavailable states, buyer orders and order detail timeline, review form, messages UI, notifications list.
- **C:** Sell orders (needs action, confirmed, completed, cancelled), order actions, reviews received, badge wiring on the switcher.
- **D:** Razorpay test-mode service and signature tests; concurrency test for double checkout; full e2e with two users (buyer and seller).
- **Accept when:** items 11–14 pass and the full two-user loop runs end to end.

### G4 — Admin and polish (A, B, C and D)
- **A:** admin stats, moderation actions, user management, transactions; suspension revokes sessions and delists listings.
- **C:** admin UI. **B and C:** loading, empty and error states on every screen, motion (with reduced-motion), responsive checks at 360 / 768 / 1280 px in both modes, accessibility fixes.
- **D:** axe scans of both modes, Lighthouse runs, a small API load smoke test. Report the **actual** numbers; targets are in spec §12, and if a target is missed, list the top causes.
- **Accept when:** items 15 and 16 pass.

### G5 — Hardening and deploy (all)
Security checklist run for real (`npm audit`, headers, rate limits proven by tests, secret scan); a README with setup steps;
deployment configuration; smoke tests against the deployed URL; a final QA report with measured results; and a
**demo script** for your viva that walks two accounts (one buying, one selling) through the full loop.

---

## 5. Workstream briefs

**A — Backend.** Implement exactly what the contract says. Every seller route checks `seller === me`; every buyer route checks
`buyer === me`. Validate all input with Zod. Put the domain and alias check in one module (`validators/collegeEmail.ts`) with its own tests,
and call it from register, login, forgot-password and resend. Use `findOneAndUpdate({ _id, status: "ACTIVE" }, { status: "PENDING" })` for reservation.
Return errors in the `{ error: { code, message } }` format.

**B — Frontend: shell, auth, Buy.** Build `ModeShell` so both modes stay mounted; that is how scroll position, search text and forms survive a switch.
Follow the wireframes and the token table. Build the floating cart bar, optimistic add-to-cart, skeletons and instant search suggestions.
No quantity steppers anywhere.

**C — Frontend: Sell and Admin.** Reuse B's tokens and primitives. Sell has its own home, navigation and indigo theme.
The `+` centre button in the Sell bottom nav opens Quick List. Show the `Buy` badge and `Needs action` counts from `/api/me/badges`.

**D — Integrations and QA.** Wrap third parties behind small service interfaces (`mail`, `storage`, `payments`, `maps`) so they can be mocked in tests.
Test mode only. Write tests before claiming anything works, and record real results.

---

## 6. Kickoff prompts (paste into the Agent Manager)

**G0**
```
Read /AGENTS.md, /docs/RESELLO_ANTIGRAVITY_PROMPT.md, /docs/RESELLO_UI_UX_WIREFRAMES.md and
/docs/ANTIGRAVITY_EXECUTION_PROMPT.md completely. Execute Gate G0 only (section 4 of the execution document).
First publish an implementation plan artifact and wait for my approval. Then build. Stop at the end of G0 and publish
the gate artifact described in AGENTS.md.
```

**G1, Workstream A (Backend)**
```
You are Workstream A for Gate G1. Read /AGENTS.md and the three docs. Build only the Workstream A items listed under G1,
following docs/openapi.yaml (update it first if you must change the contract, and say so). Requirements to prove with tests:
samarth.patil24@pccoepune.org is accepted; gmail, subdomain, look-alike domain and "+" alias addresses are rejected with the
correct error codes and no email is sent; OTP expiry, single use and the 5-attempt limit work. Publish a plan artifact first,
then implement, then stop with the gate artifact.
```

**G1, Workstream B (Frontend: shell, auth, Buy)**
```
You are Workstream B for Gate G1. Read /AGENTS.md and the three docs. Build only the Workstream B items under G1.
The ModeSwitcher must match spec section 3.1 and wireframe section 1 exactly (placement, badges, 300 ms transition,
keyboard support, aria-live announcement, state preserved across switches). Use MSW mocks generated from docs/openapi.yaml
until Workstream A's endpoints are live. In your gate artifact include a browser recording that shows: register with a
college email, OTP verification, landing on /buy, switching to Sell and back with scroll position preserved.
```

**G1, Workstream D (Integrations and QA)**
```
You are Workstream D for Gate G1. Read /AGENTS.md and the three docs. Build only the Workstream D items under G1.
Create the email-validation fixture table from the execution document section 8 and the Playwright setup with a smoke test
for the register -> verify -> /buy flow reading the OTP from Mailpit. Report only test results you actually ran.
```

**Gates G2 to G4 (template)**
```
You are Workstream {A|B|C|D} for Gate {G2|G3|G4}. Read /AGENTS.md and the three docs. Your items are listed under that gate
in section 4 of the execution document, and you own only the files in section 3. Use docs/openapi.yaml as the contract.
Publish a plan artifact first, implement, then stop with the gate artifact. Do not start another gate.
```

**G5**
```
Execute Gate G5. Run the security checklist for real, produce the README, deployment config and smoke tests, the final QA
report with measured results only, and the two-account viva demo script.
```

---

## 7. Environment variables and what you must supply

Server `.env` (never commit):
```
PORT=5000
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173
MONGODB_URI=mongodb://localhost:27017/resello
ALLOWED_EMAIL_DOMAINS=pccoepune.org
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
OTP_SECRET=
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
MAIL_FROM="Resello <no-reply@your-domain>"
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
GOOGLE_MAPS_API_KEY=
ADMIN_SEED_EMAIL=
```
Client `.env`:
```
VITE_API_BASE_URL=http://localhost:5000/api
VITE_GOOGLE_MAPS_API_KEY=
VITE_CLOUDINARY_CLOUD_NAME=
VITE_RAZORPAY_KEY_ID=
```

You must provide (agents cannot create these for you): a Cloudinary account, Razorpay **test** keys, a Google Cloud project with a Maps key,
strong random values for the three secrets, and, before launch, an SMTP provider and a MongoDB Atlas cluster.
Until then agents use Mailpit, local MongoDB and mocks, and log what they stubbed in `docs/BLOCKERS.md`.

---

## 8. Test plan (specific cases)

**Email validation fixtures**

| Input | Expected |
|---|---|
| `samarth.patil24@pccoepune.org` | Accepted |
| `SAMARTH.Patil24@PCCOEPUNE.ORG` | Accepted, stored lowercase, same account as above |
| `samarth.patil24@gmail.com` | `EMAIL_DOMAIN_NOT_ALLOWED`, no mail sent |
| `samarth.patil24@mail.pccoepune.org` | `EMAIL_DOMAIN_NOT_ALLOWED` |
| `samarth.patil24@pccoepune.org.evil.com` | `EMAIL_DOMAIN_NOT_ALLOWED` |
| `samarth.patil24@evilpccoepune.org` | `EMAIL_DOMAIN_NOT_ALLOWED` |
| `samarth.patil24+shop@pccoepune.org` | `EMAIL_ALIAS_NOT_ALLOWED` |
| `not-an-email` | Validation error |

**Behaviour tests:** OTP wrong five times invalidates the code; expired code fails; used code fails; resend cooldown and hourly cap enforced;
unverified login returns `EMAIL_NOT_VERIFIED`; suspended user is blocked in both modes; `PATCH /api/me/mode` does not change what the user
is authorised to do (a seller route still rejects another seller's resource in either mode); own listing excluded from feed and blocked from cart;
double checkout race yields exactly one success; COD makes no gateway call; Razorpay tampered signature is rejected; review only after `COMPLETED`, once per order.

**UI tests (Playwright):** switcher works by mouse and keyboard; mode persists across reload; Buy scroll position and cart survive Buy → Sell → Buy;
Sell badge appears in Buy when an order is pending; first-time Sell shows onboarding once. Run axe on Buy home, Sell dashboard, Join and Verify.
Take screenshots of both modes at 360, 768 and 1280 px.

**Seed data (dev only):** categories; two test students (`test.buyer24@pccoepune.org`, `test.seller24@pccoepune.org`) with fixed dev passwords documented in `docs/SEED.md`;
15 demo listings across categories; one admin from `ADMIN_SEED_EMAIL`. The seed script must refuse to run when `NODE_ENV=production`.

---

## 9. Definition of done

- Every acceptance item in spec §13 passes, shown by tests or recordings, not by assertion.
- Both storefronts work on a phone-sized viewport and on desktop.
- No secrets in the repository; `npm audit` shows no high or critical findings.
- The README lets a new teammate run the project in under ten minutes.
- The final QA report contains only measured results, and lists anything that missed its target.

---

## 10. Deployment notes (G5)

Host the client as a static site and the server as a Node service, with MongoDB Atlas for the database. Put both under one registrable
domain (for example `resello.app` and `api.resello.app`) so cookies work with `SameSite=Lax`. Use a real SMTP provider with SPF and DKIM,
and send a test OTP to a real PCCOE inbox before you rely on it. Switch Razorpay and Cloudinary to production keys only after the full test
loop passes. Check each host's current free-tier limits and terms before choosing; they change.
