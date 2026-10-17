# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Urban Vietnamese households (HCMC first) buying daily groceries on their phone, often one-handed, often in the morning. Secondary audience: the client watching the pitch demo, who must be able to fill a basket in about 3 minutes on a phone.

## Product Purpose
"Chợ Sáng" is an online wet-market for everyday food: vegetables, fruit, meat and fish, eggs and dairy, bread and dry goods, seasonings. Same-day delivery in fixed time slots, cash on delivery by default, guest checkout. Success for the MVP is a convincing pitch: search, add to basket from the card, reach freeship, check out on one page, then see the order move through admin.

## Positioning
Trust information comes first, not last: every product shows origin, shelf life, unit and price per kg, and spoiled items are replaced within 24h. The freeship basket shows the exact amount still missing. Search works without Vietnamese diacritics. A customer-built gift basket (/gift) is the high-margin moment for Tết and Mid-Autumn.

## Operating Context
Mobile-first (375px layout first), Vietnamese copy, VND formatted with `Intl.NumberFormat('vi-VN')`. Delivery slots 08–10, 10–12, 14–16, 17–19. Shipping 20.000₫, freeship from 300.000₫. Demo store: hotline, address and payments are fake and labelled DEMO.

## Capabilities and Constraints
React Router 8.4 framework mode, Tailwind 4, Postgres + Prisma 7. Three.js is allowed on one homepage hero only, lazy-loaded with a static poster fallback; Fabric only on /gift. JS budget 130KB. No component libraries, no animation libraries. Touch targets ≥44px. Lucide icons, no emoji. Product photos are 1:1 on a light background, one style per group; cut-out PNGs exist for 12 products.

## Brand Commitments
Name: "Chợ Sáng". Green keeps one meaning only: fresh / in stock. Owner chose a full visual redesign on 2026-10-16: colors, fonts and layout are open; the previous magenta-CTA rule is no longer binding.

## Evidence on Hand
Real catalog (prisma/catalog.ts): 6 categories, ~40 products with origin, shelf life, storage, unit, price, some compare-at prices. Product photos in uploads/products/ (320/640/1080, avif+webp) and cut-outs. No real customers, reviews, ratings, delivery stats or press: never invent them.

## Product Principles
1. A basket in 3 minutes, one hand: nothing decorative may slow the buy path.
2. Trust facts (origin, freshness, unit, price/kg, 24h replacement) are shown, not claimed.
3. Every effect must tell a business story; 3D/canvas never blocks buying and always has a static fallback.
4. Money and stock are never wrong.

## Accessibility & Inclusion
WCAG AA contrast, visible focus, reduced motion respected, line-height ≥1.15 on headings so stacked Vietnamese diacritics are never clipped.
