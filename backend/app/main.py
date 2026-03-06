import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from starlette.middleware.sessions import SessionMiddleware


app = FastAPI(title="Project Management MVP API")
app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SESSION_SECRET", "project-management-mvp-dev-secret"),
    session_cookie="pm_session",
    same_site="lax",
    https_only=False,
    max_age=60 * 60 * 12,
)

APP_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = APP_DIR.parents[1]
LOCAL_FRONTEND_OUT = PROJECT_ROOT / "frontend" / "out"
FALLBACK_STATIC_DIR = APP_DIR / "static"
STATIC_DIR = (
    LOCAL_FRONTEND_OUT
    if (LOCAL_FRONTEND_OUT / "index.html").exists()
    else FALLBACK_STATIC_DIR
)
DEMO_USERNAME = "user"
DEMO_PASSWORD = "password"


class LoginRequest(BaseModel):
    username: str
    password: str


def is_authenticated(request: Request) -> bool:
    return request.session.get("authenticated") is True


def resolve_page(name: str) -> Path:
    direct_page = STATIC_DIR / f"{name}.html"
    nested_page = STATIC_DIR / name / "index.html"

    if direct_page.exists():
        return direct_page
    if nested_page.exists():
        return nested_page

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)


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


app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
