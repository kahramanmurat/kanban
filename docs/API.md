# Backend API

## Authentication

All Kanban data routes require the session cookie set by:

- `POST /api/login`
- `POST /api/logout`

For the MVP, the valid credentials are:

- username: `user`
- password: `password`

## Routes

### `GET /api/health`

Returns a simple health payload.

Example response:

```json
{
  "status": "ok",
  "message": "Hello from FastAPI"
}
```

### `POST /api/login`

Signs the user in and sets the session cookie.

Request body:

```json
{
  "username": "user",
  "password": "password"
}
```

### `POST /api/logout`

Clears the session cookie.

### `GET /api/board`

Returns the current signed-in user's board in the same shape expected by the frontend.

Example response shape:

```json
{
  "columns": [
    {
      "id": "col-backlog",
      "title": "Backlog",
      "cardIds": ["card-1", "card-2"]
    }
  ],
  "cards": {
    "card-1": {
      "id": "card-1",
      "title": "Align roadmap themes",
      "details": "Draft quarterly themes with impact statements and metrics."
    }
  }
}
```

### `PATCH /api/columns/{column_id}`

Renames a column and returns the full board.

Request body:

```json
{
  "title": "Ideas"
}
```

### `POST /api/columns/{column_id}/cards`

Creates a card at the end of the specified column and returns the full board.

Request body:

```json
{
  "title": "New card",
  "details": "Optional details"
}
```

### `PATCH /api/cards/{card_id}`

Updates a card and returns the full board.

Supported fields:

- `title`
- `details`
- `columnId`
- `position`

Example request:

```json
{
  "title": "Updated card",
  "details": "Revised details",
  "columnId": "col-review",
  "position": 0
}
```

Notes:

- if `columnId` changes and `position` is omitted, the card is appended to the target column
- if only `position` is provided, the card is reordered within its current column

### `DELETE /api/cards/{card_id}`

Deletes the card and returns the full board.

## Error behavior

- unauthenticated board requests return `401`
- unknown column or card IDs return `404`
- invalid login credentials return `401`
