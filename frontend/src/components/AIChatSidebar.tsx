"use client";

import { useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
import type { AIChatMessage, AIChatResponse } from "@/lib/boardApi";

type ChatEntry = AIChatMessage & {
  id: string;
  appliedOperationCount?: number;
};

type AIChatSidebarProps = {
  onSend: (message: string, history: AIChatMessage[]) => Promise<AIChatResponse>;
};

const MAX_CHAT_HISTORY_MESSAGES = 12;

const createMessageId = () =>
  `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const trimMessages = (messages: ChatEntry[]) =>
  messages.slice(-MAX_CHAT_HISTORY_MESSAGES);

const formatOperationSummary = (count: number) => {
  if (count === 0) {
    return "No board changes";
  }

  return count === 1 ? "1 board update applied" : `${count} board updates applied`;
};

export const AIChatSidebar = ({ onSend }: AIChatSidebarProps) => {
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [draft, setDraft] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const messageHistory = useMemo<AIChatMessage[]>(
    () =>
      trimMessages(messages).map(({ role, content }) => ({ role, content })),
    [messages]
  );

  const handleSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();

    const trimmedMessage = draft.trim();
    if (!trimmedMessage || isSubmitting) {
      return;
    }

    const userMessage: ChatEntry = {
      id: createMessageId(),
      role: "user",
      content: trimmedMessage,
    };

    setMessages((prev) => trimMessages([...prev, userMessage]));
    setDraft("");
    setError("");
    setIsSubmitting(true);

    try {
      const response = await onSend(trimmedMessage, messageHistory);
      const assistantMessage: ChatEntry = {
        id: createMessageId(),
        role: "assistant",
        content: response.assistantMessage,
        appliedOperationCount: response.appliedOperations.length,
      };
      setMessages((prev) => trimMessages([...trimMessages(prev), assistantMessage]));
    } catch (nextError) {
      setMessages((prev) => prev.filter((message) => message.id != userMessage.id));
      setDraft(trimmedMessage);
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to contact the AI assistant."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit();
    }
  };

  return (
    <aside className="rounded-[28px] border border-[var(--stroke)] bg-white/80 p-5 shadow-[var(--shadow)] backdrop-blur xl:sticky xl:top-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
            AI Sidebar
          </p>
          <h2 className="mt-3 font-display text-[1.35rem] font-semibold text-[var(--navy-dark)]">
            Board Copilot
          </h2>
        </div>
        <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-3 py-2.5 text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
            Mode
          </p>
          <p className="mt-2 text-sm font-semibold text-[var(--secondary-purple)]">
            Chat + board updates
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-[var(--gray-text)]">
        Ask for summaries, card edits, or board moves. The assistant replies in chat
        and refreshes the board when it applies updates.
      </p>

      <div
        className="mt-5 flex min-h-[320px] flex-col gap-3 overflow-y-auto rounded-[24px] border border-[var(--stroke)] bg-[var(--surface)] p-3.5"
        role="log"
        aria-label="AI conversation"
      >
        {messages.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-[24px] border border-dashed border-[var(--stroke)] px-5 py-10 text-center">
            <p className="max-w-xs text-sm leading-6 text-[var(--gray-text)]">
              Start with something like “summarize the board” or “move the QA card
              to Done and add a follow-up task.”
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-[24px] px-4 py-3 shadow-sm ${
                  message.role === "user"
                    ? "bg-[var(--secondary-purple)] text-white"
                    : "border border-[var(--stroke)] bg-white text-[var(--navy-dark)]"
                }`}
              >
                <p className="text-sm leading-6">{message.content}</p>
                {message.role === "assistant" ? (
                  <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
                    {formatOperationSummary(message.appliedOperationCount ?? 0)}
                  </p>
                ) : null}
              </div>
            </div>
          ))
        )}
        {isSubmitting ? (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-[24px] border border-[var(--stroke)] bg-white px-4 py-3 text-sm leading-6 text-[var(--gray-text)] shadow-sm">
              Thinking...
            </div>
          </div>
        ) : null}
      </div>

      <form onSubmit={(event) => void handleSubmit(event)} className="mt-4 space-y-3">
        <label className="block">
          <span className="sr-only">Ask AI to update the board</span>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask the AI to summarize, create, move, edit, or delete cards..."
            rows={3}
            className="w-full resize-none rounded-2xl border border-[var(--stroke)] bg-white px-4 py-3 text-sm leading-6 text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
            aria-label="Ask AI to update the board"
          />
        </label>
        {error ? (
          <p className="text-sm font-medium text-[var(--secondary-purple)]">{error}</p>
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
            {isSubmitting ? "Waiting for AI" : "Ready for requests"}
          </p>
          <button
            type="submit"
            disabled={isSubmitting || !draft.trim()}
            className="rounded-full bg-[var(--secondary-purple)] px-5 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Send
          </button>
        </div>
      </form>
    </aside>
  );
};
