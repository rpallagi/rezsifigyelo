# Rezsi Figyelő — Teljesítmény Javítások

> Cél: Az app jelenleg lassú, lapváltáskor sokat vár a felhasználó. Az alábbiakat kell megcsinálni.
> Stack: Next.js 16 + tRPC v11 + Drizzle ORM + PostgreSQL (Neon) + Clerk + Vercel

## 1. Szekvenciális await-ek párhuzamosítása (KRITIKUS, KÖNNYŰ)

Fájl: src/app/(protected)/dashboard/page.tsx

Probléma: A három API hívás egymás után fut, nem párhuzamosan:

const user = await <api.user.me>();
const properties = await api.property.list();
const landlordProfiles = await api.landlordProfile.list();

Javítás:

const [user, properties, landlordProfiles] = await Promise.all([
  <api.user.me>(),
  api.property.list(),
  api.landlordProfile.list(),
]);

Ellenőrizd az összes többi oldalt is ugyanerre a mintára — ahol több await api.* hívás van egymás után, csomagold Promise.all()-ba.

## 2. N+1 query a Readings oldalon (KRITIKUS, KÖZEPES)

Fájl: src/app/(protected)/readings/page.tsx

Probléma: Az oldal lekéri az összes ingatlant, majd EGYENKÉNT kérdezi le mindegyik mérőállásait. 10 ingatlan = 11 API hívás sorban.

Javítás:
1. Hozz létre egy új tRPC endpointot: reading.listAll() a src/server/api/routers/reading.ts fájlban
2. Ez az endpoint egyetlen SQL query-vel lekérdezi az összes mérőállást (JOIN a properties táblával)
3. A readings/page.tsx-ben használd ezt az egy endpointot a ciklus helyett

## 3. Loading state-ek hozzáadása (FONTOS, KÖNNYŰ)

Probléma: Egyetlen oldalon sincs loading.tsx — navigáláskor a felhasználó üres képernyőt lát amíg az adat betölt.

Javítás: Hozz létre loading.tsx fájlokat:
- src/app/(protected)/loading.tsx
- src/app/(protected)/dashboard/loading.tsx
- src/app/(protected)/properties/loading.tsx
- src/app/(protected)/readings/loading.tsx
- src/app/(protected)/payments/loading.tsx
- src/app/(protected)/tenants/loading.tsx

Tartalom: animate-pulse skeleton kártyák (h-8 w-48 rounded bg-muted fejléc + 6db h-32 rounded-lg border bg-muted kártya grid-ben).

## 4. Prefetch a protected layoutban (FONTOS, KÖNNYŰ)

Fájl: src/app/(protected)/layout.tsx

Probléma: A layout nem prefetchel semmit, ezért minden aloldal újra lekéri a közös adatokat.

Javítás: Add hozzá a layout elejére:
  void api.user.me.prefetch();
  void api.property.list.prefetch();
És csomagold a children-t HydrateClient-be (import from @/trpc/server).

## 5. staleTime növelése (KÖZEPES, TRIVIÁLIS)

Fájl: src/trpc/query-client.ts

Probléma: staleTime: 30 * 1000 (30 mp) túl rövid.

Javítás: staleTime: 5 * 60 * 1000 (5 perc)

## Végrehajtási sorrend

1. staleTime növelése — 1 sor változtatás
2. Promise.all() a dashboard-on és más oldalakon
3. loading.tsx fájlok létrehozása
4. Prefetch a layoutban
5. N+1 fix a readings oldalon

Minden fix után: pnpm build && pnpm check
