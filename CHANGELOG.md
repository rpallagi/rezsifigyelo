# Changelog

Minden fontos valtozas ebben a fajlban van dokumentalva.

## [1.0.0] - 2025-02-22

### Hozzaadva
- Flask app a teljes backend-del (PostgreSQL 15)
- Berloi felulet: PIN login, meroallas rogzites, foto feltoltes, elozmeny, Chart.js grafikonok
- Admin felulet: dashboard, ingatlanok CRUD, fizetesek, karbantartas naplo, todo lista, tarifa kezeles, ROI kalkulator
- Docker Compose dev (Unraid) es prod (VPS + nginx + certbot SSL)
- Backup/restore scriptek (pg_dump)
- Auto-update script (git pull + rebuild, cron)
- Seed data script (10 teszt ingatlan, 6 honap adat)
- Mobil-first CSS, PWA manifest
- Health check endpoint (/api/health)
- Security headerek (X-Frame, HSTS, XSS, nosniff)
- Dokumentacio (SETUP, ARCHITECTURE, TODO, INFRASTRUCTURE)
