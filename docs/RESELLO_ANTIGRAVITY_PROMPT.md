# RESELLO — Product & Build Specification (v2)

Campus marketplace for pre-owned college goods · Pimpri Chinchwad College of Engineering (PCCOE), Pune
Team: Atharv S. Deshmukh (124B1F091) · Prathmesh Mane (124B1F099) · Samarth Patil (124B1F102)
Stack: React + TypeScript · Node.js/Express · MongoDB · Google Maps · Cloudinary · Razorpay

> **What v2 changes.** (1) Only people with a verified college email can register or log in.
> (2) The site has two separate storefronts, **Buy** and **Sell**, chosen with a Flipkart-style
> switcher at the top of every screen. Everything else follows the Resello SRS, Use Case
> Diagram, Class Diagram and Activity Diagrams already produced for this project.

---

## 1. Non-negotiable rules (read first)

1. **College email only.** Registration and login accept only addresses on an allowed college domain.
   Default allowed domain: `pccoepune.org`. Example of a valid address: `samarth.patil24@pccoepune.org`.
2. **Ownership is proven by OTP.** A 6-digit code is sent to that college inbox. No verified code, no usable account.
3. **One account per person.** There are no separate buyer and seller accounts (SRS §2.3; in the Class Diagram
   Buyer and Seller are roles of one `User`).
4. **Two storefronts inside that one account: Buy and Sell.** A switcher at the very top of every screen
   (like the Flipkart / Flipkart Minutes switch) flips between them. Each storefront has its own home,
   navigation, accent colour and route prefix.
5. **Data is split by relationship, not by account type.** My purchases = orders where `buyer = me`.
   My sales = orders where `seller = me`.
6. **Nobody can buy their own listing.** Own listings are hidden from the Buy feed and search.
7. **Every listing is one unique item.** Quantity is always 1. No quantity steppers, no stock counts.
   (The Class Diagram's `CartItem` has no quantity.)
8. **Admin is a separate role and area** (`/admin`), seeded by a script, never self-registered.
   It is not a third tab in the switcher.
9. **Secrets live only in `.env`.** Use Razorpay and Cloudinary test-mode keys until launch.

---

## 2. Campus identity: college-email registration

### 2.1 Which emails are accepted

| Typed by user                            | Result                            | Reason                                   |
| ---------------------------------------- | --------------------------------- | ---------------------------------------- |
| `samarth.patil24@pccoepune.org`          | Accept                            | Allowed domain                           |
| `SAMARTH.Patil24@PCCOEPUNE.ORG`          | Accept, stored lowercase          | Normalisation                            |
| `samarth.patil24@gmail.com`              | Reject `EMAIL_DOMAIN_NOT_ALLOWED` | Not a college address                    |
| `samarth.patil24@mail.pccoepune.org`     | Reject `EMAIL_DOMAIN_NOT_ALLOWED` | Subdomains only if explicitly listed     |
| `samarth.patil24@pccoepune.org.evil.com` | Reject `EMAIL_DOMAIN_NOT_ALLOWED` | Exact domain match only                  |
| `samarth.patil24+shop@pccoepune.org`     | Reject `EMAIL_ALIAS_NOT_ALLOWED`  | Stops duplicate accounts via `+` aliases |

Rules:

- Allowed domains come from the env var `ALLOWED_EMAIL_DOMAINS` (comma-separated, default `pccoepune.org`).
- Compare the text after the **last** `@`, lowercased, for **exact** equality. Never use `endsWith` or `includes`.
- Enforce on the **server** for register, login, forgot-password and resend. Client checks are only a convenience.
- Name hint: if the local part matches `^([a-z]+)\.([a-z]+)(\d{2})$`, prefill the name field
  ("Samarth Patil") as an editable suggestion. **Do not block** addresses that do not match this pattern;
  only the domain is enforced (staff and other formats may differ).

### 2.2 Registration flow

1. **Join Resello** screen: Full name, College email, Password (with strength meter), Confirm password.
   Helper text under the email field: _"Use your college email, e.g. name.surname24@pccoepune.org"_.
2. Client validates format and domain on blur. Server re-validates everything.
3. `POST /api/auth/register`: normalise → domain check → alias check → uniqueness → create user with
   `emailVerifiedAt = null` → generate OTP → send email → respond `201 { status: "VERIFICATION_REQUIRED", resendAvailableInSec }`.
   - Email already registered and **verified** → `409 EMAIL_TAKEN` ("Already registered — log in"), matching the Register activity diagram.
   - Email registered but **not verified** → resend a fresh code instead of failing.
4. **Verify your college email** screen: six OTP boxes (auto-advance, paste support), masked address
   (`s*****.patil24@pccoepune.org`), resend countdown, and a "Wrong email? Change it" link.
5. `POST /api/auth/verify-email` → set `emailVerifiedAt`, start session, redirect to `/buy`, then show the
   location-permission prompt.
6. Logging in with an unverified account → `403 EMAIL_NOT_VERIFIED` → app routes to the OTP screen and offers resend.

### 2.3 OTP rules

- 6 digits from `crypto.randomInt`. Store an **HMAC-SHA256** of the code (keyed with `OTP_SECRET` + email), never the code itself.
- Expires in 10 minutes (Mongo TTL index). Single use. A new code invalidates all older ones.
- Maximum 5 wrong attempts, then the code is invalidated and a new one is required.
- Resend cooldown 30 s. Maximum 5 codes per hour per email and 20 per hour per IP.
- Constant-time comparison. Never log codes in production.
- **Development:** when `NODE_ENV !== "production"`, print the OTP to the server console and deliver mail to a local
  Mailpit inbox. Never send real mail to `@pccoepune.org` addresses from a dev machine.

### 2.4 Login, sessions, reset

- Login uses college email + password. The same domain check runs first, so non-college addresses never reach the password check.
- Suspended accounts (`isSuspended`) are blocked in **both** storefronts with a clear notice. Their sessions are revoked.
- Access token 15 min + refresh token 30 days with rotation, both in **HttpOnly, Secure cookies**.
  Tokens are never stored in `localStorage`.
- If client and API are on different sites in production, serve both under one registrable domain
  (for example `resello.app` and `api.resello.app`) so `SameSite=Lax` works; otherwise use `SameSite=None; Secure` plus a CSRF token.
- Password reset: code or link is sent only to the verified college inbox.
- Password hashing: bcrypt, at least 10 rounds.

### 2.5 Optional: Google sign-in (only if applicable)

If PCCOE mailboxes are Google Workspace accounts, "Continue with Google" restricted to the hosted domain can
replace the OTP step. The server must verify the ID token's `hd` claim and `email_verified`; the client-side
`hd` hint is not enough. Confirm with PCCOE IT before building this. Not required for v1.

### 2.6 User fields added or changed

`email` (college address, normalised, unique index) · `emailVerifiedAt` · `role` (`STUDENT` | `ADMIN`) ·
`lastActiveMode` (`BUY` | `SELL`, default `BUY`) · `sellerOnboardedAt` · `pickupPreference`.
New collection `OtpToken`: `emailNormalized`, `purpose` (`VERIFY_EMAIL` | `RESET_PASSWORD`), `codeHash`,
`expiresAt`, `attempts`, `consumedAt`, `createdAt`.

---

## 3. Two storefronts: Buy and Sell

The whole marketplace is for verified campus members. Logged-out visitors see only `/welcome`
(what Resello is + "Join with your college email").

### 3.1 The switcher (the Flipkart / Minutes pattern)

- **Placement:** the top-most element of every authenticated screen, above the search bar.
  Mobile: full-width two-segment pill, sticky. Desktop: in the top bar between the logo and the search field.
- **Segments:** `Buy` (bag icon) and `Sell` (store icon). The active segment is filled with that mode's colour;
  a highlight slides between segments in 200 ms.
- **Badges on the inactive segment:** while in Buy mode, `Sell` shows the count of orders waiting for the seller's
  confirmation; while in Sell mode, `Buy` shows unread order updates. Sellers must never miss a new order because they were browsing.
- **On switch:**
  1. Navigate to that mode's last visited route (its home the first time).
  2. Save `lastActiveMode` (fire-and-forget `PATCH /api/me/mode`, also cached locally).
  3. Keep each mode's scroll position and half-filled forms alive (no full reload, no lost state).
  4. Cross-fade header tint, bottom navigation and page content within 300 ms.
  5. Move focus to the new page heading and announce "Switched to Sell mode" via `aria-live="polite"`.
- **Accessibility:** `role="tablist"`; each segment `role="tab"` with `aria-selected`; arrow keys move between segments; Enter/Space activate.
- **Hidden on:** auth screens and `/admin`.

### 3.2 What differs per mode

|                      | **Buy**                            | **Sell**                                                        |
| -------------------- | ---------------------------------- | --------------------------------------------------------------- |
| Purpose              | Find and get items                 | List items and fulfil orders                                    |
| Accent / header tint | Teal                               | Indigo                                                          |
| Home                 | Discovery feed                     | Seller dashboard                                                |
| Search placeholder   | "Search books, calculators…"       | "Search my listings…"                                           |
| Primary action       | Add to cart                        | + Sell an item                                                  |
| Mobile bottom nav    | Home · Search · Cart · Orders · Me | Dashboard · Listings · **+ Sell** (centre button) · Orders · Me |
| Orders means         | Purchases I made                   | Orders I received                                               |
| Route prefix         | `/buy/...`                         | `/sell/...`                                                     |
| Cart                 | Yes (floating cart bar)            | No                                                              |

### 3.3 Routes

- **Buy:** `/buy`, `/buy/search`, `/buy/listing/:id`, `/buy/cart`, `/buy/checkout`, `/buy/orders`, `/buy/orders/:id`, `/buy/wishlist`
- **Sell:** `/sell`, `/sell/listings`, `/sell/listings/new`, `/sell/listings/:id/edit`, `/sell/orders`, `/sell/orders/:id`, `/sell/reviews`
- **Shared (either mode):** `/messages`, `/messages/:id`, `/notifications`, `/profile`, `/settings`
- **Auth:** `/welcome`, `/join`, `/verify`, `/login`, `/forgot`, `/reset`
- **Admin:** `/admin/*`
- `/` redirects to `/${lastActiveMode}`. Deep links open in the mode they belong to.
- Unauthenticated → `/welcome`. Authenticated but unverified → `/verify`.

### 3.4 Links between the two modes

- Opening **my own listing** in Buy shows a banner "This is your listing" with a **Manage in Sell** button
  (switches mode and opens the edit screen). Add-to-cart is disabled.
- The Buy feed and search **exclude my own listings**.
- Buy home carries a small nudge card, "Done with last semester's books? Sell them" → switches to Sell → Quick List.
- A notification is tagged Buy or Sell; tapping it switches to the right mode automatically.
- Messages are shared. A thread is tied to a listing and works from either side.

### 3.5 First-time seller onboarding

The first tap on **Sell** shows one screen (no new account or credentials):
campus location (pin or pick), pickup preference (on-campus meetup / hostel gate / department),
optional phone number for coordination, and acceptance of seller guidelines
(honest descriptions, no prohibited items, COD is cash only). Saving sets `sellerOnboardedAt`.

---

## 4. Design system

Mobile-first (320 / 768 / 1024+). Quick-commerce feel in the spirit of Blinkit and Instamart:
dense card grids, sticky bars, instant feedback, skeleton loaders. Nothing decorative that slows the page.

| Token                                  | Value                             | Use                          |
| -------------------------------------- | --------------------------------- | ---------------------------- |
| `--brand-slate`                        | `#2C3E50`                         | Logo, headings               |
| `--buy-primary` / `--buy-tint`         | `#0F766E` / `#E6F4F1`             | Buy accent / header tint     |
| `--sell-primary` / `--sell-tint`       | `#4338CA` / `#ECEBFF`             | Sell accent / header tint    |
| `--cta` / `--cta-hover`                | `#C2410C` / `#9A3412`             | Primary buttons (white text) |
| `--text` / `--text-muted`              | `#1F2937` / `#4B5563`             | Body / secondary             |
| `--surface` / `--bg`                   | `#FFFFFF` / `#F5F7FA`             | Cards / page                 |
| `--success` / `--warning` / `--danger` | `#15803D` / `#B45309` / `#B91C1C` | Status                       |

- Every text/background pair must reach **4.5:1** (3:1 for large text). The values above are chosen for that;
  verify with axe or a contrast checker rather than trusting this table.
- Font: Inter with a system-font fallback. Body 14–16 px on mobile. Card radius 12 px.
- Motion: 150–300 ms, ease-out. Respect `prefers-reduced-motion` (switcher and transitions become instant).
- Interactions to include: debounced instant search suggestions (< 200 ms after the response), optimistic
  add-to-cart with a toast and a **floating cart bar** ("2 items · ₹550 · View cart"), skeleton loaders, pull-to-refresh
  on feeds, swipe-to-remove in cart, image lazy-loading with blur-up.

---

## 5. Buy storefront

### 5.1 Home (`/buy`)

Location chip · search bar with suggestions · category rail (Books, Electronics, Lab & Drafting, Bags, Furniture,
Stationery, Other) · **Near you** strip (distance chips, e.g. "0.4 km") · **Just listed** grid (2 columns mobile,
3–4 desktop, infinite scroll) · sell-nudge card · floating cart bar when the cart is not empty.
Listing card: image, title (2 lines), price, condition badge, seller first name + rating, distance.

### 5.2 Search and filters (FR-4, FR-5, FR-6)

Keyword plus filters for category, price range, condition, distance and seller rating; a New listings toggle for
items published in the past seven days; sort by newest, price, nearest, top rated. Distance filtering uses the buyer's
browser location only after permission, plus seller campus locations stored with listings. Result count, filter sheet
(drawer on mobile, sidebar on desktop). Location denied → still return results without proximity filtering/ranking
and show a note (Search activity diagram, Alt Flow A).
No results → friendly empty state with "clear filters". Results must render within 2 seconds (NFR-05).

### 5.3 Listing detail (`/buy/listing/:id`)

Image gallery with zoom, price, condition, description, seller card (rating, distance, "message seller"),
reviews summary. Sticky action bar: **Add to cart**, **Save**, **Message**.
States: `ACTIVE` (normal) · `PENDING` ("Reserved — someone is buying this") · `SOLD` · own listing (see 3.4).

### 5.4 Cart and checkout

- Cart is grouped by seller. No quantity, no shipping fee, no tax, no promo codes in v1.
- Checkout in three steps: **(1) Review** items plus an optional handover note (`deliveryNotes`; handover is a
  campus meetup agreed in chat, no shipping address) → **(2) Payment**: Online (Razorpay) or Cash on Delivery
  (cash at handover) → **(3) Confirm and place**.
- Placing the order follows the Checkout activity diagram: each listing is reserved atomically
  (`ACTIVE → PENDING`); if any item was taken meanwhile it is removed with a message (Exception E1).
  Online payment declined → `FAILED`, show error, offer retry or switch to COD (Alt Flow B).
  COD → payment `PENDING_COLLECTION`, no gateway call.
- Confirmation screen: order numbers (copyable), what happens next, buttons to **View orders** and **Keep browsing**.

### 5.5 Orders (buyer)

Tabs Active / Completed / Cancelled. Detail timeline: **Placed → Confirmed by seller → Completed**
(or Cancelled). After campus handover, the buyer and seller each approve completion from their own order view.
The order becomes `COMPLETED` and its listing becomes `SOLD` only after both approvals are recorded.
Buttons: Message seller, approve completion, Rate seller (only after `COMPLETED`), Cancel (only while `PLACED`).

### 5.6 Wishlist, reviews

Wishlist: saved listings, move to cart, remove. Review (Rate and Review activity diagram): only for a
`COMPLETED` order, one review per order, 1–5 stars plus optional comment; seller's average rating updates.

---

## 6. Sell storefront

### 6.1 Dashboard (`/sell`)

Tiles: active listings · orders needing confirmation · completed sales · average rating.
**Needs your action** list (oldest pending order first, with age) · recent messages ·
sales summary (sum of completed order totals, split Online vs COD; **record only**, see §14).

### 6.2 My listings (`/sell/listings`)

Tabs Active / Reserved / Sold / Removed. Actions: edit, delete, mark sold. A listing removed by an admin
shows the reason. Reserved listings cannot be edited or deleted until the order resolves.

### 6.3 Quick List (`/sell/listings/new`)

Goal: a returning seller posts in under a minute.
Photos first (camera or gallery, up to 5, first is the cover) with per-image upload progress →
title → category → condition → price → description → location (default from onboarding) → **Post**.
Images upload straight to Cloudinary using **server-signed** parameters. A failed upload shows an error with
**Retry** or **Cancel** and the listing is not published until images succeed (Create Listing activity diagram).
Field validation errors return the seller to the form. On success the listing is `ACTIVE` and appears in other users' Buy feeds.
Optional nicety: show the median price of similar active listings as a hint.

### 6.4 Incoming orders (`/sell/orders`)

Tabs Needs action / Confirmed / Completed / Cancelled. Each card: item, buyer first name, payment method, total, age.
Actions: **Confirm order** (FR-20) · **Cancel** (with reason; listing returns to `ACTIVE`) · **Message buyer** ·
for COD after handover **Mark cash received** (payment → `COMPLETED`).

### 6.5 Reviews received (`/sell/reviews`)

Average rating, star distribution, list of reviews. Read-only.

---

## 7. Shared screens

- **Messages:** one thread per (pair of users, listing), reachable from both modes. Unread badge. Optional typing indicator.
- **Notifications:** bell in the header in both modes. Each item is tagged Buy or Sell and switches mode on tap.
- **Profile and settings:** name, verified college email with a "Verified" badge, campus location, seller rating,
  change password, notification preferences, logout.

---

## 8. Admin (`/admin`, role `ADMIN` only)

Dashboard (users, active listings, orders, revenue) · Moderation console (UC24 remove listing, UC25 suspend user, per the
Moderate activity diagram: dismiss / remove one listing / suspend account, with notification and audit log) ·
User management (UC23) · Transactions and disputes (UC26, UC27).
Suspending a user revokes their sessions, blocks login in both storefronts and delists their active listings.

---

## 9. Domain model and rules (aligned with the Class Diagram)

Entities: `User` (extends Person), `Administrator`, `Category`, `Listing`, `ProductImage`, `Cart`, `CartItem`,
`Order`, `Payment`, `Message`, `Review`, `WishlistItem`, plus `OtpToken`.
Enums: `ListingStatus` ACTIVE / SOLD / REMOVED / PENDING · `ConditionType` NEW / LIKE_NEW / GOOD / FAIR / POOR ·
`OrderStatus` PLACED / CONFIRMED / COMPLETED / CANCELLED · `PaymentMethod` ONLINE / COD ·
`PaymentStatus` PENDING / COMPLETED / FAILED / PENDING_COLLECTION.

| Event                       | Order                                      | Listing                          | Payment                                     |
| --------------------------- | ------------------------------------------ | -------------------------------- | ------------------------------------------- |
| Checkout placed             | `PLACED`                                   | `ACTIVE → PENDING` (atomic)      | ONLINE `PENDING` · COD `PENDING_COLLECTION` |
| Online payment verified     | unchanged                                  | unchanged                        | `COMPLETED`                                 |
| Online payment failed       | unchanged                                  | unchanged                        | `FAILED` (buyer may retry or switch to COD) |
| Seller confirms             | `CONFIRMED`                                | `PENDING`                        | unchanged                                   |
| Buyer approves completion   | unchanged until seller approval            | `PENDING`                        | unchanged                                   |
| Seller approves completion  | `COMPLETED` only if buyer already approved | `SOLD` only when order completes | unchanged                                   |
| Cancelled before completion | `CANCELLED`                                | `PENDING → ACTIVE`               | unchanged or refunded per §14               |

- One checkout creates **one `Order` per listing** (as `Cart.checkout()` returns `List<Order>`), each with one `Payment`.
  For an online payment covering several sellers, create one Razorpay order for the total and stamp the same
  `transactionRef` on every `Payment`.
- Reservation must be atomic: `findOneAndUpdate({ _id, status: "ACTIVE" }, { status: "PENDING" })`. If it returns null the item is unavailable.
- A review requires `Order.status = COMPLETED` and no existing review for that order.
- Listings carry a GeoJSON `location` (copied from the seller's campus location) with a `2dsphere` index for nearby queries.

---

## 10. API (REST, JSON)

**Auth (public)**
`POST /api/auth/register` · `/verify-email` · `/resend-otp` · `/login` · `/logout` · `/refresh` · `/forgot-password` · `/reset-password`
`GET /api/auth/me` (user, `lastActiveMode`, seller-onboarded flag, badge counts)

**Account and mode**
`PATCH /api/me/mode` · `POST /api/me/seller-onboarding` · `GET /api/me/badges`

**Buy**
`GET /api/listings` (search, filters, sort, pagination, `excludeMine=true`) · `GET /api/listings/nearby` · `GET /api/listings/:id`
`GET/POST/DELETE /api/cart/items` · `POST /api/checkout` · `POST /api/payments/verify` · `POST /api/payments/webhook`
`GET /api/orders` (buyer or seller) · `GET /api/orders/:id` · `POST /api/orders/:id/cancel` · `POST /api/orders/:id/completion-approval` · `POST /api/orders/:id/rating` (buyer, completed order only)
`GET/POST/DELETE /api/wishlist` · `POST /api/reviews`

**Sell**
`GET /api/seller/dashboard` · `GET/POST /api/seller/listings` · `PUT/DELETE /api/seller/listings/:id` · `POST /api/seller/listings/:id/mark-sold`
`POST /api/seller/uploads/sign` · `GET /api/seller/orders` · `POST /api/seller/orders/:id/confirm` · `/cancel` · `/cash-received`
`GET /api/seller/reviews`

**Shared and admin**
`GET/POST /api/messages` · `PUT /api/messages/:id/read` · `GET /api/notifications`
`GET /api/admin/stats` · `/moderation` · `POST /api/admin/actions/remove-listing` · `/suspend-user` · `GET /api/admin/users` · `/transactions`

Error format: `{ "error": { "code": "EMAIL_DOMAIN_NOT_ALLOWED", "message": "…" } }`. Every `/api/seller/*` route checks
ownership server-side (`seller === me`); every buyer route checks `buyer === me`. The active mode is a UI concept and is **never** trusted for authorisation.

---

## 11. Integrations

- **Google Maps:** browser geolocation → reverse geocode for the location chip; distance for cards; nearby query via MongoDB `2dsphere`. Restrict keys by referrer (client) and IP (server).
- **Cloudinary:** server-signed uploads, max 10 MB per image, delivery with `f_auto,q_auto` and responsive widths, folder per listing.
- **Razorpay:** create the order on the server (amount in paise), open Razorpay Checkout in the browser by loading its script
  (not an npm import in the client), **verify the signature on the server**, and handle the webhook with signature verification.
- **Email (SMTP):** OTP, password reset, order notifications. Institutional mail servers sometimes quarantine automated
  mail, so test with a real PCCOE inbox early and set up SPF/DKIM for the sending domain.

---

## 12. Non-functional requirements

- **Performance:** search results < 2 s (NFR-05); LCP < 2.5 s; route-level code splitting; images lazy-loaded.
- **Security:** Helmet, CORS limited to the client origin, express-validator on every input, rate limits on auth and OTP routes,
  no secrets in the repo, HTTPS only, dependency audit with no high or critical findings.
- **Accessibility:** WCAG 2.1 AA, keyboard-operable switcher, visible focus, labelled controls, alt text, reduced-motion support.
- **Responsive:** verified at 360, 768 and 1280 px in both modes.

---

## 13. Acceptance criteria

1. **Given** the email `samarth.patil24@pccoepune.org`, **when** I register and enter the OTP sent to it, **then** my account is verified and I land on `/buy`.
2. **Given** `x@gmail.com`, `x@mail.pccoepune.org`, `x@pccoepune.org.evil.com` or `x+a@pccoepune.org`, **when** I register, **then** the server rejects each with the correct error code and sends no email.
3. **Given** a wrong OTP entered 5 times, **then** the code is invalidated and login stays blocked until a new code is verified.
4. **Given** an expired or already-used OTP, **then** verification fails.
5. **Given** I am logged in, **then** the Buy | Sell switcher is the top element on every non-auth, non-admin screen and is keyboard-operable.
6. **Given** I am in Buy mode and switch to Sell and back, **then** my Buy scroll position, search text and cart are unchanged.
7. **Given** I refresh the page while in Sell mode, **then** I return to Sell (mode persisted).
8. **Given** I tap Sell for the first time, **then** I see onboarding once and never again after completing it.
9. **Given** I have a listing, **then** it never appears in my own Buy feed or search, and I cannot add it to my cart.
10. **Given** a seller posts a listing, **then** a different verified user sees it in Buy within the 2-second search target.
11. **Given** two buyers check out the same listing at the same moment, **then** exactly one succeeds and the other gets "no longer available".
12. **Given** an order is `PLACED`, **then** the seller sees it under **Needs action**, and the `Sell` badge shows a count while the seller browses in Buy mode.
13. **Given** COD is chosen, **then** no gateway call happens and the payment is `PENDING_COLLECTION`.
14. **Given** an order is not `COMPLETED`, **then** the review option is unavailable; **given** it is completed, **then** only one review per order is accepted.
15. **Given** a suspended user, **then** login is blocked and their listings are delisted.
16. Axe reports no serious or critical violations on Buy home and Sell dashboard.

---

## 14. Out of scope and open questions

- **Seller payouts.** How online payments reach sellers (manual settlement or Razorpay Route) is undecided. v1 only records payments.
- **Refunds** for cancelled online orders: record the intent, no automation in v1.
- **Auto-completion policy** if either order participant never approves handover completion is undecided; disputes go to admin.
- **Real PCCOE email formats and domains.** Confirm whether students and staff share `pccoepune.org`, and whether the `name.surname24` pattern is universal.
- **Google Workspace** status of PCCOE mailboxes (see 2.5).
- **Graduating students:** college mailboxes may be deactivated after graduation; periodic re-verification is not in v1.
- **Dropped from v1 of this document** because they are not in the SRS: shipping fees, tax, promo codes, quantity selectors, "in transit" status.
- Web push notifications are optional.
