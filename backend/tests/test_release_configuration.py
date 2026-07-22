from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


def test_backend_container_startup_does_not_seed_or_reset_data() -> None:
    dockerfile = (REPOSITORY_ROOT / "backend" / "Dockerfile").read_text()

    assert "app.db.seed" not in dockerfile
    assert "alembic upgrade head" in dockerfile


def test_frontend_container_build_receives_public_backend_configuration() -> None:
    dockerfile = (REPOSITORY_ROOT / "frontend" / "Dockerfile").read_text()
    compose = (REPOSITORY_ROOT / "docker-compose.yml").read_text()

    build_line = dockerfile.index("RUN npm run build")
    assert dockerfile.index("ARG NEXT_PUBLIC_API_BASE_URL") < build_line
    assert dockerfile.index("ARG NEXT_PUBLIC_DATA_MODE") < build_line
    assert "NEXT_PUBLIC_DATA_MODE=backend" in dockerfile[:build_line]
    assert "args:" in compose
    assert "NEXT_PUBLIC_DATA_MODE: backend" in compose
    assert "NEXT_PUBLIC_API_BASE_URL: http://localhost:8000/api/v1" in compose
