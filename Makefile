# Rezsi Figyelo - Makefile
# Hasznalat: make <parancs>

.PHONY: help dev prod stop logs seed backup restore clean

help: ## Sugo - elerheto parancsok
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

dev: ## Dev inditas (docker compose up)
	docker compose up -d
	@echo ""
	@echo "Rezsi Figyelo dev elindult: http://localhost:5003"
	@echo "Admin: admin / admin123"

prod: ## Prod inditas (VPS)
	docker compose -f docker-compose.prod.yml up -d

stop: ## Leallitas
	docker compose down

logs: ## Logok megtekintese
	docker compose logs -f

logs-app: ## Csak app logok
	docker compose logs -f rezsi-app

seed: ## Teszt adatok betoltese
	docker exec rezsi-app-dev python scripts/seed_data.py

backup: ## Manualis backup
	docker exec rezsi-postgres-dev pg_dump -U rezsi_user rezsi_dev | gzip > backup_$$(date +%Y%m%d_%H%M%S).sql.gz
	@echo "Backup keszult."

restore: ## Restore backupbol (BACKUP=fajlnev)
	@test -n "$(BACKUP)" || (echo "Hasznalat: make restore BACKUP=backup_file.sql.gz" && exit 1)
	./backup/restore.sh $(BACKUP)

rebuild: ## Ujraepites (kod valtozas utan)
	docker compose build --no-cache rezsi-app
	docker compose up -d rezsi-app

db-shell: ## Adatbazis shell
	docker exec -it rezsi-postgres-dev psql -U rezsi_user -d rezsi_dev

app-shell: ## App container shell
	docker exec -it rezsi-app-dev /bin/sh

clean: ## Minden torles (adatbazis is!)
	docker compose down -v
	@echo "Minden torolve (volumes is)."
