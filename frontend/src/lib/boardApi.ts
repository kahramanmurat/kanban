import type { BoardData } from "@/lib/kanban";

export type AIChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AIChatOperation = {
  type: string;
} & Record<string, unknown>;

export type AIChatResponse = {
  assistantMessage: string;
  board: BoardData;
  appliedOperations: AIChatOperation[];
};

const JSON_HEADERS = {
  "Content-Type": "application/json",
};

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: unknown };
    if (typeof payload.detail === "string" && payload.detail.trim()) {
      return payload.detail;
    }
  } catch {}

  if (response.status === 401) {
    return "Your session expired. Redirecting to login.";
  }

  return fallback;
}

async function requestJson<T>(
  input: RequestInfo | URL,
  init: RequestInit,
  fallbackMessage: string
): Promise<T> {
  const response = await fetch(input, {
    credentials: "same-origin",
    ...init,
    headers: {
      "X-Requested-With": "fetch",
      ...init.headers,
    },
  });

  if (response.status === 401) {
    window.location.assign("/login");
    throw new Error("Your session expired. Redirecting to login.");
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as T;
}

export function fetchBoard(): Promise<BoardData> {
  return requestJson<BoardData>("/api/board", { method: "GET" }, "Unable to load the board.");
}

export function renameColumn(columnId: string, title: string): Promise<BoardData> {
  return requestJson<BoardData>(
    `/api/columns/${columnId}`,
    {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify({ title }),
    },
    "Unable to rename the column."
  );
}

export function addCard(columnId: string, title: string, details: string): Promise<BoardData> {
  return requestJson<BoardData>(
    `/api/columns/${columnId}/cards`,
    {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ title, details }),
    },
    "Unable to add the card."
  );
}

export function moveCard(cardId: string, columnId: string, position: number): Promise<BoardData> {
  return requestJson<BoardData>(
    `/api/cards/${cardId}`,
    {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify({ columnId, position }),
    },
    "Unable to move the card."
  );
}

export function updateCard(cardId: string, title: string, details: string): Promise<BoardData> {
  return requestJson<BoardData>(
    `/api/cards/${cardId}`,
    {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify({ title, details }),
    },
    "Unable to update the card."
  );
}

export function deleteCard(cardId: string): Promise<BoardData> {
  return requestJson<BoardData>(
    `/api/cards/${cardId}`,
    {
      method: "DELETE",
    },
    "Unable to delete the card."
  );
}

export function sendAiBoardMessage(message: string, history: AIChatMessage[]): Promise<AIChatResponse> {
  return requestJson<AIChatResponse>(
    "/api/ai/board",
    {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ message, history }),
    },
    "Unable to contact the AI assistant."
  );
}
