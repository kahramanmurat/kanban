import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import { useEffect, useState, type FormEvent } from "react";
import type { Card } from "@/lib/kanban";

type KanbanCardProps = {
  card: Card;
  onUpdate: (cardId: string, title: string, details: string) => void;
  onDelete: (cardId: string) => void;
};

export function KanbanCard({ card, onUpdate, onDelete }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(card.title);
  const [draftDetails, setDraftDetails] = useState(card.details);

  useEffect(() => {
    setDraftTitle(card.title);
    setDraftDetails(card.details);
  }, [card.details, card.id, card.title]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextTitle = draftTitle.trim();
    if (!nextTitle) {
      return;
    }

    if (nextTitle !== card.title || draftDetails !== card.details) {
      onUpdate(card.id, nextTitle, draftDetails);
    }

    setIsEditing(false);
  };

  const handleCancel = () => {
    setDraftTitle(card.title);
    setDraftDetails(card.details);
    setIsEditing(false);
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={clsx(
        "group/card rounded-2xl border border-transparent bg-white px-4 py-3 shadow-[0_12px_24px_rgba(3,33,71,0.08)]",
        "transition-all duration-150",
        isDragging && "opacity-60 shadow-[0_18px_32px_rgba(3,33,71,0.16)]"
      )}
      {...(!isEditing ? attributes : {})}
      {...(!isEditing ? listeners : {})}
      data-testid={`card-${card.id}`}
    >
      {isEditing ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            aria-label={`Edit title for ${card.title}`}
            maxLength={500}
            className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-semibold text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
            required
          />
          <textarea
            value={draftDetails}
            onChange={(event) => setDraftDetails(event.target.value)}
            aria-label={`Edit details for ${card.title}`}
            maxLength={5000}
            rows={3}
            className="w-full resize-none rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm leading-6 text-[var(--gray-text)] outline-none transition focus:border-[var(--primary-blue)]"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              className="rounded-full bg-[var(--secondary-purple)] px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110"
            >
              Save
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-full border border-[var(--stroke)] px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="font-display text-sm font-semibold leading-snug text-[var(--navy-dark)]">
              {card.title}
            </h4>
            {card.details ? (
              <p className="mt-1.5 text-xs leading-5 text-[var(--gray-text)]">
                {card.details}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/card:opacity-100">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="rounded-lg p-1.5 text-[var(--gray-text)] transition hover:bg-[var(--surface)] hover:text-[var(--navy-dark)]"
              aria-label={`Edit ${card.title}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M2.695 14.763l-1.262 3.154a.5.5 0 0 0 .65.65l3.155-1.262a4 4 0 0 0 1.343-.885L17.5 5.5a2.121 2.121 0 0 0-3-3L3.58 13.42a4 4 0 0 0-.885 1.343z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => onDelete(card.id)}
              className="rounded-lg p-1.5 text-[var(--gray-text)] transition hover:bg-red-50 hover:text-red-500"
              aria-label={`Delete ${card.title}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 0 1 .7.8l-.5 5.5a.75.75 0 0 1-1.495-.137l.5-5.5a.75.75 0 0 1 .795-.662zm2.84 0a.75.75 0 0 1 .795.662l.5 5.5a.75.75 0 1 1-1.495.136l-.5-5.5a.75.75 0 0 1 .7-.798z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
