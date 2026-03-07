import json
from dataclasses import asdict, dataclass
from typing import Annotated, Any, Literal

from openai import (
    APIConnectionError,
    APIError,
    APITimeoutError,
    AuthenticationError,
    OpenAI,
)
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

from app.db import (
    add_card,
    delete_card,
    get_board_for_username,
    rename_column,
    update_card,
)
from app.settings import Settings, get_settings


CONNECTIVITY_PROMPT = "What is 2 + 2? Reply with digits only."
MAX_CONVERSATION_MESSAGES = 12
MAX_CHAT_MESSAGE_LENGTH = 2000
BOARD_SYSTEM_PROMPT = """You are an assistant that helps update a Kanban board.

Return valid JSON only. Do not include markdown fences.
Use exactly two top-level keys:
- assistantMessage: a non-empty string for the user
- boardChange: null or an object with an operations array

Allowed operation types:
- rename_column: requires columnId and title
- add_card: requires columnId, title, and details
- update_card: requires cardId and at least one of title or details
- move_card: requires cardId, columnId, and zero-based position
- delete_card: requires cardId

Rules:
- Never return a full replacement board.
- Only reference existing column and card IDs from the provided board.
- Use update_card only for title/details edits.
- Use move_card only for moving a card.
- If no board change is needed, set boardChange to null.
"""
MAX_TITLE_LENGTH = 500
MAX_DETAILS_LENGTH = 5000


class AIConfigurationError(RuntimeError):
    pass


class AIConnectivityError(RuntimeError):
    pass


class AIResponseFormatError(RuntimeError):
    pass


class AIBoardOperationError(RuntimeError):
    pass


@dataclass(frozen=True)
class AIConnectivityResult:
    model: str
    prompt: str
    response: str


class ConversationMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=MAX_CHAT_MESSAGE_LENGTH)


class AIBoardRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(min_length=1, max_length=MAX_CHAT_MESSAGE_LENGTH)
    history: list[ConversationMessage] = Field(
        default_factory=list, max_length=MAX_CONVERSATION_MESSAGES
    )


class RenameColumnOperation(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    type: Literal["rename_column"]
    column_id: str = Field(alias="columnId", min_length=1)
    title: str = Field(min_length=1, max_length=MAX_TITLE_LENGTH)


class AddCardOperation(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    type: Literal["add_card"]
    column_id: str = Field(alias="columnId", min_length=1)
    title: str = Field(min_length=1, max_length=MAX_TITLE_LENGTH)
    details: str = Field(default="", max_length=MAX_DETAILS_LENGTH)


class UpdateCardOperation(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    type: Literal["update_card"]
    card_id: str = Field(alias="cardId", min_length=1)
    title: str | None = Field(default=None, min_length=1, max_length=MAX_TITLE_LENGTH)
    details: str | None = Field(default=None, max_length=MAX_DETAILS_LENGTH)

    @model_validator(mode="after")
    def validate_fields(self) -> "UpdateCardOperation":
        if self.title is None and self.details is None:
            raise ValueError("update_card requires title and/or details.")
        return self


class MoveCardOperation(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    type: Literal["move_card"]
    card_id: str = Field(alias="cardId", min_length=1)
    column_id: str = Field(alias="columnId", min_length=1)
    position: int = Field(ge=0)


class DeleteCardOperation(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    type: Literal["delete_card"]
    card_id: str = Field(alias="cardId", min_length=1)


BoardOperation = Annotated[
    RenameColumnOperation
    | AddCardOperation
    | UpdateCardOperation
    | MoveCardOperation
    | DeleteCardOperation,
    Field(discriminator="type"),
]


class BoardChange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    operations: list[BoardOperation] = Field(default_factory=list)


class AIBoardModelResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    assistant_message: str = Field(alias="assistantMessage", min_length=1)
    board_change: BoardChange | None = Field(alias="boardChange")


def create_openai_client(api_key: str) -> OpenAI:
    return OpenAI(api_key=api_key, timeout=30.0)


def call_openai_text_response(client: OpenAI, model: str, prompt: str) -> str:
    try:
        result = client.responses.create(model=model, input=prompt)
    except (
        APIConnectionError,
        APIError,
        APITimeoutError,
        AuthenticationError,
    ) as error:
        message = getattr(error, "message", str(error))
        raise AIConnectivityError(f"OpenAI request failed: {message}") from error

    response_text = result.output_text.strip()
    if not response_text:
        raise AIConnectivityError("OpenAI returned an empty response.")

    return response_text


def run_connectivity_check(
    client: OpenAI,
    model: str,
    prompt: str = CONNECTIVITY_PROMPT,
) -> AIConnectivityResult:
    response_text = call_openai_text_response(client, model, prompt)
    return AIConnectivityResult(model=model, prompt=prompt, response=response_text)


def check_openai_connectivity(settings: Settings | None = None) -> dict[str, str]:
    current_settings = settings or get_settings()

    if not current_settings.openai_api_key:
        raise AIConfigurationError(
            "OPENAI_API_KEY is not configured. Add it to the environment or project root .env file."
        )

    client = create_openai_client(current_settings.openai_api_key)
    return asdict(run_connectivity_check(client, current_settings.openai_model))


def build_board_prompt(
    board: dict[str, Any], message: str, history: list[ConversationMessage]
) -> str:
    history_payload = [
        entry.model_dump() for entry in history[-MAX_CONVERSATION_MESSAGES:]
    ]
    return (
        f"{BOARD_SYSTEM_PROMPT}\n"
        f"Current board JSON:\n{json.dumps(board, indent=2, sort_keys=True)}\n\n"
        f"Conversation history JSON:\n{json.dumps(history_payload, indent=2)}\n\n"
        f"Latest user message:\n{json.dumps(message)}\n"
    )


def parse_board_response(response_text: str) -> AIBoardModelResponse:
    try:
        payload = json.loads(response_text)
    except json.JSONDecodeError as error:
        raise AIResponseFormatError("AI returned invalid JSON.") from error

    try:
        return AIBoardModelResponse.model_validate(payload)
    except ValidationError as error:
        raise AIResponseFormatError(
            "AI returned an invalid board operation payload."
        ) from error


def request_board_response(
    client: OpenAI,
    model: str,
    board: dict[str, Any],
    message: str,
    history: list[ConversationMessage],
) -> AIBoardModelResponse:
    prompt = build_board_prompt(board, message, history)
    response_text = call_openai_text_response(client, model, prompt)
    return parse_board_response(response_text)


def apply_board_operations(
    connection, username: str, board_change: BoardChange | None
) -> tuple[dict, list[dict]]:
    if board_change is None:
        return get_board_for_username(connection, username), []

    board = get_board_for_username(connection, username)
    applied_operations: list[dict] = []

    try:
        for operation in board_change.operations:
            if isinstance(operation, RenameColumnOperation):
                board = rename_column(
                    connection, username, operation.column_id, operation.title
                )
            elif isinstance(operation, AddCardOperation):
                board = add_card(
                    connection,
                    username,
                    operation.column_id,
                    operation.title,
                    operation.details,
                )
            elif isinstance(operation, UpdateCardOperation):
                board = update_card(
                    connection,
                    username,
                    operation.card_id,
                    operation.title,
                    operation.details,
                    None,
                    None,
                )
            elif isinstance(operation, MoveCardOperation):
                board = update_card(
                    connection,
                    username,
                    operation.card_id,
                    None,
                    None,
                    operation.column_id,
                    operation.position,
                )
            elif isinstance(operation, DeleteCardOperation):
                board = delete_card(connection, username, operation.card_id)

            applied_operations.append(
                operation.model_dump(by_alias=True, exclude_none=True)
            )
    except ValueError as error:
        raise AIBoardOperationError(str(error)) from error

    return board, applied_operations


def run_board_assistant_turn(
    connection, username: str, payload: AIBoardRequest
) -> dict[str, Any]:
    settings = get_settings()
    if not settings.openai_api_key:
        raise AIConfigurationError(
            "OPENAI_API_KEY is not configured. Add it to the environment or project root .env file."
        )

    client = create_openai_client(settings.openai_api_key)
    board = get_board_for_username(connection, username)
    model_response = request_board_response(
        client,
        settings.openai_model,
        board,
        payload.message,
        payload.history,
    )
    next_board, applied_operations = apply_board_operations(
        connection,
        username,
        model_response.board_change,
    )
    return {
        "assistantMessage": model_response.assistant_message,
        "board": next_board,
        "appliedOperations": applied_operations,
    }
