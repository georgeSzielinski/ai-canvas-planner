from fastapi import FastAPI, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.auth_routes import router as auth_router
from app.api.calendar_routes import router as calendar_router
from app.api.routes import router
from app.api.user_routes import router as user_router
from app.core.config import get_settings

settings = get_settings()


def error_code(status_code: int) -> str:
    return {
        400: "invalid_request",
        401: "authentication_required",
        403: "permission_denied",
        404: "not_found",
        409: "conflict",
        422: "validation_error",
        429: "rate_limited",
        502: "provider_error",
        503: "service_unavailable",
    }.get(status_code, "request_failed")


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Authenticated Canvas Sweeper API with Google Calendar integration.",
)


@app.exception_handler(HTTPException)
async def http_error(_request: Request, error: HTTPException) -> JSONResponse:
    message = str(error.detail)
    return JSONResponse(
        status_code=error.status_code,
        headers=error.headers,
        content={
            "detail": error.detail,
            "error": {"code": error_code(error.status_code), "message": message},
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_error(_request: Request, error: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={
            "detail": jsonable_encoder(error.errors()),
            "error": {"code": "validation_error", "message": "Request validation failed"},
        },
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "PATCH", "PUT", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-CSRF-Token"],
)
app.include_router(router)
app.include_router(auth_router)
app.include_router(user_router)
app.include_router(calendar_router)
