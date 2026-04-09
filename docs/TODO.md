# TODO

## Kész (ebben a sessionben)

- [x] Property hero kép / gradient a detail oldalon
- [x] Property avatar fotó feltöltés (client-side resize, local dev fallback)
- [x] Sidebar dark mode fix
- [x] Offline bérlő támogatás (email nélkül, tenantId nullable)
- [x] Move-in wizard: "Mentés, folytatom később" gomb, email nem kötelező
- [x] Move-out egyszerűsített oldal (nem wizard)
- [x] Beköltözési/kiköltözési checklist a property detail-en
- [x] Checklist teendők megjelenése a feladatok oldalon és property kártyákon
- [x] Meghívó visszavonás és újraküldés
- [x] Kiadói profil szín választó (8 fix szín)
- [x] Property lista: szín badge profilonként
- [x] Billing UI átdolgozás: lista + form szétválasztás
- [x] Draft számla törlés
- [x] Számla fizetettség kezelés (kézi jelölés)
- [x] Számlázz.hu IPN webhook
- [x] Hónap gyorsválasztó gombok a számla formon
- [x] Automatikus havi számlázás (cron, property-szintű beállítás)
- [x] Számla megjegyzés automatikus hónap névvel
- [x] revalidatePath minden mutáción

## Következő lépések

### Magas prioritás
- [ ] `CRON_SECRET` env var beállítása Vercel-en az auto-számlázáshoz
- [ ] `BLOB_READ_WRITE_TOKEN` env var beállítása Vercel-en (fotó upload production-ben)
- [ ] Settings oldal rendezés — integrációk jobb elkülönítése
- [ ] Home Assistant integráció ingatlanhoz kötése (jelenleg globális)

### Számlázás
- [ ] Számlázz.hu IPN URL beállítása a Számlázz.hu admin felületen
- [ ] Overdue számla automatikus jelölés (cron)
- [ ] Számla PDF preview a billing listán
- [ ] Számla email újraküldés

### Property kezelés
- [ ] Property edit oldal vizuális felújítás
- [ ] Marketing oldal: cover photo kijelölés, drag&drop, preset room címkék
- [ ] Marketing média külön tábla (`marketing_media`)
- [ ] Property komponensek: `PropertyHeroCard`, `PropertyStatCard`

### Bérlő kezelés
- [ ] Bérlő profil oldal (tenant nézet)
- [ ] Bérlő önkiszolgáló mérőállás rögzítés
- [ ] Bérlői fizetés nyilvántartás

### Technikai
- [ ] Agent key titkosítás (jelenleg plain text a DB-ben)
- [ ] Számlázz.hu agent key validáció (teszt API hívás)
- [ ] E2E tesztek a számlázási flow-ra
- [ ] PWA offline support
