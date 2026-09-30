# Testing and setup

Copy `.env.example` to `.env`, set `DATABASE_URL` to a PostgreSQL database, then run `npm install`, `npm run db:migrate`, and `npm run db:seed`. Start with `npm run dev`. The seed creates a development super-admin and sample QR menu; override its email and password with the `SEED_ADMIN_*` variables.

`npm run typecheck`, `npm run lint`, `npm run build`, and `npm run test` are the verification commands. Database-backed route checks require a reachable PostgreSQL instance.
