"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  pointerWithin,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { AIChatSidebar } from "@/components/AIChatSidebar";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { LogoutButton } from "@/components/LogoutButton";
import { moveCard as moveCardColumns, type BoardData } from "@/lib/kanban";
import {
  type AIChatMessage,
  type AIChatResponse,
  addCard,
  deleteCard,
  fetchBoard,
  moveCard,
  renameColumn,
  sendAiBoardMessage,
} from "@/lib/boardApi";

export const KanbanBoard = () => {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const cardsById = useMemo(() => board?.cards ?? {}, [board]);

  const loadBoard = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      setBoard(await fetchBoard());
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Unable to load the board."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  const runMutation = async (mutate: () => Promise<BoardData>) => {
    setIsSaving(true);
    setError("");

    try {
      setBoard(await mutate());
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Unable to save your changes."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (!board) {
      setActiveCardId(null);
      return;
    }

    const { active, over } = event;
    setActiveCardId(null);

    if (!over || active.id === over.id) {
      return;
    }

    const nextColumns = moveCardColumns(
      board.columns,
      active.id as string,
      over.id as string
    );
    const destinationColumn = nextColumns.find((column) =>
      column.cardIds.includes(active.id as string)
    );

    if (!destinationColumn) {
      return;
    }

    const nextPosition = destinationColumn.cardIds.indexOf(active.id as string);

    void runMutation(() =>
      moveCard(active.id as string, destinationColumn.id, nextPosition)
    );
  };

  const handleRenameColumn = (columnId: string, title: string) => {
    if (!board) {
      return;
    }

    void runMutation(() => renameColumn(columnId, title));
  };

  const handleAddCard = (columnId: string, title: string, details: string) => {
    if (!board) {
      return;
    }

    void runMutation(() => addCard(columnId, title, details));
  };

  const handleDeleteCard = (_columnId: string, cardId: string) => {
    if (!board) {
      return;
    }

    void runMutation(() => deleteCard(cardId));
  };

  const handleSendAiMessage = async (
    message: string,
    history: AIChatMessage[]
  ): Promise<AIChatResponse> => {
    if (!board) {
      throw new Error("The board is still loading.");
    }

    setIsSaving(true);

    try {
      const response = await sendAiBoardMessage(message, history);
      setBoard(response.board);
      return response;
    } finally {
      setIsSaving(false);
    }
  };

  const activeCard = activeCardId ? cardsById[activeCardId] : null;

  if (isLoading) {
    return (
      <div className="relative overflow-hidden">
        <main className="relative mx-auto flex min-h-screen max-w-[1680px] items-center justify-center px-6 py-16">
          <div className="rounded-[32px] border border-[var(--stroke)] bg-white/90 px-8 py-6 shadow-[var(--shadow)]">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
              Loading board
            </p>
          </div>
        </main>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="relative overflow-hidden">
        <main className="relative mx-auto flex min-h-screen max-w-[1680px] items-center justify-center px-6 py-16">
          <div className="max-w-md rounded-[32px] border border-[var(--stroke)] bg-white/90 px-8 py-6 shadow-[var(--shadow)]">
            <h1 className="font-display text-2xl font-semibold text-[var(--navy-dark)]">
              Unable to load the board
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--gray-text)]">
              {error || "Something went wrong while loading the board."}
            </p>
            <button
              type="button"
              onClick={() => void loadBoard()}
              className="mt-5 rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-sm font-semibold text-white"
            >
              Try again
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <main className="relative mx-auto flex min-h-screen max-w-[1680px] flex-col gap-10 px-6 pb-16 pt-12">
        <header className="flex flex-col gap-6 rounded-[32px] border border-[var(--stroke)] bg-white/80 p-8 shadow-[var(--shadow)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
                Single Board Kanban
              </p>
              <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--navy-dark)]">
                Kanban Studio
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--gray-text)]">
                Keep momentum visible. Rename columns, drag cards between stages,
                capture quick notes, and ask the AI sidebar to update the board
                without getting buried in settings.
              </p>
            </div>
            <div className="flex items-start gap-4">
              <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
                  Focus
                </p>
                <p className="mt-2 text-lg font-semibold text-[var(--primary-blue)]">
                  One board. Five columns. Zero clutter.
                </p>
              </div>
              <LogoutButton />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {isSaving ? (
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--secondary-purple)]">
                Saving...
              </p>
            ) : null}
            {error ? (
              <p className="text-xs font-semibold text-[var(--secondary-purple)]">
                {error}
              </p>
            ) : null}
            {board.columns.map((column) => (
              <div
                key={column.id}
                className="flex items-center gap-2 rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)]"
              >
                <span className="h-2 w-2 rounded-full bg-[var(--accent-yellow)]" />
                {column.title}
              </div>
            ))}
          </div>
        </header>

        <DndContext
          sensors={sensors}
          collisionDetection={(args) => {
            const pointerHits = pointerWithin(args);
            return pointerHits.length > 0 ? pointerHits : closestCorners(args);
          }}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
            <section className="overflow-x-auto pb-2">
              <div className="grid min-w-[1200px] grid-cols-5 gap-6">
                {board.columns.map((column) => (
                  <KanbanColumn
                    key={column.id}
                    column={column}
                    cards={column.cardIds.map((cardId) => board.cards[cardId])}
                    onRename={handleRenameColumn}
                    onAddCard={handleAddCard}
                    onDeleteCard={handleDeleteCard}
                  />
                ))}
              </div>
            </section>
            <AIChatSidebar onSend={handleSendAiMessage} />
          </div>
          <DragOverlay>
            {activeCard ? (
              <div className="w-[260px]">
                <KanbanCardPreview card={activeCard} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>
    </div>
  );
};
