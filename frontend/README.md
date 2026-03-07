# Kanban Studio

## Run

The main app runs through the FastAPI backend and Docker from the project root:

```bash
docker compose up --build -d
```

For frontend-only development inside `frontend/`:

```bash
npm install
npm run dev
```

## Tests

```bash
npm run test:unit
npm run test:e2e
```
