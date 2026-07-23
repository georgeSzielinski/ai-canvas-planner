from fastapi.testclient import TestClient


def test_health(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "canvas-sweeper-api", "database": None}


def test_ready(client: TestClient) -> None:
    response = client.get("/ready")
    assert response.status_code == 200
    assert response.json()["database"] == "available"


def test_demo_bootstrap(client: TestClient) -> None:
    response = client.get("/api/v1/demo/bootstrap")
    assert response.status_code == 200
    payload = response.json()
    assert payload["reference_date"].startswith("2026-09-16")
    assert len(payload["courses"]) == 6
    assert len(payload["assignments"]) == 7
    assert payload["settings"]["profile"]["display_name"] == "Maya Kessler"


def test_authenticated_workspace_bootstrap_excludes_demo_state(client: TestClient) -> None:
    response = client.get("/api/v1/workspace/bootstrap")

    assert response.status_code == 200
    payload = response.json()
    assert payload["assignments"]
    assert payload["workload"] == []
    assert "reference_date" not in payload
    assert "canvas_connection" not in payload
    assert "calendar_connection" not in payload


def test_assignment_list(client: TestClient) -> None:
    response = client.get("/api/v1/assignments")
    assert response.status_code == 200
    assert response.json()[0]["id"] == "assignment-missing"


def test_assignment_detail(client: TestClient) -> None:
    response = client.get("/api/v1/assignments/assignment-physics")
    assert response.status_code == 200
    assert response.json()["analysis"]["priority_score"] == 92


def test_assignment_update(client: TestClient) -> None:
    response = client.patch(
        "/api/v1/assignments/assignment-precalc",
        json={"completion_state": "completed", "estimated_minutes": 40},
    )
    assert response.status_code == 200
    assert response.json()["completion_state"] == "completed"
    assert response.json()["estimated_minutes"] == 40


def test_invalid_assignment_id(client: TestClient) -> None:
    response = client.get("/api/v1/assignments/does-not-exist")
    assert response.status_code == 404
    assert response.json()["detail"] == "Assignment not found"


def test_assignment_validation_error(client: TestClient) -> None:
    response = client.patch("/api/v1/assignments/assignment-precalc", json={"estimated_minutes": 2})
    assert response.status_code == 422


def test_settings_read_and_update(client: TestClient) -> None:
    settings = client.get("/api/v1/settings").json()
    settings["profile"]["display_name"] = "Maya Updated"
    response = client.patch("/api/v1/settings", json=settings)
    assert response.status_code == 200
    assert response.json()["profile"]["display_name"] == "Maya Updated"
    assert client.get("/api/v1/settings").json()["profile"]["display_name"] == "Maya Updated"


def test_settings_validation_error(client: TestClient) -> None:
    settings = client.get("/api/v1/settings").json()
    settings["profile"]["display_name"] = ""
    response = client.patch("/api/v1/settings", json=settings)
    assert response.status_code == 422


def test_insights(client: TestClient) -> None:
    response = client.get("/api/v1/insights")
    assert response.status_code == 200
    assert len(response.json()) == 4


def test_canvai_deterministic_proposal(client: TestClient) -> None:
    first = client.post("/api/v1/canvai/proposals", json={"command": "Protect sleep"})
    second = client.post("/api/v1/canvai/proposals", json={"command": "Protect sleep"})
    assert first.status_code == 200
    assert first.json() == second.json()
    assert first.json()["changes"][0]["kind"] == "protect"


def test_canvai_validation_error(client: TestClient) -> None:
    response = client.post("/api/v1/canvai/proposals", json={"command": "x"})
    assert response.status_code == 422


def test_notification_bulk_read_and_dismiss_are_persistent(client: TestClient) -> None:
    notifications = client.get("/api/v1/notifications").json()
    assert notifications

    marked = client.post("/api/v1/notifications/read-all")
    assert marked.status_code == 200
    assert all(item["read"] for item in client.get("/api/v1/notifications").json())

    dismissed = client.delete(f"/api/v1/notifications/{notifications[0]['id']}")
    assert dismissed.status_code == 200
    assert notifications[0]["id"] not in {
        item["id"] for item in client.get("/api/v1/notifications").json()
    }
