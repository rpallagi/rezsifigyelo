# CLAUDE.md

## Project overview

Rezsi Figyelő (rezsikovetes.hu) — közüzemi mérőállás nyilvántartó, bérlői fizetéskövető és automatikus számlázó SaaS webapp magyar bérbeadók számára.

Fő funkciók:
- **Ingatlankezelés**: ingatlanok, bérlők, mérőórák, fogyasztási trendek
- **Számlázás**: Számlázz.hu integráció, automatikus havi számlázás (cron), kézi és automatikus fizetettség kezelés (IPN)
- **Kiadói profilok**: több számlázási entitás (cég/magán/vagyonközösség) szín-kódolással, profilonként saját Számlázz.hu API kulcs
- **Bérlő kezelés**: offline bérlők (email nélkül), beköltözési/kiköltözési checklist, meghívó rendszer
- **ROI & Analytics**: hozam, kihasználtság, pénzügyi áttekintés

## Tech stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Auth**: Clerk (`@clerk/nextjs`)
- **Language**: TypeScript (strict)
- **API**: tRPC v11 (server functions in `src/server/api/routers/`)
- **Database**: PostgreSQL with Drizzle ORM (`src/server/db/schema.ts`)
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Billing**: Számlázz.hu API (XML) — `src/server/billing/szamlazz.ts`
- **Payments**: Stripe (subscription billing)
- **File storage**: Vercel Blob (production), local `public/uploads` (dev)
- **Cron**: Vercel Cron — `vercel.json` + `/api/cron/generate-invoices`
- **Package manager**: pnpm

## Commands

- `pnpm dev` — start dev server
- `pnpm build` — production build
- `pnpm check` — lint + typecheck
- `pnpm lint` / `pnpm lint:fix` — ESLint
- `pnpm typecheck` — TypeScript check
- `pnpm format:check` / `pnpm format:write` — Prettier
- `pnpm db:generate` — generate Drizzle migrations
- `pnpm db:migrate` — run migrations
- `pnpm db:push` — push schema to DB
- `pnpm db:studio` — open Drizzle Studio

## Conventions

### File naming

- Use **kebab-case** for all file and folder names

### Code style

- Write all code in **TypeScript** — no `any` types, use strict typing
- Write backend logic as **tRPC procedures** in `src/server/api/routers/`
- Use **functions** (not classes) — prefer arrow functions
- Use Zod for input validation on tRPC procedures

### Database

- All tables use the `rezsi_` prefix via `createTable` helper
- Run `pnpm db:generate` then `pnpm db:migrate` after schema changes

### Auth

- Clerk handles authentication via `@clerk/nextjs`
- Roles: landlord, tenant, admin
- Role-specific procedures: `landlordProcedure`, `tenantProcedure`, `adminProcedure`

### Project structure

```
src/
├── proxy.ts              # Next.js 16 middleware (Clerk auth)
├── app/
│   ├── (protected)/      # Authenticated pages (dashboard, properties, billing, etc.)
│   ├── api/
│   │   ├── trpc/         # tRPC HTTP handler
│   │   ├── upload/       # File upload (Vercel Blob / local fallback)
│   │   ├── cron/         # Vercel Cron jobs (auto-invoicing)
│   │   └── webhooks/     # Clerk, Stripe, Számlázz.hu IPN, smart-meter
│   └── (public)/         # Sign-in, sign-up, landing
├── components/
│   ├── layout/           # Navigation, user button
│   ├── shared/           # Consumption chart, etc.
│   └── providers/        # Locale, theme
├── server/
│   ├── api/
│   │   ├── root.ts       # tRPC app router
│   │   ├── trpc.ts       # tRPC context & procedures
│   │   └── routers/      # Domain routers (property, invoice, tenancy, etc.)
│   ├── billing/
│   │   └── szamlazz.ts   # Számlázz.hu XML API client
│   ├── db/
│   │   ├── index.ts      # DB client
│   │   └── schema.ts     # Drizzle schema (all tables with rezsi_ prefix)
│   └── tenancy/          # Invitation handling, checklist creation
└── trpc/                 # Client-side tRPC setup
```

### Key domain concepts

- **Landlord Profile** — számlázási entitás (cég/magán/közösség), saját Számlázz.hu kulccsal és színnel
- **Property** — ingatlan, egy profilhoz rendelve, auto-billing beállítással
- **Tenancy** — bérlő-ingatlan kapcsolat, offline (tenantId null) vagy linked user
- **Handover Checklist** — beköltözési/kiköltözési teendők (meter_readings, contract_upload, etc.)
- **Invoice** — számla, draft → sent → paid lifecycle, Számlázz.hu szinkronnal
