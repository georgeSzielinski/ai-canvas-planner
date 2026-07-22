from functools import lru_cache

from cryptography.fernet import Fernet
from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Canvas Sweeper API"
    environment: str = "development"
    database_url: str = "sqlite:///./canvas_sweeper.db"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    frontend_url: str = "http://localhost:3000"
    session_cookie_name: str = "canvas_sweeper_session"
    session_hours: int = 12
    remember_session_days: int = 30
    google_client_id: str = ""
    google_client_secret: str = ""
    google_auth_redirect_uri: str = "http://localhost:8000/api/v1/auth/google/callback"
    google_calendar_redirect_uri: str = "http://localhost:8000/api/v1/calendar/oauth/callback"
    oauth_state_secret: str = ""
    credential_encryption_key: str = ""
    credential_encryption_key_version: int = 1
    credential_encryption_previous_keys: dict[int, str] = Field(default_factory=dict)

    model_config = SettingsConfigDict(env_file=".env", env_prefix="CANVAS_SWEEPER_", extra="ignore")

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def cookie_secure(self) -> bool:
        return self.environment.lower() in {"production", "staging"}

    @model_validator(mode="after")
    def validate_deployment_security(self) -> "Settings":
        if self.credential_encryption_key_version < 1:
            raise ValueError("credential_encryption_key_version must be positive")
        if self.credential_encryption_key_version in self.credential_encryption_previous_keys:
            raise ValueError("The active credential key version cannot also be a previous key")
        for version, key in self.credential_encryption_previous_keys.items():
            if version < 1:
                raise ValueError("Previous credential key versions must be positive")
            try:
                Fernet(key.encode("ascii"))
            except (ValueError, UnicodeEncodeError) as error:
                raise ValueError(f"Previous credential key version {version} is invalid") from error
        if self.environment.lower() not in {"production", "staging"}:
            return self
        required = {
            "google_client_id": self.google_client_id,
            "google_client_secret": self.google_client_secret,
            "oauth_state_secret": self.oauth_state_secret,
            "credential_encryption_key": self.credential_encryption_key,
        }
        missing = [name for name, value in required.items() if not value]
        if missing:
            raise ValueError(f"Missing required deployment secrets: {', '.join(missing)}")
        if len(self.oauth_state_secret) < 32:
            raise ValueError("oauth_state_secret must be at least 32 characters")
        try:
            Fernet(self.credential_encryption_key.encode("ascii"))
        except (ValueError, UnicodeEncodeError) as error:
            raise ValueError("credential_encryption_key must be a valid Fernet key") from error
        secure_urls = [
            self.frontend_url,
            self.google_auth_redirect_uri,
            self.google_calendar_redirect_uri,
            *self.allowed_origins,
        ]
        if any(not value.startswith("https://") for value in secure_urls):
            raise ValueError("Production and staging URLs must use HTTPS")
        if "*" in self.allowed_origins:
            raise ValueError("Credentialed CORS cannot use a wildcard origin")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
