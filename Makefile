.PHONY: help install start stop restart logs clean test deploy

help: ## Afficher l'aide
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

install: ## Installer les dépendances
	@echo "📦 Installation des dépendances..."
	cd services/api && npm install
	cd services/frontend && npm install

start: ## Démarrer tous les services
	@echo "🚀 Démarrage des services..."
	docker-compose up -d

stop: ## Arrêter tous les services
	@echo "🛑 Arrêt des services..."
	docker-compose down

restart: stop start ## Redémarrer tous les services

logs: ## Afficher les logs
	docker-compose logs -f

logs-api: ## Logs de l'API uniquement
	docker-compose logs -f api

logs-frontend: ## Logs du frontend uniquement
	docker-compose logs -f frontend

clean: ## Nettoyer les conteneurs et volumes
	@echo "🧹 Nettoyage..."
	docker-compose down -v
	rm -rf data/postgres/* data/redis/* data/logs/*

build: ## Rebuilder les images
	@echo "🔨 Build des images..."
	docker-compose build --no-cache

test: ## Lancer les tests
	@echo "🧪 Tests API..."
	cd services/api && npm test
	@echo "🧪 Tests Frontend..."
	cd services/frontend && npm test

lint: ## Linter le code
	@echo "🔍 Lint API..."
	cd services/api && npm run lint
	@echo "🔍 Lint Frontend..."
	cd services/frontend && npm run lint

format: ## Formater le code
	@echo "✨ Format API..."
	cd services/api && npm run format
	@echo "✨ Format Frontend..."
	cd services/frontend && npm run format

db-migrate: ## Exécuter les migrations
	@echo "📊 Migrations database..."
	./scripts/db-migrate.sh

db-seed: ## Peupler la base (dev)
	@echo "🌱 Seed database..."
	./scripts/db-seed.sh

backup: ## Sauvegarder la base
	@echo "💾 Backup..."
	./scripts/backup/backup.sh

deploy-dev: ## Déployer en dev
	@echo "🚀 Déploiement développement..."
	./scripts/deploy/deploy.sh dev

deploy-prod: ## Déployer en production
	@echo "🚀 Déploiement production..."
	./scripts/deploy/deploy-production.sh

health: ## Vérifier la santé des services
	@echo "🏥 Health check..."
	curl http://localhost:3000/health
	curl http://localhost:443/api/health

ps: ## Afficher les conteneurs
	docker-compose ps

shell-api: ## Shell dans le conteneur API
	docker-compose exec api sh

shell-db: ## Shell PostgreSQL
	docker-compose exec postgres psql -U mssante -d mssante

.DEFAULT_GOAL := help