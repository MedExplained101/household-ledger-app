import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FeedbackButton from "./FeedbackButton.jsx";

describe("FeedbackButton", () => {
  it("is closed until the trigger is clicked", () => {
    render(<FeedbackButton onSubmit={vi.fn()} />);
    expect(screen.queryByPlaceholderText(/what's working/i)).not.toBeInTheDocument();
  });

  it("opens the form on click", async () => {
    const user = userEvent.setup();
    render(<FeedbackButton onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /feedback/i }));
    expect(screen.getByPlaceholderText(/what's working/i)).toBeInTheDocument();
  });

  it("rejects an empty submission without calling onSubmit", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<FeedbackButton onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /feedback/i }));
    await user.click(screen.getByRole("button", { name: /send/i }));
    expect(await screen.findByText(/enter some feedback/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("sends trimmed text and shows a confirmation on success", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<FeedbackButton onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /feedback/i }));
    await user.type(screen.getByPlaceholderText(/what's working/i), "  Love the app!  ");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("Love the app!"));
    expect(await screen.findByText(/thanks — your feedback was sent/i)).toBeInTheDocument();
  });

  it("shows an error message when onSubmit rejects", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    render(<FeedbackButton onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /feedback/i }));
    await user.type(screen.getByPlaceholderText(/what's working/i), "Broken button");
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText(/couldn't send feedback/i)).toBeInTheDocument();
  });

  it("closes and clears the message on cancel", async () => {
    const user = userEvent.setup();
    render(<FeedbackButton onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /feedback/i }));
    await user.type(screen.getByPlaceholderText(/what's working/i), "draft text");
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.queryByPlaceholderText(/what's working/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /feedback/i }));
    expect(screen.getByPlaceholderText(/what's working/i)).toHaveValue("");
  });
});
