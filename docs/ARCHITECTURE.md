# Rezsi Figyelo - Architektura

## Attekintes

Flask (Python) webapp - kozuzemi meroallas nyilvantarto berlo es admin felhasznalok szamara.

## Tech Stack

| Reteg | Technologia |
|-------|------------|
| Backend | Flask 3.1, SQLAlchemy 2.0, Gunicorn |
| Adatbazis | PostgreSQL 15 |
| Frontend | Vanilla HTML/CSS/JS, Chart.js 4 |
| Deploy | Docker Compose, Nginx, Certbot |
| CI/CD | Git push -> auto_update.sh (cron) |

## Projekt struktura

```
rezsifigyelo/
├── app.py              # Flask app factory, seed data
├── config.py           # Konfig env valtozokbol
├── models.py           # 8 SQLAlchemy model
├── gunicorn.conf.py    # WSGI szerver prod-hoz
│
├── routes/
│   ├── tenant.py       # Berloi vegpontok (PIN login, meroallas, foto, history)
│   └── admin.py        # Admin vegpontok (CRUD, fizetesek, ROI, stb.)
│
├── templates/          # Jinja2 HTML sablonok
│   ├── base.html       # Kozos layout (flash, PWA, CSS)
│   ├── tenant/         # 4 berloi oldal
│   └── admin/          # 9 admin oldal
│
├── static/             # CSS, JS, PWA manifest
├── uploads/            # Meroora fotok (gitignore)
│
├── docker-compose.yml      # Dev (Unraid)
├── docker-compose.prod.yml # Prod (VPS + nginx + SSL)
├── Dockerfile
│
├── backup/             # pg_dump + restore scriptek
├── scripts/            # auto_update.sh, seed_data.py
├── nginx/              # Nginx vhost config
└── docs/               # Dokumentacio
```

## Adatbazis modellek

```
AdminUser (admin felhasznalok)
    │
TariffGroup (Lakas, Uzleti)
    ├── Tariff (villany 212 Ft/kWh, viz 758 Ft/m3, ...)
    │       valid_from -> torteneti tarifak
    │
Property (ingatlan)
    ├── pin_hash (bcrypt)
    ├── tariff_group_id -> melyik tarifa csoport
    ├── purchase_price, monthly_rent -> ROI szamitas
    │
    ├── MeterReading (meroallasok)
    │       value, prev_value, consumption (auto)
    │       tariff_id -> aktualis tarifa
    │       cost_huf (auto: consumption * tarifa)
    │       photo_filename
    │
    ├── Payment (befizetesek)
    │       amount_huf, payment_method, period
    │
    ├── MaintenanceLog (karbantartas)
    │       description, category, cost_huf
    │
    └── Todo (admin tennivalok)
            title, priority, status, due_date
```

## Autentikacio

### Berlo
- Ingatlan kivalasztas + 4-6 jegyu PIN
- Flask session (server-side)
- Nincs regisztracio - admin hozza letre az ingatlant + PIN-t

### Admin
- Felhasznalonev + jelszo (bcrypt)
- Flask-Login session
- Egy admin user (seed-bol)

## Tarifa rendszer

- **TariffGroup**: pl. "Lakas", "Uzleti" - kulonbozo dijszabasok
- **Tariff**: tarifa_group + utility_type + rate + valid_from
- Uj tarifa = uj sor valid_from datummal (a regi megmarad)
- Meroallas rogziteskor automatikusan a legfrisebb ervenyes tarifat hasznalja
- Csatorna automatikusan a viz fogyasztas alapjan szamolodik

## Deployment flow

```
Developer (Mac/Unraid)
    │
    ├── git push -> origin/dev (fejlesztes)
    │
    └── PR merge -> origin/main (prod)
                        │
                   VPS auto_update.sh (6 orankent cron)
                        │
                   git pull + docker build + up -d
```

## Backup strategia

```
VPS (prod)                          Unraid (offsite)
    │                                   │
    ├── pg_dump napi 2:00 AM            │
    │   -> /backups/rezsifigyelo/       │
    │                                   │
    └── rsync ────────────────────> /mnt/user/backups/vps/
                                        rezsifigyelo/
    30 napos retencio mindket helyen
```
