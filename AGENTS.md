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
