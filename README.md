# Rezsi Figyelő

Next.js alapú rezsikövető és ingatlankezelő alkalmazás bérbeadóknak és bérlőknek.

## Jelenlegi stack
- Next.js 16 + App Router
- TypeScript
- tRPC
- Drizzle ORM + PostgreSQL (Neon)
- Clerk auth
- Stripe subscription billing
- Vercel deploy
- Vercel Blob fájltárolás
- Számlázz.hu számlázási integráció

## Fő funkciók
- Bérbeadói dashboard, ingatlan-, mérő-, fizetés- és dokumentumkezelés
- Bérlői felület külön jogosultságokkal
- Fotós mérőállás rögzítés és OCR
- Okosmérő / Home Assistant integráció
- Tenant invite alapú beköltöztetés
- Számlázás Számlázz.hu kapcsolattal
- Több bérbeadói profil egy login alatt

## Bérbeadói profilok
Egy Clerk login alatt több kiállító entitás kezelhető:
- magánszemély
- cég
- vagyonközösség

Minden ingatlanhoz egy bérbeadói profil rendelhető.

Ez határozza meg:
- melyik kiállító profilból történik a számlázás
- melyik Számlázz.hu Agent kulcsot használja az adott ingatlan
- milyen alapértelmezett ÁFA/adózási kód és számlázási beállítás tartozik hozzá

Az ingatlanon külön maradnak a vevői/számlacímzett adatok, tehát külön kezelt:
- ki állítja ki a számlát
- kinek megy a számla

## Fejlesztési workflow
- `main`: production
- feature módosítás után push a branchre vagy közvetlenül `main`-re
- a production domain a `main` deployját mutatja
- preview deploy a Vercelen külön URL-en jelenik meg

## Fontos oldalak
- `/dashboard`
- `/properties`
- `/tenants`
- `/billing`
- `/settings`
- `/settings/landlord-profiles`

## Környezeti változók
Legalább ezek szükségesek:
- `DATABASE_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_WEBHOOK_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `BLOB_READ_WRITE_TOKEN`

OCR / extra integrációkhoz opcionálisan:
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `GOOGLE_AI_KEY`
- `SMART_METER_WEBHOOK_TOKEN`

## Fejlesztés
```bash
pnpm install
pnpm dev
```

Schema frissítés:
```bash
pnpm db:push
```

Typecheck:
```bash
pnpm typecheck
```

## Megjegyzés
Ez a README a jelenlegi Next.js alapú appot írja le. A korábbi Flask/Docker/PIN-login/PWA leírás már nem a jelenlegi production architektúrát tükrözte.
