.PHONY: dev frontend backend install test lint format build migrate seed

install:
	cd frontend && npm install
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

lint:
	cd frontend && npm run lint && npm run typecheck
	cd backend && .venv/bin/ruff check . && .venv/bin/mypy app

format:
	cd frontend && npm run format
	cd backend && .venv/bin/ruff format . && .venv/bin/ruff check --fix .

build:
	cd frontend && npm run build

migrate:
	cd backend && .venv/bin/alembic upgrade head

seed:
	cd backend && .venv/bin/python -m app.db.seed
