import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, vi } from "vitest";
import { KanbanBoard } from "@/components/KanbanBoard";
import { initialData, type BoardData } from "@/lib/kanban";

const cloneBoard = (board: BoardData): BoardData => structuredClone(board);

const createResponse = (board: BoardData) => ({
  ok: true,
  status: 200,
  json: async () => board,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("KanbanBoard", () => {
  it("renders five columns from the backend board", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(createResponse(cloneBoard(initialData)))
    );

    render(<KanbanBoard />);

    expect(await screen.findAllByTestId(/column-/i)).toHaveLength(5);
  });

  it("renames a column through the backend API", async () => {
    const renamedBoard = cloneBoard(initialData);
    renamedBoard.columns[0].title = "New Name";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createResponse(cloneBoard(initialData)))
      .mockResolvedValueOnce(createResponse(renamedBoard));

    vi.stubGlobal("fetch", fetchMock);

    render(<KanbanBoard />);

    const column = (await screen.findAllByTestId(/column-/i))[0];
    const input = within(column).getByLabelText("Column title");

    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    await userEvent.tab();

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        "/api/columns/col-backlog",
        expect.objectContaining({
          method: "PATCH",
          credentials: "same-origin",
        })
      )
    );
    await waitFor(() => expect(input).toHaveValue("New Name"));
  });

  it("adds and removes a card through the backend API", async () => {
    const boardWithNewCard = cloneBoard(initialData);
    boardWithNewCard.cards["card-new"] = {
      id: "card-new",
      title: "New card",
      details: "Notes",
    };
    boardWithNewCard.columns[0].cardIds.push("card-new");

    const boardWithoutNewCard = cloneBoard(initialData);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createResponse(cloneBoard(initialData)))
      .mockResolvedValueOnce(createResponse(boardWithNewCard))
      .mockResolvedValueOnce(createResponse(boardWithoutNewCard));

    vi.stubGlobal("fetch", fetchMock);

    render(<KanbanBoard />);

    const column = (await screen.findAllByTestId(/column-/i))[0];
    const addButton = within(column).getByRole("button", {
      name: /add a card/i,
    });
    await userEvent.click(addButton);

    const titleInput = within(column).getByPlaceholderText(/card title/i);
    await userEvent.type(titleInput, "New card");
    const detailsInput = within(column).getByPlaceholderText(/details/i);
    await userEvent.type(detailsInput, "Notes");

    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    expect(await within(column).findByText("New card")).toBeInTheDocument();

    const deleteButton = within(column).getByRole("button", {
      name: /delete new card/i,
    });
    await userEvent.click(deleteButton);

    await waitFor(() =>
      expect(within(column).queryByText("New card")).not.toBeInTheDocument()
    );
  });
});
