# CLAUDE.md

## Project overview

Rezsi Figyelő — közüzemi mérőállás nyilvántartó és bérlői fizetéskövető SaaS webapp.

## Tech stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Auth**: Clerk (`@clerk/nextjs`)
- **Language**: TypeScript (strict)
- **API**: tRPC v11 (server functions in `src/server/api/routers/`)
- **Database**: PostgreSQL with Drizzle ORM (`src/server/db/schema.ts`)
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Payments**: Stripe (separate account from angolozzunk.hu)
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
├── proxy.ts          # Next.js 16 middleware (Clerk auth)
├── app/              # Next.js App Router pages & layouts
│   └── api/trpc/     # tRPC HTTP handler
├── server/
│   ├── api/
│   │   ├── root.ts   # App router
│   │   ├── trpc.ts   # tRPC context & procedures
│   │   └── routers/  # Domain routers
│   └── db/
│       ├── index.ts   # DB client
│       └── schema.ts  # Drizzle schema
└── trpc/             # Client-side tRPC setup
```
