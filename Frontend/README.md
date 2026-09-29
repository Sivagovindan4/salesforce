# Scanzaa Admin · Powered by Renza

Scanzaa is a Next.js application with the existing admin workspace, a PostgreSQL operational database through Prisma, authenticated admin APIs, and public customer QR menu/order pages. Salesforce remains an adapter boundary until the company supplies credentials and field/object mappings.

## Local setup

1. Install Node.js 20+ and PostgreSQL 14+.
2. Run `npm install` in `Frontend/`.
3. Copy `.env.example` to `.env`; set `DATABASE_URL` to a PostgreSQL database and replace `SESSION_SECRET`.
4. Run `npm run db:migrate`, then `npm run db:seed`.
5. Run `npm run dev` and open http://localhost:3000.

The seed creates a development super-admin (`admin@scanzaa.local` / `Scanzaa-Dev-2026!`) and sample restaurant, menu item, and table QR. Override credentials using `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`; do not use the sample password outside local development.

## Commands

- `npm run dev` — start Next.js
- `npm run build` — generate Prisma client and build for production
- `npm run start` — serve the production build
- `npm run lint` / `npm run typecheck` — strict TypeScript check
- `npm run test` — unit tests
- `npm run test:e2e` — Playwright sign-in smoke test (install a browser once with `npx playwright install chromium`)
- `npm run db:migrate` — apply development migrations
- `npm run db:seed` — create local demonstration records
- `npm run db:studio` — open Prisma Studio

## Backend and integrations

API overview and integration ownership are documented in [`docs/api.md`](docs/api.md), [`docs/architecture.md`](docs/architecture.md), and [`docs/salesforce-integration.md`](docs/salesforce-integration.md). Admin sessions use a signed HTTP-only cookie, scrypt password hashes, and permission checks. Salesforce webhook routes use unique event IDs and entity external IDs for idempotent upserts. The development provider is the default; no real Salesforce connection is claimed.

Food images are size/type-validated and stored under local `public/uploads` for development. Use a cloud object storage implementation before deploying multiple app instances.
