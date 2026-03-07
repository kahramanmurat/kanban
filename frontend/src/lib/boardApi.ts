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

const toErrorMessage = (response: Response, fallback: string) => {
  if (response.status === 401) {
    return "Your session expired. Redirecting to login.";
  }

  return fallback;
};

const redirectToLogin = () => {
  window.location.assign("/login");
};

const readErrorMessage = async (response: Response, fallback: string) => {
  try {
    const payload = (await response.json()) as { detail?: unknown };
    if (typeof payload.detail === "string" && payload.detail.trim()) {
      return payload.detail;
    }
  } catch {}

  return toErrorMessage(response, fallback);
};

const requestJson = async <T>(
  input: RequestInfo | URL,
  init: RequestInit,
  fallbackMessage: string
): Promise<T> => {
  const response = await fetch(input, {
    credentials: "same-origin",
    ...init,
    headers: {
      "X-Requested-With": "fetch",
      ...init.headers,
    },
  });

  if (response.status === 401) {
    redirectToLogin();
    throw new Error("Your session expired. Redirecting to login.");
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as T;
};

export const fetchBoard = () =>
  requestJson<BoardData>("/api/board", { method: "GET" }, "Unable to load the board.");

export const renameColumn = (columnId: string, title: string) =>
  requestJson<BoardData>(
    `/api/columns/${columnId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title }),
    },
    "Unable to rename the column."
  );

export const addCard = (columnId: string, title: string, details: string) =>
  requestJson<BoardData>(
    `/api/columns/${columnId}/cards`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title, details }),
    },
    "Unable to add the card."
  );

export const moveCard = (cardId: string, columnId: string, position: number) =>
  requestJson<BoardData>(
    `/api/cards/${cardId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ columnId, position }),
    },
    "Unable to move the card."
  );

export const updateCard = (cardId: string, title: string, details: string) =>
  requestJson<BoardData>(
    `/api/cards/${cardId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title, details }),
    },
    "Unable to update the card."
  );

export const deleteCard = (cardId: string) =>
  requestJson<BoardData>(
    `/api/cards/${cardId}`,
    {
      method: "DELETE",
    },
    "Unable to delete the card."
  );

export const sendAiBoardMessage = (message: string, history: AIChatMessage[]) =>
  requestJson<AIChatResponse>(
    "/api/ai/board",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message, history }),
    },
    "Unable to contact the AI assistant."
  );
