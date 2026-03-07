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

If you use `docker compose` directly, set `SESSION_SECRET` first or add it to the project root `.env` file.

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
- The SQLite database is created automatically inside the Docker-managed `pm_data` volume.
- If you need to reset persisted app data, run `docker compose down -v`.
- Board changes now persist through the backend API, so refresh and re-login should keep your updates.
- `SESSION_SECRET` is required for signed session cookies. The helper start scripts generate a temporary local value automatically when one is not already set.
- Set `OPENAI_API_KEY` in the project root `.env` before using the AI connectivity check.
- The backend reads the key from the root `.env` during local `uv run` development, and `docker compose` passes it into the app container.
- `OPENAI_MODEL` is optional and overrides the backend default model, which is currently `gpt-5-mini`.
- After signing in, `POST /api/ai/connectivity` runs a narrow `2+2` check against the configured model.
- After signing in, `POST /api/ai/board` accepts a user `message` plus optional `history` and returns an `assistantMessage`, `appliedOperations`, and the latest `board`.
- The main board page now includes an AI sidebar that sends those `/api/ai/board` requests and refreshes the UI from the returned board snapshot.

## Tests

Run backend tests through `uv` so the locked dependency set is used:

```bash
cd backend
uv run pytest
```
