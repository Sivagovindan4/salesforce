# Architecture

The Next.js App Router application serves the existing Scanzaa admin UI, API handlers, and public QR menu endpoints. PostgreSQL is the operational store accessed through Prisma. Salesforce remains an external source for source-owned restaurant and menu fields; local operational state such as orders, tables, QR scans, reviews, and permissions remains Scanzaa-owned. Salesforce identifiers are stored in unique `externalId` columns and upserts are idempotent.

The Salesforce adapter is selected with `SALESFORCE_PROVIDER`. The default development adapter accepts and normalizes data locally. `SalesforceProvider` is a deliberately unconfigured boundary pending real credentials and Salesforce object mappings.
