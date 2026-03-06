# Local Startup

## Current app behavior

The current scaffold runs a FastAPI backend that serves:

- the exported Kanban frontend at `/`
- a JSON endpoint at `/api/health`
- a login flow at `/login`
- database-backed board APIs under `/api/board`, `/api/columns/...`, and `/api/cards/...`

## Start commands

Use one of these options from the project root:

```bash
docker compose up --build -d
```

Or use the helper scripts:

```bash
./scripts/start-mac.sh
./scripts/start-linux.sh
```

On Windows PowerShell:

```powershell
./scripts/start-windows.ps1
```

## Stop commands

```bash
docker compose down --remove-orphans
```

Or use the matching helper script for your platform.

## Notes

- Docker must be running locally before you start the app.
- The app is published on `http://localhost:8001` to avoid conflicts with an existing local service already using port `8000`.
- Part 3 now builds the Next.js frontend as a static export inside Docker and serves it through FastAPI.
- Part 4 requires sign-in before the board is visible.
- Demo credentials: `user` / `password`
- The SQLite database is created automatically at `backend/data/pm.sqlite3`.
- Authentication, database persistence, and AI connectivity will be added in later phases.
