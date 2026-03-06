# Database Schema Proposal

## Goal

Use a simple relational SQLite schema that:

- supports the current single-board Kanban MVP
- supports multiple users later without redesign
- can reconstruct the current frontend board shape without losing information
- leaves small extension points for future features without storing the whole board as a JSON blob

## Recommendation

Use four main tables:

- `users`
- `boards`
- `columns`
- `cards`

Keep the board relational. Do not store the full board as one JSON document.

Use JSON only for small flexible fields where a schema migration would otherwise be unnecessary:

- `boards.settings_json`
- `cards.metadata_json`

This keeps the core model easy to query and update while still leaving room for future board settings or card metadata.

## Why not store the whole board as JSON?

The current frontend shape is:

- ordered columns
- ordered cards within each column
- card lookup by ID

That is easy to rebuild from relational rows. A full-board JSON blob would make common operations harder:

- rename one column
- move one card
- delete one card
- update one card title or details

Those actions would require rewriting the whole board document instead of updating one row or a few rows.

## Proposed tables

### `users`

Purpose:
- owns boards
- supports future multi-user expansion

Notes:
- for the MVP, seed a single row for username `user`
- current login remains hardcoded in application code for now
- this table is about ownership, not full auth management yet

Suggested columns:
- `id TEXT PRIMARY KEY`
- `username TEXT NOT NULL UNIQUE`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

### `boards`

Purpose:
- one logical board per user for the MVP
- future place for board-level settings

Notes:
- enforce one board per user with `UNIQUE(user_id)`

Suggested columns:
- `id TEXT PRIMARY KEY`
- `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`
- `name TEXT NOT NULL`
- `settings_json TEXT NOT NULL DEFAULT '{}'`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

Recommended constraint:
- `UNIQUE(user_id)`

### `columns`

Purpose:
- stores ordered board columns
- titles are editable, IDs remain stable

Notes:
- `position` controls render order
- keep stable IDs like `col-backlog` if desired so the current frontend shape maps cleanly

Suggested columns:
- `id TEXT PRIMARY KEY`
- `board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE`
- `title TEXT NOT NULL`
- `position INTEGER NOT NULL`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

Recommended constraint:
- `UNIQUE(board_id, position)`

### `cards`

Purpose:
- stores ordered cards within a column
- allows cards to move by changing `column_id` and `position`

Notes:
- `position` is relative to its current column
- `board_id` is intentionally stored as well, even though it is derivable through `column_id`
- keeping `board_id` makes common board queries simpler and lets the backend validate ownership more directly

Suggested columns:
- `id TEXT PRIMARY KEY`
- `board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE`
- `column_id TEXT NOT NULL REFERENCES columns(id) ON DELETE CASCADE`
- `title TEXT NOT NULL`
- `details TEXT NOT NULL DEFAULT ''`
- `position INTEGER NOT NULL`
- `metadata_json TEXT NOT NULL DEFAULT '{}'`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

Recommended constraint:
- `UNIQUE(column_id, position)`

## JSON field rationale

### `boards.settings_json`

Use this only for low-frequency, board-level settings that may evolve, such as:

- display preferences
- future AI board preferences
- non-critical board configuration

Do not store core board structure here.

### `cards.metadata_json`

Use this only for future card metadata that is not yet part of the MVP, such as:

- labels
- due dates
- assignee hints
- AI annotations

Do not store title, details, position, or column membership here.

## How this maps to the current frontend shape

The frontend currently expects:

- `columns: Column[]`
- `cards: Record<string, Card>`
- each column contains ordered `cardIds`

Reconstruction from the database is straightforward:

1. Read one board for the signed-in user.
2. Read columns ordered by `position`.
3. Read cards for that board ordered by `column_id`, then `position`.
4. Build:
   - `cards[card.id] = { id, title, details }`
   - `columns[i].cardIds = ordered list of card IDs in that column`

This preserves the current frontend data contract without storing the whole board as JSON.

## MVP initialization expectations

When the backend starts in Part 6:

- create the SQLite database file if it does not exist
- run `CREATE TABLE IF NOT EXISTS` statements
- enable foreign keys
- seed the MVP user row if missing
- seed one board for that user if missing
- seed the five default columns if missing
- seed the initial demo cards if the board is empty

The seeding logic should be idempotent so repeated startups do not duplicate data.

## Migration expectations

Keep migrations simple:

- start with one initial schema migration
- prefer additive changes for future fields
- only add new tables when a feature clearly needs them

At this stage, a lightweight migration approach is enough. There is no need to over-engineer migration tooling before the first persistent schema exists.

## Recommended indexes and constraints

- `users(username)` unique
- `boards(user_id)` unique
- `columns(board_id, position)` unique
- `cards(column_id, position)` unique
- index `cards(board_id)`
- index `columns(board_id)`

These are enough for the expected MVP access patterns.

## Draft SQLite DDL

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS boards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  settings_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS columns (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL,
  title TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (board_id, position),
  FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL,
  column_id TEXT NOT NULL,
  title TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (column_id, position),
  FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
  FOREIGN KEY (column_id) REFERENCES columns(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_columns_board_id ON columns(board_id);
CREATE INDEX IF NOT EXISTS idx_cards_board_id ON cards(board_id);
```

## Example MVP seed shape

- one `users` row for `user`
- one `boards` row for that user
- five `columns` rows with positions `0..4`
- eight `cards` rows, each attached to a column with per-column positions

## Deferred until later

These do not need to be part of the initial persistent schema:

- AI chat history tables
- audit/event tables
- attachments
- labels as first-class relational tables
- role or permission tables

Those can be added when real product needs appear.

## Proposed decision

Approve this relational schema for Parts 6 and 7:

- one seeded MVP user
- one board per user
- relational `columns` and `cards`
- small JSON extension points only on `boards` and `cards`

If approved, Part 6 can implement this schema directly.
