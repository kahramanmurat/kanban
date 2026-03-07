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
    <aside className="rounded-2xl border border-[var(--stroke)] bg-white/80 p-4 shadow-[var(--shadow)] backdrop-blur xl:sticky xl:top-8">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--secondary-purple)]">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-white">
            <path fillRule="evenodd" d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 3.974 1 5.335v5.33c0 1.36.993 2.58 2.43 2.811 1.02.163 2.054.283 3.1.358a.25.25 0 0 1 .165.085l3.017 3.336a.75.75 0 0 0 1.288-.536v-2.769a.25.25 0 0 1 .23-.249c1.204-.084 2.39-.222 3.553-.41C16.007 13.245 17 12.025 17 10.665v-5.33c0-1.36-.993-2.58-2.43-2.811A41.584 41.584 0 0 0 10 2z" clipRule="evenodd" />
          </svg>
        </div>
        <h2 className="font-display text-base font-semibold text-[var(--navy-dark)]">
          Board Copilot
        </h2>
      </div>

      <div
        className="mt-3 flex min-h-[320px] flex-col gap-2.5 overflow-y-auto rounded-xl border border-[var(--stroke)] bg-[var(--surface)] p-3"
        role="log"
        aria-label="AI conversation"
      >
        {messages.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-[var(--stroke)] px-4 py-8 text-center">
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
                className={`max-w-[85%] rounded-xl px-3.5 py-2.5 shadow-sm ${
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
            <div className="max-w-[85%] rounded-xl border border-[var(--stroke)] bg-white px-3.5 py-2.5 text-sm leading-6 text-[var(--gray-text)] shadow-sm">
              Thinking...
            </div>
          </div>
        ) : null}
      </div>

      <form onSubmit={(event) => void handleSubmit(event)} className="mt-3">
        <label className="block">
          <span className="sr-only">Ask AI to update the board</span>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask the AI to update your board..."
            rows={2}
            className="w-full resize-none rounded-xl border border-[var(--stroke)] bg-white px-3.5 py-2.5 text-sm leading-6 text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
            aria-label="Ask AI to update the board"
          />
        </label>
        {error ? (
          <p className="mt-2 text-sm font-medium text-[var(--secondary-purple)]">{error}</p>
        ) : null}
        <div className="mt-2 flex items-center justify-end">
          <button
            type="submit"
            disabled={isSubmitting || !draft.trim()}
            className="flex items-center gap-1.5 rounded-full bg-[var(--secondary-purple)] px-4 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
              <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.155.75.75 0 0 0 0-1.114A28.897 28.897 0 0 0 3.105 2.288z" />
            </svg>
            Send
          </button>
        </div>
      </form>
    </aside>
  );
};
