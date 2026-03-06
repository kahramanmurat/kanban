# Frontend Demo Overview

## Purpose

This `frontend/` directory contains the current frontend for the Project Management MVP. It is a statically exported Next.js application served by the FastAPI backend. It now includes the MVP login experience, but it still has no persistence and no AI features yet.

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
  - Owns the board state in React state.
  - Handles drag and drop, renaming columns, adding cards, and deleting cards.
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
  - Defines the board types, seeded demo data, card movement helper, and ID creation helper.

## Current behavior

- Signed-out users see a login screen and must use the demo credentials.
- Signed-in users see a single Kanban board with five seeded columns.
- Users can rename columns inline.
- Users can add cards to a column.
- Users can delete cards.
- Users can drag cards within a column and across columns.
- Users can log out from the board header.
- Authentication is backend-enforced, but all board data is still local to the browser session.

## Important limitations

- The board state is initialized from in-memory demo data.
- Refreshing the page resets the board to its seeded state.
- The only backend integration so far is the login/logout/session gate.
- There is no database persistence.
- There is no AI sidebar or AI-driven board update flow.

## Testing

- `src/lib/kanban.test.ts` covers the card movement helper logic.
- `src/components/KanbanBoard.test.tsx` covers key board interactions in component tests.
- `src/components/LoginForm.test.tsx` and `src/components/LogoutButton.test.tsx` cover the auth UI actions.
- `tests/kanban.spec.ts` covers auth gating, sign-in, logout, and a signed-in board interaction flow through the backend-served app.

## Notes for future work

- Preserve the current visual design and interaction quality as backend features are introduced.
- When integrating the backend, prefer replacing local state initialization and mutation wiring incrementally rather than rewriting the board UI from scratch.
- Treat this directory as the source of truth for the existing user experience that later phases must preserve.
