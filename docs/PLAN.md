# Project Plan

## Working assumptions

- `docker-compose` is acceptable for local development orchestration.
- The Next.js frontend will be built as a static export and served by FastAPI as files.
- Authentication should be backend-enforced using session and cookie behavior, even with the MVP's dummy credentials.
- The database should use a relational SQLite schema, with JSON fields only where they simplify the design.
- The AI structured output schema will be designed during the AI phase and reviewed then.
- The enriched plan in this document will be reviewed and approved once before implementation continues past Part 1.
- Going forward, testing should target valuable coverage rather than coverage for its own sake; aiming for roughly 80% is sensible when it happens naturally, but falling short is acceptable when extra tests would add little value.

## Part 1: Plan

### Goal

Turn this outline into an implementation-ready plan and document the current frontend demo so future work is grounded in the actual starting point.

### Checklist

- [x] Review `AGENTS.md`, this file, and the existing `frontend/` codebase.
- [x] Create `frontend/AGENTS.md` describing the current frontend-only demo, its structure, and its limitations.
- [x] Expand each project phase into concrete substeps, tests, and success criteria.
- [x] Capture the confirmed architecture decisions from the user in this document.
- [x] Present the enriched plan to the user for a single approval before moving to Part 2.

### Tests

- Documentation review only.
- Verify all planned phases have explicit tasks, tests, and success criteria.
- Verify the frontend description matches the current codebase.

### Success criteria

- The plan is specific enough to execute without re-deciding core architecture.
- `frontend/AGENTS.md` accurately describes the current demo.
- The user approves the enriched plan before implementation proceeds.

## Part 2: Scaffolding

### Goal

Create the minimal full-stack containerized skeleton: Docker, FastAPI backend, local run scripts, and a proof that backend-served static content plus an API route work end to end.

### Checklist

- [x] Create `backend/` with a minimal FastAPI app and Python project metadata using `uv`.
- [x] Add Docker support for the backend runtime and local dependencies.
- [x] Add `docker-compose` configuration for local startup.
- [x] Add cross-platform start and stop scripts in `scripts/` for macOS, Linux, and Windows.
- [x] Serve a simple static HTML page from FastAPI at `/`.
- [x] Add a simple API route, such as `/api/health`, to prove server routing works.
- [x] Ensure the containerized app runs locally with one documented command path.
- [x] Document any required environment variables and local startup notes.

### Tests

- Container build succeeds.
- `docker-compose up` starts the app successfully.
- Visiting `/` returns the example HTML page.
- Calling the example API route returns the expected JSON response.
- Start and stop scripts work on their intended platforms by inspection and at least one local execution path.

### Success criteria

- A new developer can boot the app locally with the provided scripts or `docker-compose`.
- FastAPI serves both a static page and an API endpoint successfully.
- The repository now has the backend and container scaffolding needed for later phases.

## Part 3: Add in Frontend

### Goal

Replace the placeholder HTML with the existing Kanban demo, built as static frontend assets and served by FastAPI at `/`.

### Checklist

- [x] Configure the Next.js app for static export.
- [x] Update the backend build and runtime flow to collect and serve exported frontend assets.
- [x] Confirm asset paths, routing behavior, and static file caching work in the containerized setup.
- [x] Preserve the current Kanban board behavior and styling during the migration.
- [x] Document the new build flow for frontend plus backend packaging.

### Tests

- Frontend unit tests pass.
- Frontend integration or component tests still pass after the static-export configuration.
- End-to-end smoke test confirms `/` renders the Kanban board when served through FastAPI.
- Containerized app serves the static frontend correctly, including CSS and client-side behavior.

### Success criteria

- The demo Kanban board is visible at `/` when the full stack is running.
- The frontend is served as static files by FastAPI rather than a separate Next.js runtime.
- Existing frontend behavior remains intact after integration.

## Part 4: Add a Fake User Sign-In Experience

### Goal

Add a minimal but real backend-enforced login flow using the fixed MVP credentials and a session cookie.

### Checklist

- [x] Add backend session handling and cookie configuration suitable for local development.
- [x] Add login and logout API routes.
- [x] Add frontend login UI for the credentials `user` and `password`.
- [x] Gate access to the Kanban route based on authenticated session state.
- [x] Add logout controls and signed-out behavior.
- [x] Keep the implementation intentionally simple and clearly marked as MVP auth.

### Tests

- Backend tests cover successful login, failed login, authenticated access, and logout.
- Frontend tests cover rendering the login screen, submitting credentials, and logging out.
- End-to-end test verifies that unauthenticated users cannot access the Kanban and authenticated users can.
- Session cookie behavior is verified in local integration tests.

### Success criteria

- Users must sign in before seeing the board.
- Only the dummy credentials work.
- Auth enforcement happens on the backend, not only in frontend state.

## Part 5: Database Modeling

### Goal

Define and document a simple relational SQLite schema that supports the MVP board today and multiple users later.

### Checklist

- [x] Identify the core entities needed for the MVP: users, boards, columns, cards, and any supporting metadata.
- [x] Choose where JSON fields help without replacing relational structure.
- [x] Define how one board is associated with one signed-in user for the MVP while preserving future extensibility.
- [x] Document migration and database initialization expectations.
- [x] Write the schema proposal in `docs/`.
- [x] Get explicit user sign-off on the schema proposal before implementing persistence APIs.

### Tests

- Schema review only in this phase.
- Optionally validate the schema by creating a simple local SQLite database prototype or DDL draft.
- Ensure the documented schema can represent the current frontend board structure without lossy conversion.

### Success criteria

- The schema is simple, relational, and matches the MVP requirements.
- The proposal clearly explains why each table and any JSON fields exist.
- The user approves the database approach before Part 6 begins.

## Part 6: Backend

### Goal

Implement persistent backend APIs for reading and mutating a signed-in user's board, backed by SQLite.

### Checklist

- [x] Add database initialization so the SQLite database is created if it does not exist.
- [x] Implement data access code for users, boards, columns, and cards.
- [x] Seed or create the default board for the MVP user as needed.
- [x] Add authenticated API routes to fetch the current board.
- [x] Add authenticated API routes to update board structure and card content.
- [x] Validate request payloads and return stable API responses.
- [x] Document the backend API contract at a lightweight level.

### Tests

- Backend unit tests cover database initialization, seed behavior, and core data access functions.
- API tests cover reading the board, renaming columns, adding cards, editing cards, moving cards, and deleting cards.
- Auth tests ensure board APIs reject unauthenticated requests.
- Persistence tests verify data survives server restarts.

### Success criteria

- The backend can fully represent and persist the board state for the MVP user.
- The database is created automatically when missing.
- API behavior is stable enough for the frontend to consume directly.

## Part 7: Frontend + Backend

### Goal

Replace in-memory frontend state initialization with real API-driven persistence while preserving the current Kanban UX.

### Checklist

- [x] Add a frontend API layer for auth-aware board loading and mutations.
- [x] Load the initial board from the backend after authentication.
- [x] Replace direct local-only board mutations with backend-backed updates.
- [x] Handle loading, error, and optimistic or non-optimistic update states in a simple way.
- [x] Refresh the UI from persisted backend state after mutations.
- [x] Keep the existing board interactions and styling intact.

### Tests

- Frontend unit tests cover API client behavior and key state transitions.
- Integration tests cover loading persisted board data and handling mutation responses.
- End-to-end tests cover full user flows: login, add card, edit card, move card, refresh page, confirm persistence.
- Regression tests confirm existing interactions still work once state comes from the backend.

### Success criteria

- The board persists across page reloads and server restarts.
- Frontend behavior remains responsive and understandable.
- The UI is now backed by the real authenticated API rather than local mock data.

## Part 8: AI Connectivity

### Goal

Prove that the backend can reach OpenAI successfully using the configured key and chosen model.

### Checklist

- [x] Add backend configuration loading for `OPENAI_API_KEY`.
- [x] Add a minimal backend service wrapper for OpenAI requests.
- [x] Implement a narrow test route or internal command path for connectivity checks.
- [x] Execute a simple prompt such as `2+2` against the configured model.
- [x] Capture and log failures clearly enough to debug configuration issues.
- [x] Keep this phase scoped to connectivity only, not board updates.

### Tests

- Unit tests cover configuration loading and service wrapper behavior with mocked responses.
- Integration test or manual verification confirms a real `2+2` response succeeds when the API key is present.
- Failure-path test confirms missing or invalid configuration produces useful errors.

### Success criteria

- The backend can successfully make at least one real OpenAI request.
- Configuration errors are easy to diagnose.
- The AI integration point is ready for structured Kanban interactions.

## Part 9: AI Board Operations

### Goal

Have the backend send the current board state, user request, and conversation history to the model and receive structured output that can optionally modify the board.

### Checklist

- [ ] Design a structured output schema with two top-level concerns: assistant response text and optional board update instructions.
- [ ] Present that schema for user review before relying on it broadly.
- [ ] Build the backend prompt and payload assembly using board JSON plus conversation history.
- [ ] Validate model responses against the structured schema.
- [ ] Translate valid update instructions into backend board mutations.
- [ ] Persist AI-driven board changes safely and return both the assistant message and the updated board state.
- [ ] Define simple failure behavior when the model response is invalid or incomplete.

### Tests

- Unit tests cover schema validation and translation from structured output into board mutations.
- Backend tests cover request assembly and expected persistence behavior with mocked model responses.
- Integration tests cover both no-op assistant replies and valid board-changing replies.
- Failure tests cover malformed AI output and confirm the board is not corrupted.

### Success criteria

- The backend consistently returns a user-facing AI message plus an optional persisted board update.
- Invalid AI responses are rejected safely.
- The structured output design is simple enough to reason about and test thoroughly.

## Part 10: AI Chat Sidebar

### Goal

Add a polished sidebar chat experience that uses the AI backend and automatically refreshes the board when AI-triggered changes are applied.

### Checklist

- [ ] Design and build the sidebar layout to fit the existing Kanban UI.
- [ ] Add chat input, message history, loading states, and error states.
- [ ] Wire the sidebar to the backend AI endpoint.
- [ ] Refresh or reconcile board state after AI-driven updates.
- [ ] Preserve a clear distinction between conversational responses and board changes.
- [ ] Keep the experience visually aligned with the project's color system.

### Tests

- Frontend component tests cover chat rendering, input submission, loading state, and error handling.
- Integration tests cover receiving assistant replies with and without board updates.
- End-to-end tests cover a full AI chat flow that updates the board and reflects the changes in the UI.
- Regression tests confirm manual board interactions still work alongside the AI sidebar.

### Success criteria

- The sidebar feels integrated with the board rather than bolted on.
- AI responses are visible in chat and board updates appear automatically.
- The combined Kanban plus AI workflow is stable enough for MVP usage.