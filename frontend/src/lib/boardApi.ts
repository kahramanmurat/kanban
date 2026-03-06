import type { BoardData } from "@/lib/kanban";

const toErrorMessage = (response: Response, fallback: string) => {
  if (response.status === 401) {
    return "Your session expired. Redirecting to login.";
  }

  return fallback;
};

const redirectToLogin = () => {
  window.location.assign("/login");
};

const requestBoard = async (
  input: RequestInfo | URL,
  init: RequestInit,
  fallbackMessage: string
): Promise<BoardData> => {
  const response = await fetch(input, {
    credentials: "same-origin",
    ...init,
  });

  if (response.status === 401) {
    redirectToLogin();
    throw new Error("Your session expired. Redirecting to login.");
  }

  if (!response.ok) {
    throw new Error(toErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as BoardData;
};

export const fetchBoard = () =>
  requestBoard("/api/board", { method: "GET" }, "Unable to load the board.");

export const renameColumn = (columnId: string, title: string) =>
  requestBoard(
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
  requestBoard(
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
  requestBoard(
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

export const deleteCard = (cardId: string) =>
  requestBoard(
    `/api/cards/${cardId}`,
    {
      method: "DELETE",
    },
    "Unable to delete the card."
  );
