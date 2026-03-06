import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, vi } from "vitest";
import { LogoutButton } from "@/components/LogoutButton";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LogoutButton", () => {
  it("posts to the logout endpoint and calls the success handler", async () => {
    const onLoggedOut = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });

    vi.stubGlobal("fetch", fetchMock);

    render(<LogoutButton onLoggedOut={onLoggedOut} />);

    await userEvent.click(screen.getByRole("button", { name: /log out/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/logout", {
        method: "POST",
        credentials: "same-origin",
        headers: { "X-Requested-With": "fetch" },
      })
    );
    await waitFor(() => expect(onLoggedOut).toHaveBeenCalled());
  });
});
