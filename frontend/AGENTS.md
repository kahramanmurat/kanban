# Frontend Demo Overview

## Purpose

This `frontend/` directory contains the current frontend for the Project Management MVP. It is a statically exported Next.js application served by the FastAPI backend. It now includes the MVP login experience, backend-backed board persistence, and an AI chat sidebar for board operations.

## Current stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- `@dnd-kit` for drag and drop
- Vitest and Testing Library for unit and component tests
- Playwright for end-to-end tests

## Entry points

- `src/app/page.tsx` renders the `KanbanBoard` component at `/`.
- `src/app/login/page.tsx` renders the sign-in page at `/login`.
- `src/app/layout.tsx` defines the shared page shell and fonts.
- `src/app/globals.css` contains the global styles and design tokens.

## Main application structure

- `src/components/KanbanBoard.tsx`
  - Loads the board from the backend and updates local UI state from API responses.
  - Handles drag and drop, renaming columns, adding cards, deleting cards, and AI-triggered board refreshes.
- `src/components/AIChatSidebar.tsx`
  - Renders the sidebar chat UI, local message history, loading states, and AI request form.
- `src/components/KanbanColumn.tsx`
  - Renders a single column and its cards.
- `src/components/KanbanCard.tsx`
  - Renders an individual card.
- `src/components/KanbanCardPreview.tsx`
  - Renders the drag overlay preview.
- `src/components/LoginForm.tsx`
  - Handles sign-in requests to the backend login endpoint.
- `src/components/NewCardForm.tsx`
  - Handles adding a new card within a column.
- `src/components/LogoutButton.tsx`
  - Handles logging out through the backend logout endpoint.
- `src/lib/kanban.ts`
  - Defines the board types and drag-order helper logic shared by the frontend.
- `src/lib/boardApi.ts`
  - Wraps the backend board routes and AI board route used by the frontend.

## Current behavior

- Signed-out users see a login screen and must use the demo credentials.
- Signed-in users see a single Kanban board with five seeded columns.
- Users can rename columns inline.
- Users can add cards to a column.
- Users can delete cards.
- Users can drag cards within a column and across columns.
- Users can log out from the board header.
- Board changes are loaded from and saved through the backend API.
- Users can chat with the AI sidebar and see the board refresh when AI updates are applied.

## Important limitations

- The board still uses a simple client-side fetch-and-refresh approach rather than advanced optimistic syncing.
- Chat history is kept in frontend state for the current session instead of being persisted.

## Testing

- `src/lib/kanban.test.ts` covers the card movement helper logic.
- `src/components/KanbanBoard.test.tsx` covers key board interactions plus AI-driven board refreshes in component tests.
- `src/components/AIChatSidebar.test.tsx` covers chat rendering, input submission, loading state, and error handling.
- `src/components/LoginForm.test.tsx` and `src/components/LogoutButton.test.tsx` cover the auth UI actions.
- `tests/kanban.spec.ts` covers auth gating, sign-in, logout, persisted board changes, and the AI sidebar flow.

## Notes for future work

- Preserve the current visual design and interaction quality as backend features are introduced.
- When integrating the backend, prefer replacing local state initialization and mutation wiring incrementally rather than rewriting the board UI from scratch.
- Treat this directory as the source of truth for the existing user experience that later phases must preserve.
