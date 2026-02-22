# Rezsi Figyelo - TODO / Roadmap

Utolso frissites: 2025-02-22

---

## Allapot jeloles

- [ ] Tervezett
- [x] Kesz
- [~] Folyamatban

---

## Fazis 1 - Alapok (MOST)

### Infrastruktura
- [x] GitHub repo letrehozas (rpallagi/rezsifigyelo)
- [x] main + dev branch struktura
- [x] Docker Compose (dev - Unraid)
- [x] Docker Compose (prod - VPS + nginx + SSL)
- [x] Dockerfile
- [x] Backup scriptek (pg_dump + restore)
- [x] Auto-update script (git pull + rebuild)
- [x] Seed data script (teszt adatok)
- [ ] Unraid-on `docker compose up` teszteles
- [ ] Versanus VPS megrendeles + beallitas
- [ ] DNS beallitas (rezsikovetes.hu -> VPS IP)
- [ ] SSL certbot setup a VPS-en
- [ ] Cron jobs beallitasa (backup + auto-update)
- [ ] Offsite backup rsync VPS -> Unraid

### Backend
- [x] Flask app factory (app.py)
- [x] Konfig rendszer (config.py, .env)
- [x] Adatbazis modellek (8 tabla)
- [x] Berloi route-ok (login, meroallas, foto, history, API)
- [x] Admin route-ok (dashboard, CRUD, fizetesek, karbantartas, todo, tarifak, ROI)
- [x] Foto feltoltes + auto resize (Pillow)
- [x] Csatorna automatikus szamitas viz alapjan
- [x] Torteneti tarifak kezelese (valid_from)
- [x] Gunicorn konfig (prod)

### Frontend
- [x] Base template (flash messages, PWA)
- [x] Berloi login (ingatlan kivalasztas + PIN)
- [x] Berloi dashboard (osszesites kartyak, sparkline)
- [x] Meroallas rogzites form (elo szamitas, foto)
- [x] Elozmeny (Chart.js grafikonok, lista)
- [x] Admin login
- [x] Admin dashboard (stat kartyak, utolso meresek)
- [x] Ingatlanok CRUD (modal formok)
- [x] Meroallasok attekintes (szurheto)
- [x] Fizetesek kezeles
- [x] Karbantartas naplo
- [x] Todo lista
- [x] Tarifa kezeles
- [x] ROI kalkulator (break-even grafikon)
- [x] Beallitasok (jelszo valtas)
- [x] Mobil-first CSS
- [x] PWA manifest

### Dokumentacio
- [x] SETUP.md (telepitesi utmutato)
- [x] ARCHITECTURE.md (architektura leiras)
- [x] TODO.md (ez a fajl)
- [ ] API.md (vegpont referencia)
- [ ] Google Drive MD mentese

---

## Fazis 2 - Finomhangolas

### UX javitasok
- [ ] Berloi dashboard: utolso 3 honap osszesito
- [ ] Admin: ingatlanonkenti egyenleg (fizetesek vs rezsikolteseg)
- [ ] Admin: CSV export (meroallasok, fizetesek)
- [ ] Admin: inline szerkesztes tablazatokban
- [ ] Berlo: PWA offline tamogatas (Service Worker cache)
- [ ] Berlo: push notification amikor uj tarifa van
- [ ] Admin: mobil-responsive sidebar (hamburger menu)
- [ ] Tema valasztas (sotet mod)
- [ ] Nyelv: ekezetes magyar szovegek (jelenleg ASCII)

### Biztonsag
- [ ] CSRF token (Flask-WTF integralva van, de template-ekbe kell)
- [ ] Rate limiting (brute force vedelem PIN-re)
- [ ] Session timeout (berloi oldal, pl. 30 perc)
- [ ] Admin jelszo erosseg ellenorzes
- [ ] Foto feltoltes: MIME type validacio (ne csak extension)
- [ ] HTTP security headerek (CSP, HSTS, X-Frame)

### Teljesitmeny
- [ ] Adatbazis indexek (property_id + reading_date kombinalt index)
- [ ] Foto thumbnail generalas (lista nezethez)
- [ ] Static file cache headerek
- [ ] Gzip kompresszio (nginx szinten)
- [ ] Chart.js lazy loading

---

## Fazis 3 - Uj funkciok

### Ertesitesek
- [ ] Email ertesites berlonek (meroallas emlekeztetoq)
- [ ] Admin ertesites: ha 30 napja nincs meroallas valahol
- [ ] SMS ertesites (opcionalis, Twilio / Vonage)

### Smart Meter / IoT
- [ ] MQTT fogadas (Mosquitto broker)
- [ ] Auto meroallas MQTT uzenetbol
- [ ] Home Assistant integracio
- [ ] Shelly / Tasmota kompatibilitas
- [ ] Valos ideju fogyasztas dashboard (WebSocket)

### Szamlazas
- [ ] Szamlazz.hu integracio (atutalasi felszolitas)
- [ ] Havi automatikus szamla generalas
- [ ] QR kodos befizetes (Magyar QR szabvany)
- [ ] NAV Online Szamla integracio

### Riportok
- [ ] Havi osszesito PDF (berlo + admin)
- [ ] Eves statisztika (evszakos bontas, trend)
- [ ] Ingatlanok osszehasonlitasa (melyik fogyaszt tobbet)
- [ ] Excel/PDF export

### Multi-tenant (SaaS elo)
- [ ] Tobb tulajdonos tamogatas (user management)
- [ ] Tulajdonos regisztracio
- [ ] Sajat subdomain (user1.rezsikovetes.hu)
- [ ] Fizetesi terv (ingyenes 3 ingatlan / pro unlimited)
- [ ] Stripe / SimplePay fizetes

---

## Fazis 4 - Andezitbanya.hu

### Weboldal
- [ ] WordPress tartalom kimentese
- [ ] Statikus HTML + CSS ujrairas
- [ ] Responsive dizajn
- [ ] SEO optimalizalas
- [ ] Deploy VPS-re (Nginx vhost)

### Tradecard integracio (kesobb)
- [ ] Tradecard funkcionalitas atvitele
- [ ] Merleg adatok megjelenitese
- [ ] Ugyfelprofil es szamlak

---

## Infrastruktura TODO

### Versanus VPS
- [ ] PRO VPS MINI megrendeles vagy cPanel upgrade
- [ ] Docker telepites
- [ ] Git + SSH kulcsok beallitas
- [ ] Firewall (ufw): 80, 443, 22
- [ ] Fail2ban telepites
- [ ] Monitoring (uptime check)
- [ ] rezsikovetes.hu DNS -> VPS IP

### Unraid (dev szerver)
- [~] rezsifigyelo dev container
- [ ] Cron: 6 orankent git pull + rebuild (dev branchbol)
- [ ] Offsite backup fogadas VPS-rol

### Domain
- [x] rezsikovetes.hu regisztracio (Versanus)
- [ ] DNS beallitas (A record -> VPS IP)
- [ ] Cloudflare vagy Versanus DNS
- [ ] www redirect beallitas

---

## Megjegyzesek

### Tradecard app
- **NE NYULJ HOZZA** - marad SQLite-on az Unraid-on
- Kesobb (Fazis 4+) atgondolni a Postgres migraciot
- Fokozatos migracio: dual-mode -> adat masolas -> teszteles -> atallas

### Prioritas sorrend
1. Fazis 1 befejezese (Unraid teszt + VPS deploy)
2. Biztonsagi javitasok (Fazis 2 biztonsag blokk)
3. CSV export + riportok
4. Ertesitesek
5. Smart meter / IoT
6. SaaS elofeltetel
