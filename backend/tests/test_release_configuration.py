from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


def test_backend_image_is_non_root_and_leaves_migrations_to_release_orchestration() -> None:
    dockerfile = (REPOSITORY_ROOT / "backend" / "Dockerfile").read_text()
    compose = (REPOSITORY_ROOT / "docker-compose.yml").read_text()

    assert "app.db.seed" not in dockerfile
    assert "USER app" in dockerfile
    assert "alembic upgrade head" not in dockerfile
    assert "alembic upgrade head" in compose
    assert 'user: "0:0"' in compose
    assert 'command: ["sh", "-c", "chown -R app:app /data"]' in compose
    assert "condition: service_completed_successfully" in compose


def test_normal_runtime_has_no_demo_seed_or_bootstrap_path() -> None:
    backend_app = REPOSITORY_ROOT / "backend" / "app"
    production_sources = "\n".join(
        path.read_text() for path in backend_app.rglob("*.py") if "__pycache__" not in path.parts
    )
    makefile = (REPOSITORY_ROOT / "Makefile").read_text()

    assert '"/demo/bootstrap"' not in production_sources
    assert "app.db.seed" not in production_sources
    assert "app.db.seed" not in makefile
    assert "make seed" not in makefile


def test_frontend_container_build_receives_public_backend_configuration() -> None:
    dockerfile = (REPOSITORY_ROOT / "frontend" / "Dockerfile").read_text()
    compose = (REPOSITORY_ROOT / "docker-compose.yml").read_text()

    build_line = dockerfile.index("RUN npm run build")
    assert dockerfile.index("ARG NEXT_PUBLIC_API_BASE_URL") < build_line
    assert "args:" in compose
    assert "NEXT_PUBLIC_DATA_MODE" not in dockerfile
    assert "NEXT_PUBLIC_DATA_MODE" not in compose
    assert "NEXT_PUBLIC_API_BASE_URL: http://localhost:8000/api/v1" in compose
