# Seed Data Plan

The seed script (`server/src/scripts/seed.ts`, built in G1) populates the development database.
**It MUST refuse to run when `NODE_ENV=production`.**

## Categories (7)

| Name | Slug | Icon |
|------|------|------|
| Books | books | book-open |
| Electronics | electronics | laptop |
| Lab & Drafting | lab-drafting | ruler |
| Bags | bags | briefcase |
| Furniture | furniture | armchair |
| Stationery | stationery | pen-tool |
| Other | other | package |

## Users (3)

| Role | Email | Password (dev only) | Notes |
|------|-------|-------------------|-------|
| Student (buyer) | test.buyer24@pccoepune.org | TestBuyer@123 | Verified, seller NOT onboarded |
| Student (seller) | test.seller24@pccoepune.org | TestSeller@123 | Verified, seller onboarded, has listings |
| Admin | (from ADMIN_SEED_EMAIL env var) | AdminResello@123 | role=ADMIN, verified |

## Demo Listings (15)

All owned by test.seller24@pccoepune.org, across categories:

1. Engineering Mathematics III (Kreyszig) — Books, Like New, ₹250
2. Data Structures Using C — Books, Good, ₹180
3. Engineering Drawing Textbook — Books, Fair, ₹120
4. Mechanics of Solids — Books, Good, ₹200
5. Casio fx-991EX Calculator — Electronics, Like New, ₹600
6. Arduino Uno Starter Kit — Electronics, Good, ₹450
7. USB-C Hub 7-in-1 — Electronics, New, ₹350
8. T-Square 24" — Lab & Drafting, Good, ₹150
9. Drafter Set (Rotring) — Lab & Drafting, Like New, ₹300
10. Mini Drafter — Lab & Drafting, Fair, ₹200
11. College Backpack (Wildcraft) — Bags, Good, ₹500
12. Laptop Bag (HP) — Bags, Like New, ₹400
13. Study Table (Foldable) — Furniture, Good, ₹800
14. Desk Lamp (LED) — Stationery, New, ₹250
15. Geometry Box + Pens Bundle — Stationery, Good, ₹100

All listings are status=ACTIVE with a default campus location (PCCOE main campus: lat 18.6529, lng 73.7619).
