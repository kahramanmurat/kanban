import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AIChatSidebar } from "@/components/AIChatSidebar";
import { initialData } from "@/lib/kanban";
import type { AIChatResponse } from "@/lib/boardApi";

const createResponse = (
  overrides: Partial<AIChatResponse> = {}
): AIChatResponse => ({
  assistantMessage: "I left the board unchanged.",
  board: initialData,
  appliedOperations: [],
  ...overrides,
});

describe("AIChatSidebar", () => {
  it("submits a message, shows loading, and renders the assistant reply", async () => {
    let resolveResponse: ((value: AIChatResponse) => void) | undefined;
    const onSend = vi.fn(
      () =>
        new Promise<AIChatResponse>((resolve) => {
          resolveResponse = resolve;
        })
    );

    render(<AIChatSidebar onSend={onSend} />);

    await userEvent.type(
      screen.getByLabelText("Ask AI to update the board"),
      "Summarize the board"
    );
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(onSend).toHaveBeenCalledWith("Summarize the board", []);
    expect(screen.getByText("Thinking...")).toBeInTheDocument();
    expect(screen.getByText("Summarize the board")).toBeInTheDocument();

    resolveResponse?.(
      createResponse({
        assistantMessage: "The board has five columns and eight cards.",
      })
    );

    expect(
      await screen.findByText("The board has five columns and eight cards.")
    ).toBeInTheDocument();
    expect(screen.getByText("No board changes")).toBeInTheDocument();
  });

  it("shows how many board updates were applied", async () => {
    const onSend = vi.fn().mockResolvedValue(
      createResponse({
        assistantMessage: "I moved a card and added a follow-up task.",
        appliedOperations: [{ type: "move_card" }, { type: "add_card" }],
      })
    );

    render(<AIChatSidebar onSend={onSend} />);

    await userEvent.type(
      screen.getByLabelText("Ask AI to update the board"),
      "Update the board"
    );
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(
      await screen.findByText("I moved a card and added a follow-up task.")
    ).toBeInTheDocument();
    expect(screen.getByText("2 board updates applied")).toBeInTheDocument();
  });

  it("shows an inline error when the AI request fails", async () => {
    const onSend = vi.fn().mockRejectedValue(new Error("AI is temporarily unavailable."));

    render(<AIChatSidebar onSend={onSend} />);

    await userEvent.type(
      screen.getByLabelText("Ask AI to update the board"),
      "Try again later"
    );
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() =>
      expect(screen.getByText("AI is temporarily unavailable.")).toBeInTheDocument()
    );
    expect(screen.getByRole("log", { name: "AI conversation" })).not.toHaveTextContent(
      "Try again later"
    );
    expect(screen.getByLabelText("Ask AI to update the board")).toHaveValue("Try again later");
  });

  it("sends only the latest bounded chat history", async () => {
    const onSend = vi
      .fn()
      .mockResolvedValue(createResponse({ assistantMessage: "Done." }));

    render(<AIChatSidebar onSend={onSend} />);

    for (let index = 0; index < 13; index += 1) {
      await userEvent.clear(screen.getByLabelText("Ask AI to update the board"));
      await userEvent.type(screen.getByLabelText("Ask AI to update the board"), `Message ${index}`);
      await userEvent.click(screen.getByRole("button", { name: "Send" }));
      await waitFor(() => expect(onSend).toHaveBeenCalledTimes(index + 1));
    }

    await userEvent.clear(screen.getByLabelText("Ask AI to update the board"));
    await userEvent.type(screen.getByLabelText("Ask AI to update the board"), "Final message");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(14));

    const latestHistory = onSend.mock.calls.at(-1)?.[1];
    expect(latestHistory).toHaveLength(12);
    expect(latestHistory.some((message: { content: string }) => message.content === "Message 0")).toBe(
      false
    );
    expect(latestHistory.some((message: { content: string }) => message.content === "Message 12")).toBe(
      true
    );
  });
});
