# Rezsi Figyelo - Telepitesi es Hasznalati Utmutato

## Tartalom

- [Gyors inditas (dev)](#gyors-inditas-dev)
- [Unraid telepites](#unraid-telepites)
- [VPS deploy (prod)](#vps-deploy-prod)
- [Konfig referencia](#konfig-referencia)
- [Hasznalat](#hasznalat)
- [Backup es restore](#backup-es-restore)
- [Hibakereses](#hibakereses)

---

## Gyors inditas (dev)

### Elofeltetelek
- Docker + Docker Compose
- Git

### Lepesek

```bash
# 1. Repo klonozasa
git clone https://github.com/rpallagi/rezsifigyelo.git
cd rezsifigyelo
git checkout dev

# 2. .env fajl (opcionalis - alapertekek mukodnek)
cp .env.example .env
# Szerkeszd ha szukseges

# 3. Inditas
docker compose up -d

# 4. Teszt adatok betoltese (opcionalis)
docker exec rezsi-app-dev python scripts/seed_data.py
```

Az app elerheto: **http://localhost:5003**

### Alapertelmezett belepes
- **Admin:** admin / admin123
- **Teszt berlok PIN:** 1001, 1002, ... 1010 (seed data utan)

---

## Unraid telepites

### 1. Repo klonozasa Unraid-ra

```bash
# SSH-val csatlakozz az Unraid-ra
ssh root@192.168.x.x

# Hozd letre a konyvtarat
mkdir -p /mnt/user/appdata/rezsifigyelo
cd /mnt/user/appdata/rezsifigyelo

# Klonozd a repot
git clone https://github.com/rpallagi/rezsifigyelo.git .
git checkout dev
```

### 2. .env fajl letrehozasa

```bash
cp .env.example .env
nano .env
```

Allitsd be:
```
SECRET_KEY=generalt-titkos-kulcs-ide
ADMIN_PASSWORD=sajat-admin-jelszo
REZSI_DB_PASSWORD=sajat-db-jelszo
```

### 3. Inditas

```bash
docker compose up -d
```

### 4. Ellenorzes

```bash
docker compose logs -f
# Vard meg amig: "Starting Rezsi Figyelo on port 5003..."
```

Elerheto: **http://unraid-ip:5003**

---

## VPS deploy (prod)

### 1. VPS elofeltetel
- Ubuntu 22.04+ vagy Debian 12+
- Docker + Docker Compose telepitve
- Domain (rezsikovetes.hu) a VPS IP-jere mutat

### 2. Telepites

```bash
# Repo klonozasa
cd /opt
git clone https://github.com/rpallagi/rezsifigyelo.git
cd rezsifigyelo
git checkout main

# .env letrehozasa EROS jelszavakkal
cp .env.example .env
nano .env
```

### 3. SSL tanusitvany (elso alkalommal)

```bash
# Eloszor nginx nelkul inditsd el (hogy a certbot mukodjon)
# Ideiglenesen kommentezd ki az ssl sorokat az nginx configban

# Certbot:
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot --webroot-path=/var/www/certbot \
  -d rezsikovetes.hu -d www.rezsikovetes.hu
```

### 4. Prod inditas

```bash
docker compose -f docker-compose.prod.yml up -d
```

### 5. Auto-update cron

```bash
# 6 orankent ellenorzi a git repot
crontab -e
# Add hozzaad:
0 */6 * * * /opt/rezsifigyelo/scripts/auto_update.sh
```

### 6. Backup cron

```bash
# Napi backup hajnali 2-kor
0 2 * * * /opt/rezsifigyelo/backup/backup.sh
```

---

## Konfig referencia

### Kornyezeti valtozok (.env)

| Valtozo | Alapertek | Leiras |
|---------|-----------|--------|
| `FLASK_PORT` | 5003 | Szerver port |
| `FLASK_ENV` | development | development / production |
| `SECRET_KEY` | dev-secret-key... | Flask session titkositas |
| `REZSI_DB_PASSWORD` | devpassword | PostgreSQL jelszo |
| `ADMIN_USERNAME` | admin | Admin felhasznalonev |
| `ADMIN_PASSWORD` | admin123 | Admin jelszo |
| `MAX_UPLOAD_SIZE_MB` | 5 | Max foto meret (MB) |

### Portok

| Szolgaltatas | Port | Leiras |
|--------------|------|--------|
| Rezsi App | 5003 | Flask web szerver |
| PostgreSQL | 55433 | Adatbazis (dev) |
| Nginx HTTP | 80 | Prod HTTP->HTTPS redirect |
| Nginx HTTPS | 443 | Prod SSL |

---

## Hasznalat

### Berloi felulet (/)
1. Valassz ingatlant a legordulobol
2. Add meg a 4 jegyu PIN kodot
3. Dashboard-on latod az utolso meroallasokat
4. "Meroallas rogzites" - ird be az aktualis erteket, csatolj fotot
5. "Elozmeny" - grafikon + lista az osszes korabbi meresrol

### Admin felulet (/admin)
1. Jelentkezz be a felhasznalonevvel + jelszoval
2. **Dashboard:** Attekintes, legutobb rogzitett meroallasok
3. **Ingatlanok:** Uj hozzaadasa, szerkesztes, torles, PIN beallitas
4. **Meroallasok:** Osszes ingatlan osszes merese, szurheto
5. **Fizetesek:** Befizetesek rogzitese, atutalas/keszpenz
6. **Karbantartas:** Javitasok naplozasa koltsegel
7. **Todo:** Tennivalo lista prioritassal es hataridovel
8. **Tarifak:** Dij modositas (uj tarifa = uj sor, a regi megmarad)
9. **ROI:** Megterules kalkulator (veteli ar vs berlet vs karbantartas)

---

## Backup es restore

### Manualis backup
```bash
docker exec rezsi-postgres-dev pg_dump -U rezsi_user rezsi_dev | gzip > backup.sql.gz
```

### Automatikus backup (prod)
```bash
# A backup/backup.sh script napi futtatasa cron-nal
# 30 napos retencio, regebbi backupok automatikusan torlodnek
```

### Restore
```bash
./backup/restore.sh /backups/rezsifigyelo/rezsi_backup_20250301_020000.sql.gz
```

### Offsite backup (Unraid-ra)
```bash
# VPS-rol Unraid-ra rsync
rsync -avz /backups/rezsifigyelo/ root@unraid-ip:/mnt/user/backups/vps/rezsifigyelo/
```

---

## Hibakereses

### Container logok
```bash
docker compose logs -f rezsi-app
docker compose logs -f postgres
```

### Adatbazis eleres
```bash
docker exec -it rezsi-postgres-dev psql -U rezsi_user -d rezsi_dev
```

### Ujrainditasbb
```bash
docker compose restart rezsi-app
```

### Teljes ujraepites
```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```
