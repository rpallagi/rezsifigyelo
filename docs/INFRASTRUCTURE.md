# Infrastruktura Terv

## Szerverek

```
┌─────────────────────────────┐     ┌─────────────────────────────┐
│      UNRAID (dev/test)      │     │     VERSANUS VPS (prod)     │
│      192.168.x.x            │     │     rezsikovetes.hu         │
│                             │     │                             │
│  ┌─────────────────┐        │     │  ┌─────────────────┐        │
│  │ rezsi-app-dev   │ :5003  │     │  │ nginx           │ :80/443│
│  │ (Flask, dev)    │        │     │  │ (SSL termination)│       │
│  └────────┬────────┘        │     │  └────────┬────────┘        │
│           │                 │     │           │                 │
│  ┌────────┴────────┐        │     │  ┌────────┴────────┐        │
│  │ rezsi-postgres  │ :55433 │     │  │ rezsi-app-prod  │ :5003  │
│  │ (dev database)  │        │     │  │ (Gunicorn, prod)│        │
│  └─────────────────┘        │     │  └────────┬────────┘        │
│                             │     │           │                 │
│  ┌─────────────────┐        │     │  ┌────────┴────────┐        │
│  │ truck-scale-app │ :5002  │     │  │ rezsi-postgres  │ :5432  │
│  │ (NE NYULJ HOZZA)│       │     │  │ (prod database) │        │
│  └─────────────────┘        │     │  └─────────────────┘        │
│                             │     │                             │
│  /mnt/user/backups/vps/ <───┼─rsync─── /backups/rezsifigyelo/  │
│  (offsite backup)           │     │    (napi pg_dump)           │
└─────────────────────────────┘     └─────────────────────────────┘
```

## Halozat / Portok

### Unraid (dev)
| Port | Szolgaltatas | Megjegyzes |
|------|-------------|------------|
| 5002 | Truck Scale App | NE VALTOZTASD |
| 5003 | Rezsi App (dev) | Uj |
| 55432 | Truck Scale Postgres | Meglevo |
| 55433 | Rezsi Postgres (dev) | Uj |

### VPS (prod)
| Port | Szolgaltatas | Megjegyzes |
|------|-------------|------------|
| 22 | SSH | Firewall: IP korlatozas |
| 80 | Nginx HTTP | -> HTTPS redirect |
| 443 | Nginx HTTPS | SSL (Let's Encrypt) |
| 5003 | Rezsi App | Csak belso (docker network) |
| 5432 | PostgreSQL | Csak belso (docker network) |

## Docker halozatok

### Dev (Unraid)
```
rezsi-net (bridge)
    ├── rezsi-app-dev (5003)
    └── rezsi-postgres-dev (55433:5432)
```

### Prod (VPS)
```
rezsi-net (bridge)
    ├── nginx (80, 443)
    ├── rezsi-app-prod (5003 - internal only)
    └── rezsi-postgres-prod (5432 - internal only)
```

## Adatbazisok

### Unraid
| Adatbazis | Motor | Hasznalo | Port |
|-----------|-------|----------|------|
| truck_scale | PostgreSQL 15 | truck_scale | 55432 |
| tradecards.db | SQLite | - | - |
| rezsi_dev | PostgreSQL 15 | rezsi_user | 55433 |

### VPS
| Adatbazis | Motor | Hasznalo | Port |
|-----------|-------|----------|------|
| rezsi_prod | PostgreSQL 15 | rezsi_user | 5432 |

## Backup strategia

### Napi mentesek (cron 02:00)
1. VPS: `pg_dump rezsi_prod | gzip` -> `/backups/rezsifigyelo/`
2. VPS -> Unraid: `rsync` -> `/mnt/user/backups/vps/rezsifigyelo/`
3. 30 napos retencio mindket helyen

### Restore folyamat
1. Valaszd ki a backup fajlt
2. `./backup/restore.sh <backup_file.sql.gz>`
3. Ez dropdb + createdb + import

## Auto-update folyamat

### Dev (Unraid)
```
Git push -> origin/dev
    -> Unraid cron (6 orankent)
    -> git fetch + compare
    -> git reset --hard origin/dev
    -> docker compose build + up -d
```

### Prod (VPS)
```
PR merge -> origin/main
    -> VPS cron (6 orankent)
    -> git fetch + compare
    -> git reset --hard origin/main
    -> docker compose -f docker-compose.prod.yml build + up -d
```

## SSL / Certbot

### Elso telepites
```bash
# 1. Inditsd el nginx-et certbot nelkul (80-as port kell a challenge-hez)
# 2. Futtasd a certbot-ot:
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
    --webroot --webroot-path=/var/www/certbot \
    -d rezsikovetes.hu -d www.rezsikovetes.hu

# 3. Inditsd ujra nginx-et SSL-lel
docker compose -f docker-compose.prod.yml restart nginx
```

### Megujitas
A certbot container automatikusan megujitja a tanusitvanyt 12 orankent.

## Monitorozas (tervezett)

### Egyszeru megoldas
- UptimeRobot (ingyenes) -> HTTPS check + ping
- Email ertesites ha a site nem elerheto

### Kesobb
- Healthcheck endpoint: `/api/health`
- Grafana + Prometheus (ha tobb szolgaltatas lesz)
