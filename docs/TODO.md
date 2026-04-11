# TODO

## Kész (2. session)

- [x] Karbantartás rendszer: form, hub, detail, fotó/doc upload, prioritás, státusz
- [x] Leolvasás 3-step wizard (típus → érték+OCR → összegzés)
- [x] Leolvasás dashboard (trend kártyák, property szűrő)
- [x] Mérőóra wizard (hagyományos + okos mérő preset-ek)
- [x] Befizetések beolvasztva a számlázásba (tabs)
- [x] Befizetés kategóriák (bérleti díj, közös költség, kaució, stb.)
- [x] Közös költség fizetési naptár (havi pill grid)
- [x] Chat oldal + üzenetek nézet
- [x] Email utility (Resend)
- [x] Fizetési emlékeztető cron (lejárt számlák + chat + email)
- [x] Bérlő szerkesztés (inline edit a bérlők oldalon)
- [x] Korábbi bérlők szekció (tenant history)
- [x] Bérleti szerződés időtartam (3/6/12 hónap, határozatlan, egyéni)
- [x] Szerződés lejárat értesítés (2 hét előtt, cron)
- [x] Move-in wizard: tényleges adatgyűjtés (mérőállás, állapot, kulcs, szerződés)
- [x] Állapotfelvétel dedikált oldal (/condition)
- [x] PhotoGallery component (lightbox, caption, multi-upload, kamera)
- [x] Egyéni ingatlan típusok (varchar, meglévőkből gombokként)
- [x] Property lista nézet választó (grid/compact/list/table)
- [x] Property lista profil szűrő + oszlop rendezés + csoportosítás
- [x] EUR bérleti díj támogatás
- [x] EUR/HUF árfolyam beállítás (settings)
- [x] ROI Ft/€ nézet toggle
- [x] Smart meter delete mutation + property detail státusz
- [x] Épület + telek alapterület (m²) + Ft/m² számítás
- [x] Vercel Blob store beállítás + fotó migráció
- [x] Dev DB adatok migrálva prod-ba
- [x] Production DB schema szinkron

## Következő lépések

### Magas prioritás
- [ ] MNB API automatikus EUR/HUF árfolyam (napi cron + exchangeRates tábla)
- [ ] Befizetéseknél napi árfolyam mentés (historikus ROI számítás)
- [ ] Adó PDF AI extraction (határozat feltöltés → AI kiolvasás)
- [ ] Bérlői profil oldal (/my-home/profile)
- [ ] Property fotó galéria (propertyPhotos tábla, avatar választó meglévőből)
- [ ] Drag & drop fotó feltöltés (PhotoGallery bővítés)

### UI/UX
- [ ] Property tabbed UI (ne kelljen külön oldalakra navigálni)
- [ ] Settings oldal rendezés
- [ ] Marketing oldal: cover photo, drag&drop, preset címkék
- [ ] Property edit vizuális felújítás

### Számlázás
- [ ] Számlázz.hu IPN URL beállítás
- [ ] Számla PDF preview
- [ ] Számla email újraküldés

### Bérlő
- [ ] Bérlő önkiszolgáló mérőállás
- [ ] Bérlői fizetés nyilvántartás

### Technikai
- [ ] Clerk production kulcsok (pk_live_)
- [ ] Agent key titkosítás
- [ ] E2E tesztek
