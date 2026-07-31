import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App.jsx";

function jsonResponse(body) {
  return { ok: true, status: 200, json: async () => body };
}

describe("App feedback wiring", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse({ list: [], budget: 200, cadence: "Week" })
    );
  });

  it("posts a feedback action to the webhook with the typed message", async () => {
    const user = userEvent.setup();
    render(<App />);

    // Wait for the initial "get" call on mount to settle.
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("button", { name: /feedback/i }));
    await user.type(screen.getByPlaceholderText(/what's working/i), "Great app!");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    const [, requestInit] = fetch.mock.calls[1];
    expect(JSON.parse(requestInit.body)).toEqual({
      action: "feedback",
      message: "Great app!",
    });

    expect(await screen.findByText(/thanks — your feedback was sent/i)).toBeInTheDocument();
  });
});
