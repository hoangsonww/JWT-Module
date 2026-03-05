.PHONY: help install build test test-coverage dev docker-build docker-run docker-stop docker-compose-up docker-compose-down clean

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies
	npm ci

build: ## Build TypeScript to dist/
	npm run build

test: ## Run tests
	npm test

test-coverage: ## Run tests with coverage report
	npm run test:coverage

dev: ## Start dev server on port 5001
	PORT=5001 npx ts-node src/server.ts

docker-build: ## Build Docker image
	docker build -t jwt-module .

docker-run: ## Run Docker container (requires JWT_ACCESS_SECRET and JWT_REFRESH_SECRET env vars)
	docker run -d --name jwt-module \
		-p 5001:5001 \
		-e PORT=5001 \
		-e JWT_ACCESS_SECRET=$${JWT_ACCESS_SECRET} \
		-e JWT_REFRESH_SECRET=$${JWT_REFRESH_SECRET} \
		jwt-module

docker-stop: ## Stop and remove Docker container
	docker stop jwt-module && docker rm jwt-module

docker-compose-up: ## Start services with docker-compose
	docker compose up -d

docker-compose-down: ## Stop services with docker-compose
	docker compose down

clean: ## Remove build artifacts and node_modules
	rm -rf dist coverage node_modules
