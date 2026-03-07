import logging
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field, model_validator
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.middleware.sessions import SessionMiddleware
from starlette.responses import Response
from dotenv import load_dotenv

from app.ai import (
    AIBoardOperationError,
    AIBoardRequest,
    AIConfigurationError,
    AIConnectivityError,
    AIResponseFormatError,
    check_openai_connectivity,
    run_board_assistant_turn,
)
from app.db import (
    DEMO_USERNAME,
    add_card,
    connect,
    delete_card,
    get_board_for_username,
    get_database_path,
    initialize_database,
    rename_column,
    update_card,
)


logger = logging.getLogger(__name__)
APP_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = APP_DIR.parents[1]
LOCAL_FRONTEND_OUT = PROJECT_ROOT / "frontend" / "out"
FALLBACK_STATIC_DIR = APP_DIR / "static"
DEMO_PASSWORD = "password"
CSRF_HEADER = "X-Requested-With"
CSRF_SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}

load_dotenv(PROJECT_ROOT / ".env", override=False)


class CSRFMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        if (
            request.method not in CSRF_SAFE_METHODS
            and request.url.path.startswith("/api/")
            and request.url.path != "/api/health"
            and CSRF_HEADER not in request.headers
        ):
            return Response("CSRF header missing", status_code=403)
        return await call_next(request)


class LoginRequest(BaseModel):
    username: str
    password: str


MAX_TITLE_LENGTH = 500
MAX_DETAILS_LENGTH = 5000


class ColumnUpdateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=MAX_TITLE_LENGTH)


class CardCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=MAX_TITLE_LENGTH)
    details: str = Field(default="", max_length=MAX_DETAILS_LENGTH)


class CardUpdateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    title: str | None = Field(default=None, min_length=1, max_length=MAX_TITLE_LENGTH)
    details: str | None = Field(default=None, max_length=MAX_DETAILS_LENGTH)
    column_id: str | None = Field(default=None, alias="columnId")
    position: int | None = None

    @model_validator(mode="after")
    def validate_fields(self) -> "CardUpdateRequest":
        if (
            self.title is None
            and self.details is None
            and self.column_id is None
            and self.position is None
        ):
            raise ValueError("At least one card field must be provided.")
        return self


def is_authenticated(request: Request) -> bool:
    return request.session.get("authenticated") is True


def get_current_username(request: Request) -> str:
    if not is_authenticated(request):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    username = request.session.get("username")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )
    return username


def get_static_dir() -> Path:
    return (
        LOCAL_FRONTEND_OUT
        if (LOCAL_FRONTEND_OUT / "index.html").exists()
        else FALLBACK_STATIC_DIR
    )


def resolve_page(name: str) -> Path:
    static_dir = get_static_dir()
    direct_page = static_dir / f"{name}.html"
    nested_page = static_dir / name / "index.html"

    if direct_page.exists():
        return direct_page
    if nested_page.exists():
        return nested_page

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)


@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_database(get_database_path())
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="Project Management MVP API", lifespan=lifespan)
    session_secret = os.getenv("SESSION_SECRET")
    if not session_secret:
        raise RuntimeError(
            "SESSION_SECRET is required. Set it in the environment or project root .env file."
        )

    https_only = os.getenv("HTTPS_ONLY", "").lower() in ("1", "true", "yes")

    app.add_middleware(
        SessionMiddleware,
        secret_key=session_secret,
        session_cookie="pm_session",
        same_site="lax",
        https_only=https_only,
        max_age=60 * 60 * 12,
    )

    app.add_middleware(CSRFMiddleware)

    ai_rate_limit: dict[str, float] = {}
    AI_RATE_LIMIT_SECONDS = 2.0

    @app.get("/", include_in_schema=False)
    def read_index(request: Request):
        if not is_authenticated(request):
            return RedirectResponse(url="/login", status_code=status.HTTP_303_SEE_OTHER)
        return FileResponse(resolve_page("index"))

    @app.get("/index.html", include_in_schema=False)
    def read_index_file(request: Request):
        if not is_authenticated(request):
            return RedirectResponse(url="/login", status_code=status.HTTP_303_SEE_OTHER)
        return FileResponse(resolve_page("index"))

    @app.get("/login", include_in_schema=False)
    def read_login(request: Request):
        if is_authenticated(request):
            return RedirectResponse(url="/", status_code=status.HTTP_303_SEE_OTHER)
        return FileResponse(resolve_page("login"))

    @app.get("/login.html", include_in_schema=False)
    def read_login_file(request: Request):
        if is_authenticated(request):
            return RedirectResponse(url="/", status_code=status.HTTP_303_SEE_OTHER)
        return FileResponse(resolve_page("login"))

    @app.get("/api/health")
    def read_health() -> dict[str, str]:
        return {
            "status": "ok",
            "message": "Hello from FastAPI",
        }

    @app.post("/api/ai/connectivity")
    def read_ai_connectivity(request: Request) -> dict[str, str]:
        get_current_username(request)

        try:
            return check_openai_connectivity()
        except AIConfigurationError as error:
            logger.warning("AI connectivity check unavailable: %s", error)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)
            ) from error
        except AIConnectivityError as error:
            logger.exception("AI connectivity check failed.")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY, detail=str(error)
            ) from error

    @app.post("/api/ai/board")
    def create_ai_board_response(payload: AIBoardRequest, request: Request) -> dict:
        username = get_current_username(request)

        now = time.monotonic()
        last_request = ai_rate_limit.get(username, 0.0)
        if now - last_request < AI_RATE_LIMIT_SECONDS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Please wait a moment before sending another AI request.",
            )
        ai_rate_limit[username] = now

        try:
            with connect() as connection:
                return run_board_assistant_turn(connection, username, payload)
        except AIConfigurationError as error:
            logger.warning("AI board request unavailable: %s", error)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)
            ) from error
        except (
            AIConnectivityError,
            AIResponseFormatError,
            AIBoardOperationError,
        ) as error:
            logger.exception("AI board request failed.")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY, detail=str(error)
            ) from error

    @app.post("/api/login")
    def login(payload: LoginRequest, request: Request) -> dict[str, str | bool]:
        if payload.username != DEMO_USERNAME or payload.password != DEMO_PASSWORD:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials.",
            )

        request.session["authenticated"] = True
        request.session["username"] = DEMO_USERNAME
        return {
            "authenticated": True,
            "username": DEMO_USERNAME,
        }

    @app.post("/api/logout")
    def logout(request: Request) -> dict[str, bool]:
        request.session.clear()
        return {"authenticated": False}

    @app.get("/api/board")
    def read_board(request: Request) -> dict:
        with connect() as connection:
            return get_board_for_username(connection, get_current_username(request))

    @app.patch("/api/columns/{column_id}")
    def update_column(
        column_id: str, payload: ColumnUpdateRequest, request: Request
    ) -> dict:
        try:
            with connect() as connection:
                return rename_column(
                    connection,
                    get_current_username(request),
                    column_id,
                    payload.title,
                )
        except ValueError as error:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=str(error)
            ) from error

    @app.post("/api/columns/{column_id}/cards")
    def create_card(
        column_id: str, payload: CardCreateRequest, request: Request
    ) -> dict:
        try:
            with connect() as connection:
                return add_card(
                    connection,
                    get_current_username(request),
                    column_id,
                    payload.title,
                    payload.details,
                )
        except ValueError as error:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=str(error)
            ) from error

    @app.patch("/api/cards/{card_id}")
    def patch_card(card_id: str, payload: CardUpdateRequest, request: Request) -> dict:
        try:
            with connect() as connection:
                return update_card(
                    connection,
                    get_current_username(request),
                    card_id,
                    payload.title,
                    payload.details,
                    payload.column_id,
                    payload.position,
                )
        except ValueError as error:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=str(error)
            ) from error

    @app.delete("/api/cards/{card_id}")
    def remove_card(card_id: str, request: Request) -> dict:
        try:
            with connect() as connection:
                return delete_card(connection, get_current_username(request), card_id)
        except ValueError as error:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=str(error)
            ) from error

    app.mount("/", StaticFiles(directory=get_static_dir(), html=True), name="static")
    return app


app = create_app()
