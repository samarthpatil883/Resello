# RESELLO — UI/UX Wireframes & Component Guide (v2)

Companion to `RESELLO_ANTIGRAVITY_PROMPT.md`. The spec decides behaviour; this file decides layout.
Wireframes are 360 px mobile unless marked otherwise. `[x]` = button/control, `(o)` = selected radio,
`( )` = unselected radio, `[bell]`/`[img]` = icons or images.

---

## 1. The Buy | Sell switcher (top of every authenticated screen)

### 1.1 The two states

```
BUY MODE (teal header tint)
+------------------------------------+
| RESELLO  @ PCCOE Hostel A v  [bell]|
| +---------------+----------------+ |
| |##### BUY #####|   SELL  (3)    | |
| +---------------+----------------+ |
| [ Search books, calculators...   ] |
+------------------------------------+

SELL MODE (indigo header tint)
+------------------------------------+
| RESELLO  @ PCCOE Hostel A v  [bell]|
| +---------------+----------------+ |
| |  BUY  (1)     |##### SELL #####| |
| +---------------+----------------+ |
| [ Search my listings...          ] |
+------------------------------------+
```

- `(3)` on the inactive segment = orders waiting for seller confirmation (shown on `Sell` while in Buy).
  `(1)` on `Buy` while in Sell = unread order updates. Cap the display at `9+`.
- The location chip and bell are shared. Only the switcher, tint, search placeholder, content and bottom nav change.

### 1.2 Transition timeline (total under 300 ms)

| t (ms) | What happens |
|---|---|
| 0 | Tap on the other segment. Highlight begins sliding (200 ms, ease-out). |
| 0–150 | Header tint cross-fades teal ↔ indigo. Current page fades to 0. |
| 100–300 | Bottom nav swaps items with a short fade. New mode's last route fades in (skeleton if data is stale). |
| 300 | Focus moves to the page `h1`. `aria-live` announces "Switched to Sell mode". |
| async | `PATCH /api/me/mode` is sent; failure is silent and retried once. |

With `prefers-reduced-motion`, skip the slide and fades (instant swap). Never block the UI on the network call.

### 1.3 Navigation per mode

| Slot | Buy | Sell |
|---|---|---|
| 1 | Home | Dashboard |
| 2 | Search | Listings |
| 3 | Cart (badge) | **+** (raised centre button → Quick List) |
| 4 | Orders (purchases) | Orders (received, badge = needs action) |
| 5 | Me | Me |

---

## 2. Join and verify (college email)

### 2.1 Join Resello

```
+------------------------------------+
| <-  Join Resello                   |
|                                    |
| Full name                          |
| [ Samarth Patil                  ] |
|                                    |
| College email                      |
| [ samarth.patil24@pccoepune.org  ] |
| Use your college email, e.g.       |
| name.surname24@pccoepune.org       |
|                                    |
| Password                    [show] |
| [ **********                     ] |
| Strength  [######----]  Good       |
|                                    |
| Confirm password                   |
| [ **********                     ] |
|                                    |
| [     Send verification code     ] |
|                                    |
| Already a member?  Log in          |
+------------------------------------+
```

Error states (inline, under the field, never a blocking alert):

```
College email                         College email
[ samarth.patil24@gmail.com     ]     [ samarth.patil24@pccoepune.org ]
! Only college emails work here.      ! Already registered.
  Use yourname@pccoepune.org            [ Log in instead ]
```

The name field is prefilled from the email pattern (`samarth.patil24` → "Samarth Patil") but stays editable.
Disable the submit button until all fields are valid.

### 2.2 Verify your college email

```
+------------------------------------+
| <-  Verify your college email      |
|                                    |
| We sent a 6-digit code to          |
| s*****.patil24@pccoepune.org       |
|                                    |
|  [ 4 ][ 2 ][ 7 ][   ][   ][   ]    |
|                                    |
| Code expires in 09:42              |
| Resend code in 0:24                |
|                                    |
| [            Verify              ] |
|                                    |
| Wrong email? Change it             |
+------------------------------------+
```

States: wrong code (boxes shake once, "That code is not right. 3 tries left"); expired ("Code expired — send a new one");
locked after 5 tries ("Too many attempts. Send a new code"); success (checkmark, then redirect to `/buy`).
Auto-advance between boxes, support paste of all six digits, `inputmode="numeric"`, `autocomplete="one-time-code"`.

---

## 3. Buy storefront

### 3.1 Buy Home

```
+------------------------------------+
| (switcher + search from 1.1)       |
+------------------------------------+
| Books  Electr.  Lab  Bags  Furn.  >|  category rail (scrolls)
+------------------------------------+
| Near you                    See all|
| +--------+ +--------+ +--------+   |
| | [img]  | | [img]  | | [img]  |   |
| | ₹350   | | ₹200   | | ₹500   |   |
| | 0.4 km | | 0.9 km | | 1.2 km |   |
| +--------+ +--------+ +--------+   |
+------------------------------------+
| Just listed                        |
| +----------------+ +-------------+ |
| |     [img]      | |    [img]    | |
| | Engg Maths III | | Casio fx-991| |
| | ₹250  Good     | | ₹600 LikeNew| |
| | Riya  4.8*  1km| | Arjun 4.6*  | |
| +----------------+ +-------------+ |
|  ... infinite scroll ...           |
+------------------------------------+
| Done with last sem's books?  Sell >|  nudge card -> switches to Sell
+------------------------------------+
| 2 items  ₹550          [View cart] |  floating cart bar (only if cart > 0)
+------------------------------------+
| Home   Search   Cart(2)  Orders  Me|
+------------------------------------+
```

Own listings never appear here. Skeleton cards while loading. Empty state (no listings nearby): "Nothing listed near you yet — be the first to sell" + button to Sell.

### 3.2 Listing detail

```
+------------------------------------+
| <-                     [save] [more]|
| +--------------------------------+ |
| |        main image (swipe)      | |
| |                    o o O o o   | |
| +--------------------------------+ |
| Engineering Maths III (Kreyszig)   |
| ₹250      Good      0.4 km away    |
| Seller  Riya S.  4.8*  (24)     >  |
| ---------------------------------- |
| Description ..................     |
| ............................ [more]|
| Reviews  4.8*  (24)          [all] |
+------------------------------------+
| [   Add to cart   ] [save] [chat]  |
+------------------------------------+
```

| Variant | Banner | Action bar |
|---|---|---|
| Own listing | "This is your listing" | **[Manage in Sell]** replaces Add to cart (switches mode, opens edit) |
| `PENDING` | "Reserved — someone is buying this" | Add to cart disabled; [Save] still works |
| `SOLD` | "Sold" | Disabled; show "Similar items" below |

### 3.3 Cart (no quantity, no shipping, no promo)

```
+------------------------------------+
| <-  Cart (3)                       |
| Riya S.  4.8*                      |
| +--------------------------------+ |
| |[img] Engg Maths III  ₹250  [x] | |
| |[img] Drafter set     ₹150  [x] | |
| |             Seller total ₹400  | |
| +--------------------------------+ |
| Arjun K.  4.6*                     |
| +--------------------------------+ |
| |[img] Casio fx-991    ₹600  [x] | |
| +--------------------------------+ |
| Total                     ₹1,000   |
| [     Continue to checkout       ] |
+------------------------------------+
```

Swipe left on a row to remove (with Undo toast). If a listing became unavailable, show it greyed with
"No longer available" and exclude it from the total.

### 3.4 Checkout (3 steps: Review → Payment → Confirm)

```
Step 1: Review                          Step 2: Payment
+---------------------------------+     +---------------------------------+
| <-  Checkout        Step 1 of 3 |     | <-  Checkout        Step 2 of 3 |
| 3 items from 2 sellers          |     | (o) Pay online                  |
| Handover: meet on campus,       |     |     UPI / Card / Net banking    |
| details agreed in chat          |     |     Secure payment by Razorpay  |
| Note to seller (optional)       |     | ( ) Cash on delivery            |
| [ Evening, near hostel gate   ] |     |     Pay cash to the seller when |
| Total                    ₹1,000 |     |     you meet on campus          |
| [           Next              ] |     | Total                    ₹1,000 |
+---------------------------------+     | [        Review order         ] |
                                        +---------------------------------+
Step 3: Confirm
+---------------------------------+     Payment declined (Online)
| <-  Checkout        Step 3 of 3 |     +---------------------------------+
| Items (3) ................ edit |     | ! Payment failed                |
| Payment: Cash on delivery       |     | [ Try again ] [ Switch to COD ] |
| [x] I agree to the terms and    |     +---------------------------------+
|     privacy policy              |
| [        Place order          ] |     Item taken meanwhile
+---------------------------------+     "Casio fx-991 is no longer available
                                         and was removed from your order."
```

Confirmation screen: animated check, order numbers (copyable), "Sellers will confirm shortly",
buttons **View orders** and **Keep browsing**.

### 3.5 Order detail (buyer)

```
+------------------------------------+
| <-  Order ORD-1042           [copy]|
| Engg Maths III            ₹250     |
| Seller  Riya S.        [Message]   |
|                                    |
| (x) Placed        28 Sep, 10:30    |
|  |                                 |
| (x) Confirmed     28 Sep, 14:15    |
|  |                                 |
| ( ) Completed     waiting          |
|                                    |
| Handover: meet at Hostel A gate    |
| [        I received it         ]   |
| [ Cancel order ]  only while Placed|
+------------------------------------+
```

Statuses map exactly to `PLACED → CONFIRMED → COMPLETED` (or `CANCELLED`). After Completed show **Rate seller**.

---

## 4. Sell storefront

### 4.1 First-time onboarding (once)

```
+------------------------------------+
| Start selling on Resello           |
| Your account stays the same.       |
|                                    |
| Campus location                    |
| [ PCCOE - Hostel A             v ] |
| Pickup preference                  |
| (o) Meet on campus  ( ) Hostel gate|
| ( ) Department                     |
| Phone (optional)                   |
| [ +91 __________               ]   |
| [x] I agree to the seller          |
|     guidelines                     |
| [          Start selling         ] |
+------------------------------------+
```

### 4.2 Seller dashboard

```
+------------------------------------+
| (switcher, Sell active, from 1.1)  |
+------------------------------------+
| +-----------+ +-----------+        |
| | Active    | | To confirm|        |
| | listings  | |           |        |
| |    6      | |    3      |        |
| +-----------+ +-----------+        |
| +-----------+ +-----------+        |
| | Sold      | | Rating    |        |
| |    14     | |   4.8*    |        |
| +-----------+ +-----------+        |
| Needs your action                  |
| +--------------------------------+ |
| | Casio fx-991 - Arjun K.  ₹600  | |
| | COD  *  placed 2h ago          | |
| | [Confirm] [Cancel] [Message]   | |
| +--------------------------------+ |
| Sales (completed)        ₹8,450    |
|  Online ₹5,200   |   COD ₹3,250    |
+------------------------------------+
| Dashboard Listings  (+)  Orders  Me|
+------------------------------------+
```

Tapping a tile filters the relevant list. "Needs your action" is sorted oldest first.
Empty state (no listings yet): illustration + "Post your first item in under a minute" + **[+ Sell an item]**.

### 4.3 Quick List

```
+------------------------------------+
| x   New listing                    |
| Photos (2/5)                       |
| [cover] [img] [ + ] [   ] [   ]    |
|  100%    60%                       |
| Title                              |
| [ Engineering Maths III        ]   |
| Category   [ Books            v ]  |
| Condition  (o) Like new ( ) Good   |
|            ( ) Fair     ( ) Poor   |
| Price      [ ₹ 250 ]  Similar ~₹280|
| Description                        |
| [                              ]   |
| Pickup: PCCOE - Hostel A  (change) |
| [          Post listing          ] |
+------------------------------------+

Upload failed
+------------------------------------+
| ! Image 2 failed to upload         |
| [ Retry ]  [ Remove ]              |
| Post is disabled until all images  |
| have uploaded.                     |
+------------------------------------+
```

Photos come first because they are the slowest step and can upload while the seller types. Show a character counter on
title (50) and description (500). After posting: success sheet with **View listing** and **List another**.

### 4.4 Incoming orders

```
+------------------------------------+
| Orders                             |
| [Needs action 3][Confirmed][Done]  |
| [Cancelled]                        |
| +--------------------------------+ |
| | ORD-1042  *  2h ago            | |
| | Casio fx-991        ₹600  COD  | |
| | Buyer: Arjun K.                | |
| | Note: "Evening, hostel gate"   | |
| | [ Confirm order ]  [ Cancel ]  | |
| +--------------------------------+ |
+------------------------------------+

Confirmed card: [ Message buyer ]  [ Mark cash received ]  (COD only, after handover)
Cancel opens a sheet asking for a reason (required).
```

---

## 5. Desktop (1024 px and up)

```
BUY
+----------------------------------------------------------------------------------------+
| RESELLO | [##### BUY #####| SELL (3)] | [ Search books, calculators... ] | @Hostel A v | [bell] Cart(2) Me |
+----------------------------------------------------------------------------------------+
| Filters (sticky)   | Category rail ....................................................|
|  Category          | Near you  (4 cards)                                               |
|  Price  --o--o--   | Just listed (4-column grid, infinite scroll)                      |
|  Condition         |                                                                   |
|  Distance          |                                                                   |
|  Seller rating     |                                                                   |
+----------------------------------------------------------------------------------------+

SELL
+----------------------------------------------------------------------------------------+
| RESELLO | [BUY (1) |##### SELL #####] | [ Search my listings... ] | @Hostel A v | [bell] [+ Sell an item] Me |
+----------------------------------------------------------------------------------------+
| Dashboard          | Tiles: Active | To confirm | Sold | Rating                        |
| Listings           | Needs your action (table: item, buyer, payment, age, actions)      |
| Orders (3)         | Sales summary                                                      |
| Reviews            |                                                                    |
+----------------------------------------------------------------------------------------+
```

Desktop swaps the bottom nav for a left rail (Sell) or the filter sidebar (Buy search). The cart appears in the
top bar in Buy only; **+ Sell an item** appears in the top bar in Sell only. At 768 px use 2–3 columns and keep the bottom nav.

---

## 6. Component inventory

| Component | Notes |
|---|---|
| `ModeSwitcher` | Props: `mode`, `badges {buy, sell}`, `onChange`. `role="tablist"`. Arrow-key navigation. Renders nothing on auth and admin routes. |
| `ModeShell` | Wraps each mode: applies theme tokens, header tint, bottom nav; keeps each mode's routes mounted so scroll and form state survive a switch. |
| `ListingCard` | Image, title, price, condition badge, seller first name, rating, distance. Variants: grid, strip, compact (cart). |
| `CartBar` | Floating bar above the bottom nav; hidden when the cart is empty. |
| `OtpInput` | Six boxes, paste support, `autocomplete="one-time-code"`. |
| `StatusTimeline` | Vertical steps for `PLACED → CONFIRMED → COMPLETED` and a `CANCELLED` variant. |
| `StatTile` / `NeedsActionCard` | Seller dashboard building blocks. |
| `ImageUploader` | Multi-image, per-file progress, retry and remove, reorder to set the cover. |
| `FilterSheet` | Drawer on mobile, sidebar on desktop. |
| `Toast`, `Skeleton`, `EmptyState`, `Badge`, `Rating`, `Button` (primary / secondary / text / loading / disabled) | Shared. |

Every data screen must implement four states: **loading** (skeleton), **empty**, **error** (with retry), and **populated**.

---

## 7. Accessibility checklist

- Switcher: tablist semantics, visible focus ring, arrow keys, Enter/Space, `aria-live` announcement after switching.
- All text/background pairs at least 4.5:1 (see the token table in the spec); the primary button is white on `#C2410C`.
- Touch targets at least 44 px. Visible focus on every control. Labels tied to inputs. Meaningful `alt` text on listing images.
- OTP boxes are announced as one group ("6-digit code") with per-box labels.
- Colour is never the only signal: statuses carry text and icons; the two modes differ in label and icon as well as colour.
- Respect `prefers-reduced-motion` and support browser zoom to 200% without horizontal scrolling.

---

## 8. Copy deck (key messages)

| Situation | Text |
|---|---|
| Wrong domain | "Only college emails work here. Use yourname@pccoepune.org." |
| Alias | "Please use your plain college address without a + tag." |
| Already registered | "This email is already registered. Log in instead." |
| OTP wrong | "That code is not right. {n} tries left." |
| OTP expired | "This code expired. We can send a new one." |
| Unverified login | "Please verify your college email to continue." |
| Own listing | "This is your listing." |
| Reserved | "Reserved — someone is buying this." |
| Unavailable at checkout | "{title} is no longer available and was removed from your order." |
| Payment failed | "Payment failed. Try again or pay cash on delivery." |
| Suspended | "Your account has been suspended. Contact the Resello admin." |
