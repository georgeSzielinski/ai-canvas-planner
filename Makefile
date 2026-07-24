.PHONY: dev frontend backend install test test-e2e lint format format-check build build-images migrate compose-check audit check

install:
	cd frontend && npm ci
	python3 -m venv backend/.venv
	backend/.venv/bin/pip install -e 'backend[dev]'

dev:
	docker compose up

frontend:
	cd frontend && npm run dev

backend:
	cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000

test:
	cd frontend && npm test
	cd backend && .venv/bin/pytest

test-e2e:
	cd frontend && npm run test:e2e

lint:
	cd frontend && npm run lint && npm run typecheck
	cd backend && .venv/bin/ruff check . && .venv/bin/mypy app

format:
	cd frontend && npm run format
	cd backend && .venv/bin/ruff format . && .venv/bin/ruff check --fix .

format-check:
	cd frontend && npm run format:check
	cd backend && .venv/bin/ruff format --check app tests alembic

build:
	cd frontend && npm run build

build-images:
	docker compose build

compose-check:
	docker compose config --quiet

audit:
	cd frontend && npm audit --omit=dev --audit-level=high
	cd backend && .venv/bin/pip-audit --requirement constraints.lock && .venv/bin/pip check

check: format-check lint test build compose-check audit

migrate:
	cd backend && .venv/bin/alembic upgrade head
