# Chợ Sáng

Mobile-first grocery web app (MVP demo) for Vietnamese households: browse fresh food, add to basket, check out on one page with same-day delivery slots and cash on delivery. Includes a customer-built gift basket at `/gift`.

This is a **pitch demo**: hotline, address, payments and the login OTP are fake and labelled DEMO.

## Stack

React Router 8.4 (framework mode) · React 19 · Tailwind CSS 4 · PostgreSQL 18 + Prisma 7 · Vitest · Playwright

## Requirements

- Node `>=22.22.0 <23`
- Docker (for Postgres)

## Getting started

```bash
cp .env.example .env
npm install
npm run setup   # starts Postgres, generates Prisma client, runs migrations, seeds catalog + images
npm run dev
```

The seed is safe to re-run; it fully restores catalog data and processed images in `uploads/`.

## Environment

See [.env.example](.env.example). Key variables:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection (compose exposes port 5432) |
| `UPLOAD_DIR` | Where processed images are written |
| `SESSION_SECRET` | Signs cart/session cookies. Use `openssl rand -hex 32` in production |
| `DEMO_OTP` | `1` shows the login OTP on screen instead of sending SMS. Unset = login disabled |
| `ADMIN_PASSCODE` | Passcode for the seeded admin phone `0909000000`. Unset = admin cannot log in |
| `INSECURE_COOKIES` | `1` only when demoing a production build over plain `http://` on a LAN |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build and serve |
| `npm run typecheck` | Route typegen + `tsc` |
| `npm test` | Unit/integration tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright, 375px viewport, port 3100) |

Both test suites use a separate `chosang_test` database in the same Postgres container; the dev database is never touched.

## Project layout

```
app/
  routes/       pages and resource routes (see app/routes.ts)
  components/   UI components
  lib/          domain logic (cart, orders, catalog, auth, images…); *.server.ts runs server-only
prisma/         schema, migrations, catalog data, seed, test-db setup
seed/images/    source product photos and cut-outs (credits in CREDITS.md)
e2e/            Playwright specs
docs/           design spec, roadmap, mocks
```

## Docs

- Product brief: [PRODUCT.md](PRODUCT.md)
- Design spec and roadmap: [docs/superpowers/](docs/superpowers/)
- Homepage mock: [docs/mocks/home-redesign.html](docs/mocks/home-redesign.html)
