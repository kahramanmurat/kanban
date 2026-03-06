import os
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path


APP_DIR = Path(__file__).resolve().parent
BACKEND_ROOT = APP_DIR.parent
DEFAULT_DATABASE_PATH = BACKEND_ROOT / "data" / "pm.sqlite3"

DEMO_USER_ID = "user-1"
DEMO_USERNAME = "user"
DEMO_BOARD_ID = "board-1"
DEMO_BOARD_NAME = "Kanban Studio"

INITIAL_COLUMNS = [
    {"id": "col-backlog", "title": "Backlog", "position": 0},
    {"id": "col-discovery", "title": "Discovery", "position": 1},
    {"id": "col-progress", "title": "In Progress", "position": 2},
    {"id": "col-review", "title": "Review", "position": 3},
    {"id": "col-done", "title": "Done", "position": 4},
]

INITIAL_CARDS = [
    {
        "id": "card-1",
        "column_id": "col-backlog",
        "position": 0,
        "title": "Align roadmap themes",
        "details": "Draft quarterly themes with impact statements and metrics.",
    },
    {
        "id": "card-2",
        "column_id": "col-backlog",
        "position": 1,
        "title": "Gather customer signals",
        "details": "Review support tags, sales notes, and churn feedback.",
    },
    {
        "id": "card-3",
        "column_id": "col-discovery",
        "position": 0,
        "title": "Prototype analytics view",
        "details": "Sketch initial dashboard layout and key drill-downs.",
    },
    {
        "id": "card-4",
        "column_id": "col-progress",
        "position": 0,
        "title": "Refine status language",
        "details": "Standardize column labels and tone across the board.",
    },
    {
        "id": "card-5",
        "column_id": "col-progress",
        "position": 1,
        "title": "Design card layout",
        "details": "Add hierarchy and spacing for scanning dense lists.",
    },
    {
        "id": "card-6",
        "column_id": "col-review",
        "position": 0,
        "title": "QA micro-interactions",
        "details": "Verify hover, focus, and loading states.",
    },
    {
        "id": "card-7",
        "column_id": "col-done",
        "position": 0,
        "title": "Ship marketing page",
        "details": "Final copy approved and asset pack delivered.",
    },
    {
        "id": "card-8",
        "column_id": "col-done",
        "position": 1,
        "title": "Close onboarding sprint",
        "details": "Document release notes and share internally.",
    },
]

SCHEMA_SQL = """
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
"""


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_id(prefix: str) -> str:
    return f"{prefix}-{time.time_ns():x}"


def get_database_path() -> str:
    return os.getenv("DATABASE_PATH", str(DEFAULT_DATABASE_PATH))


def connect(database_path: str | None = None) -> sqlite3.Connection:
    path = database_path or get_database_path()
    if path != ":memory:":
        Path(path).parent.mkdir(parents=True, exist_ok=True)

    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def initialize_database(database_path: str | None = None) -> None:
    with connect(database_path) as connection:
        connection.executescript(SCHEMA_SQL)
        seed_demo_data(connection)


def seed_demo_data(connection: sqlite3.Connection) -> None:
    timestamp = utc_now()

    connection.execute(
        """
        INSERT OR IGNORE INTO users (id, username, created_at, updated_at)
        VALUES (?, ?, ?, ?)
        """,
        (DEMO_USER_ID, DEMO_USERNAME, timestamp, timestamp),
    )

    connection.execute(
        """
        INSERT OR IGNORE INTO boards (id, user_id, name, settings_json, created_at, updated_at)
        VALUES (?, ?, ?, '{}', ?, ?)
        """,
        (DEMO_BOARD_ID, DEMO_USER_ID, DEMO_BOARD_NAME, timestamp, timestamp),
    )

    column_count = connection.execute(
        "SELECT COUNT(*) FROM columns WHERE board_id = ?",
        (DEMO_BOARD_ID,),
    ).fetchone()[0]
    if column_count == 0:
        connection.executemany(
            """
            INSERT INTO columns (id, board_id, title, position, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    column["id"],
                    DEMO_BOARD_ID,
                    column["title"],
                    column["position"],
                    timestamp,
                    timestamp,
                )
                for column in INITIAL_COLUMNS
            ],
        )

    card_count = connection.execute(
        "SELECT COUNT(*) FROM cards WHERE board_id = ?",
        (DEMO_BOARD_ID,),
    ).fetchone()[0]
    if card_count == 0:
        connection.executemany(
            """
            INSERT INTO cards (
                id,
                board_id,
                column_id,
                title,
                details,
                position,
                metadata_json,
                created_at,
                updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, '{}', ?, ?)
            """,
            [
                (
                    card["id"],
                    DEMO_BOARD_ID,
                    card["column_id"],
                    card["title"],
                    card["details"],
                    card["position"],
                    timestamp,
                    timestamp,
                )
                for card in INITIAL_CARDS
            ],
        )


def get_board_id_for_username(connection: sqlite3.Connection, username: str) -> str:
    row = connection.execute(
        """
        SELECT boards.id
        FROM boards
        JOIN users ON users.id = boards.user_id
        WHERE users.username = ?
        """,
        (username,),
    ).fetchone()

    if row is None:
        raise ValueError(f"No board found for username {username!r}.")

    return row["id"]


def serialize_board(connection: sqlite3.Connection, board_id: str) -> dict:
    columns = connection.execute(
        """
        SELECT id, title
        FROM columns
        WHERE board_id = ?
        ORDER BY position
        """,
        (board_id,),
    ).fetchall()

    cards = connection.execute(
        """
        SELECT id, column_id, title, details
        FROM cards
        WHERE board_id = ?
        ORDER BY column_id, position
        """,
        (board_id,),
    ).fetchall()

    cards_by_id: dict[str, dict[str, str]] = {}
    card_ids_by_column: dict[str, list[str]] = {column["id"]: [] for column in columns}

    for card in cards:
        card_id = card["id"]
        cards_by_id[card_id] = {
            "id": card_id,
            "title": card["title"],
            "details": card["details"],
        }
        card_ids_by_column.setdefault(card["column_id"], []).append(card_id)

    return {
        "columns": [
            {
                "id": column["id"],
                "title": column["title"],
                "cardIds": card_ids_by_column.get(column["id"], []),
            }
            for column in columns
        ],
        "cards": cards_by_id,
    }


def get_board_for_username(connection: sqlite3.Connection, username: str) -> dict:
    board_id = get_board_id_for_username(connection, username)
    return serialize_board(connection, board_id)


def require_column(connection: sqlite3.Connection, board_id: str, column_id: str) -> sqlite3.Row:
    row = connection.execute(
        """
        SELECT id, title, position
        FROM columns
        WHERE id = ? AND board_id = ?
        """,
        (column_id, board_id),
    ).fetchone()

    if row is None:
        raise ValueError(f"Column {column_id!r} was not found.")

    return row


def require_card(connection: sqlite3.Connection, board_id: str, card_id: str) -> sqlite3.Row:
    row = connection.execute(
        """
        SELECT id, board_id, column_id, title, details, position
        FROM cards
        WHERE id = ? AND board_id = ?
        """,
        (card_id, board_id),
    ).fetchone()

    if row is None:
        raise ValueError(f"Card {card_id!r} was not found.")

    return row


def list_card_ids(connection: sqlite3.Connection, column_id: str, exclude_card_id: str | None = None) -> list[str]:
    rows = connection.execute(
        """
        SELECT id
        FROM cards
        WHERE column_id = ?
        ORDER BY position
        """,
        (column_id,),
    ).fetchall()

    ids = [row["id"] for row in rows]
    if exclude_card_id is None:
        return ids

    return [card_id for card_id in ids if card_id != exclude_card_id]


def clamp_position(position: int | None, length: int) -> int:
    if position is None:
        return length
    return max(0, min(position, length))


def move_card_to_temporary_slot(
    connection: sqlite3.Connection,
    card_id: str,
    column_id: str,
    minimum_position: int,
) -> None:
    connection.execute(
        """
        UPDATE cards
        SET column_id = ?, position = ?, updated_at = ?
        WHERE id = ?
        """,
        (column_id, minimum_position, utc_now(), card_id),
    )


def resequence_column(connection: sqlite3.Connection, column_id: str, card_ids: list[str]) -> None:
    timestamp = utc_now()
    for index, card_id in enumerate(card_ids):
        connection.execute(
            """
            UPDATE cards
            SET column_id = ?, position = ?, updated_at = ?
            WHERE id = ?
            """,
            (column_id, -(index + 1), timestamp, card_id),
        )

    for index, card_id in enumerate(card_ids):
        connection.execute(
            """
            UPDATE cards
            SET column_id = ?, position = ?, updated_at = ?
            WHERE id = ?
            """,
            (column_id, index, timestamp, card_id),
        )


def rename_column(connection: sqlite3.Connection, username: str, column_id: str, title: str) -> dict:
    board_id = get_board_id_for_username(connection, username)
    require_column(connection, board_id, column_id)

    connection.execute(
        """
        UPDATE columns
        SET title = ?, updated_at = ?
        WHERE id = ?
        """,
        (title, utc_now(), column_id),
    )
    return serialize_board(connection, board_id)


def add_card(connection: sqlite3.Connection, username: str, column_id: str, title: str, details: str) -> dict:
    board_id = get_board_id_for_username(connection, username)
    require_column(connection, board_id, column_id)

    next_position = connection.execute(
        "SELECT COALESCE(MAX(position) + 1, 0) FROM cards WHERE column_id = ?",
        (column_id,),
    ).fetchone()[0]

    timestamp = utc_now()
    connection.execute(
        """
        INSERT INTO cards (
            id,
            board_id,
            column_id,
            title,
            details,
            position,
            metadata_json,
            created_at,
            updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, '{}', ?, ?)
        """,
        (create_id("card"), board_id, column_id, title, details or "", next_position, timestamp, timestamp),
    )
    return serialize_board(connection, board_id)


def update_card(
    connection: sqlite3.Connection,
    username: str,
    card_id: str,
    title: str | None,
    details: str | None,
    column_id: str | None,
    position: int | None,
) -> dict:
    board_id = get_board_id_for_username(connection, username)
    card = require_card(connection, board_id, card_id)

    target_column_id = column_id or card["column_id"]
    require_column(connection, board_id, target_column_id)

    if title is not None or details is not None:
        connection.execute(
            """
            UPDATE cards
            SET title = ?, details = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                title if title is not None else card["title"],
                details if details is not None else card["details"],
                utc_now(),
                card_id,
            ),
        )

    if column_id is not None or position is not None:
        source_column_id = card["column_id"]
        remaining_source_cards = list_card_ids(
            connection,
            source_column_id,
            exclude_card_id=card_id,
        )

        if target_column_id == source_column_id:
            reordered_cards = remaining_source_cards
            insert_at = clamp_position(position, len(reordered_cards))
            reordered_cards.insert(insert_at, card_id)
            resequence_column(connection, target_column_id, reordered_cards)
        else:
            target_cards = list_card_ids(connection, target_column_id)
            insert_at = clamp_position(position, len(target_cards))
            target_cards.insert(insert_at, card_id)
            move_card_to_temporary_slot(
                connection,
                card_id,
                target_column_id,
                -(len(target_cards) + 1),
            )
            resequence_column(connection, source_column_id, remaining_source_cards)
            resequence_column(connection, target_column_id, target_cards)

    return serialize_board(connection, board_id)


def delete_card(connection: sqlite3.Connection, username: str, card_id: str) -> dict:
    board_id = get_board_id_for_username(connection, username)
    card = require_card(connection, board_id, card_id)
    source_column_id = card["column_id"]

    connection.execute("DELETE FROM cards WHERE id = ?", (card_id,))

    resequence_column(connection, source_column_id, list_card_ids(connection, source_column_id))
    return serialize_board(connection, board_id)
