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

export const KanbanCard = ({ card, onUpdate, onDelete }: KanbanCardProps) => {
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
        "rounded-2xl border border-transparent bg-white px-4 py-4 shadow-[0_12px_24px_rgba(3,33,71,0.08)]",
        "transition-all duration-150",
        isDragging && "opacity-60 shadow-[0_18px_32px_rgba(3,33,71,0.16)]"
      )}
      {...(!isEditing ? attributes : {})}
      {...(!isEditing ? listeners : {})}
      data-testid={`card-${card.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
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
            <>
              <h4 className="font-display text-base font-semibold text-[var(--navy-dark)]">
                {card.title}
              </h4>
              <p className="mt-2 text-sm leading-6 text-[var(--gray-text)]">
                {card.details}
              </p>
            </>
          )}
        </div>
        <div className="flex shrink-0 items-start gap-2">
          {isEditing ? null : (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="rounded-full border border-transparent px-2 py-1 text-xs font-semibold text-[var(--gray-text)] transition hover:border-[var(--stroke)] hover:text-[var(--navy-dark)]"
              aria-label={`Edit ${card.title}`}
            >
              Edit
            </button>
          )}
          <button
            type="button"
            onClick={() => onDelete(card.id)}
            className="rounded-full border border-transparent px-2 py-1 text-xs font-semibold text-[var(--gray-text)] transition hover:border-[var(--stroke)] hover:text-[var(--navy-dark)]"
            aria-label={`Delete ${card.title}`}
          >
            Remove
          </button>
        </div>
      </div>
    </article>
  );
};
