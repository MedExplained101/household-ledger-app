import { useState } from "react";
import { MessageSquarePlus, X } from "lucide-react";

/**
 * A small header button that opens a popover for the user to send free-text
 * feedback. `onSubmit` does the actual network call and should throw/reject
 * on failure; this component only owns the open/sending/sent/error UI state.
 */
export default function FeedbackButton({ onSubmit }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [validationError, setValidationError] = useState(null);

  function close() {
    setOpen(false);
    setMessage("");
    setStatus("idle");
    setValidationError(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) {
      setValidationError("Please enter some feedback before sending.");
      return;
    }
    setValidationError(null);
    setStatus("sending");
    try {
      await onSubmit(trimmed);
      setStatus("sent");
      setMessage("");
    } catch (e) {
      setStatus("error");
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1 text-xs uppercase tracking-widest text-[#5B5545] border border-[#D8CFB8] rounded-sm px-2 py-1 hover:bg-[#F0EADA]"
      >
        <MessageSquarePlus size={12} /> Feedback
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 border border-[#1F2A1E] bg-white shadow-md z-10 p-3 text-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-widest text-[#8A836B]">
              Send feedback
            </span>
            <button
              type="button"
              onClick={close}
              aria-label="Close feedback form"
              className="text-[#8A836B] hover:text-[#B23A2E]"
            >
              <X size={14} />
            </button>
          </div>

          {status === "sent" ? (
            <div>
              <p className="text-[#3B6142]">Thanks — your feedback was sent.</p>
              <button
                type="button"
                onClick={close}
                className="mt-2 text-xs px-2 py-1 border border-[#D8CFB8] rounded-sm hover:bg-[#F0EADA]"
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What's working, what isn't..."
                rows={3}
                className="w-full border border-[#D8CFB8] rounded-sm px-2 py-1 outline-none focus:border-[#3B6142]"
              />
              {validationError && (
                <p className="text-[#B23A2E] text-xs mt-1">{validationError}</p>
              )}
              {status === "error" && (
                <p className="text-[#B23A2E] text-xs mt-1">
                  Couldn't send feedback — try again.
                </p>
              )}
              <div className="flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={close}
                  className="text-xs px-2 py-1 border border-[#D8CFB8] rounded-sm hover:bg-[#F0EADA]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="text-xs px-2 py-1 bg-[#3B6142] text-[#FBF7EE] rounded-sm hover:bg-[#2E4C34] disabled:opacity-60"
                >
                  {status === "sending" ? "Sending…" : "Send"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
