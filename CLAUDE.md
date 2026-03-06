# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Project Management MVP: Kanban board app with AI chat sidebar. Single Docker container running a Python FastAPI backend that serves a statically exported Next.js frontend. SQLite for persistence, OpenAI for AI features.

MVP credentials: `user` / `password`. One board per user. Runs locally via Docker.

## Commands

### Backend (from `backend/`)
```bash
uv sync                              # Install dependencies
uv run pytest                        # Run all backend tests
uv run pytest tests/test_app.py      # Run a specific test file
uv run pytest -k test_name           # Run a single test by name
uv run uvicorn app.main:app --host 127.0.0.1 --port 3100  # Run backend locally
```

### Frontend (from `frontend/`)
```bash
npm install                          # Install dependencies
npm run build                        # Static export (output: frontend/out/)
npm run dev                          # Dev server
npm run lint                         # ESLint
npm run test                         # Vitest unit/component tests
npm run test:e2e                     # Playwright e2e tests
npm run serve:e2e                    # Build frontend + start backend for e2e
```

### Docker (from project root)
```bash
docker compose up --build            # Build and run the full stack
docker compose down                  # Stop
```
Or use `scripts/start-mac.sh`, `scripts/stop-mac.sh` (also linux/windows variants).

## Architecture

```
frontend/          Next.js (App Router, TypeScript, Tailwind, @dnd-kit)
  src/app/         Pages: / (board), /login
  src/components/  KanbanBoard, AIChatSidebar, KanbanColumn, KanbanCard, LoginForm, etc.
  src/lib/         kanban.ts (types + drag helpers), boardApi.ts (API client)

backend/           Python FastAPI
  app/main.py      App factory, all API routes, session middleware, static file serving
  app/db.py        SQLite schema, seed data, board CRUD
  app/ai.py        OpenAI integration, structured output, board mutation from AI responses
  app/settings.py  Environment config
  tests/           pytest suite

docker-compose.yml Single-service config, maps port 8001->8000
Dockerfile         Multi-stage: Node builds frontend, Python runs backend + serves static
```

### Data Flow
- Frontend fetches board from `GET /api/board`, mutates via `PATCH /api/cards/{id}`, `POST /api/columns/{id}/cards`, etc.
- All mutation endpoints return the full updated board; frontend replaces local state with the response.
- AI sidebar sends chat + board state to `POST /api/ai/board`, which calls OpenAI with structured output, applies board mutations server-side, and returns both the AI message and updated board.
- Auth uses session cookies via Starlette `SessionMiddleware`.
- SQLite database auto-created at `backend/data/pm.sqlite3`.

### Static Serving
- In Docker: frontend builds to `frontend/out/`, copied into `backend/app/static/` at build time.
- In local dev: backend checks `frontend/out/` first, falls back to `backend/app/static/`.

## API Routes

All board routes require session cookie from `POST /api/login`. See `docs/API.md` for full details.

- `GET /api/health` - health check
- `POST /api/login` / `POST /api/logout` - session auth
- `GET /api/board` - full board for current user
- `PATCH /api/columns/{column_id}` - rename column (returns full board)
- `POST /api/columns/{column_id}/cards` - create card (returns full board)
- `PATCH /api/cards/{card_id}` - update card title/details/column/position (returns full board)
- `DELETE /api/cards/{card_id}` - delete card (returns full board)
- `POST /api/ai/connectivity` - verify OpenAI config
- `POST /api/ai/board` - AI chat: accepts `message` + `history`, returns `assistantMessage`, `appliedOperations`, `board`

## Database

SQLite with 4 relational tables: `users`, `boards`, `columns`, `cards`. See `docs/DATABASE_SCHEMA.md` for DDL and design rationale. Key points:
- Position-based ordering for columns and cards
- JSON extension fields on `boards.settings_json` and `cards.metadata_json` for future use
- Auto-seeded on first startup: 1 user, 1 board, 5 columns, 8 demo cards
- Database file: `backend/data/pm.sqlite3`

## Environment Variables

- `OPENAI_API_KEY` - required for AI features (in `.env` at project root)
- `OPENAI_MODEL` - defaults to `gpt-5-mini`
- `SESSION_SECRET` - defaults to a dev value

## Local Dev Notes

- Docker must be running before `docker compose up`
- App is published on `http://localhost:8001` (avoids port 8000 conflicts)
- Backend reads `.env` from project root during local `uv run` dev; `docker compose` passes env vars into the container

## Project Status

All 10 plan phases are complete (see `docs/PLAN.md`): scaffolding, frontend integration, auth, database, backend APIs, frontend-backend wiring, AI connectivity, AI board operations, and AI chat sidebar.

## Coding Standards (from AGENTS.md)

- Keep it simple. Never over-engineer. No unnecessary defensive programming. No extra features.
- Be concise. No emojis ever.
- When hitting issues, identify root cause with evidence before attempting a fix.
- Use latest library versions and idiomatic approaches.

## Color Scheme

- Accent Yellow: `#ecad0a` -- Purple Secondary: `#753991` (submit buttons)
- Blue Primary: `#209dd7` -- Dark Navy: `#032147` (headings)
- Gray Text: `#888888`
