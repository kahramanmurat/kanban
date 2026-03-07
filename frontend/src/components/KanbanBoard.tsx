"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  updateCard,
} from "@/lib/boardApi";

export function KanbanBoard() {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const pendingMutationCount = useRef(0);
  const mutationQueue = useRef<Promise<void>>(Promise.resolve());

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

  const queueMutation = useCallback(<T,>(mutate: () => Promise<T>) => {
    pendingMutationCount.current += 1;
    setIsSaving(true);
    const task = mutationQueue.current
      .catch(() => undefined)
      .then(async () => {
        setError("");
        return mutate();
      });

    mutationQueue.current = task.then(
      () => undefined,
      () => undefined
    );

    return task.finally(() => {
      pendingMutationCount.current = Math.max(0, pendingMutationCount.current - 1);
      if (pendingMutationCount.current === 0) {
        setIsSaving(false);
      }
    });
  }, []);

  const runMutation = useCallback(
    (mutate: () => Promise<BoardData>) => {
      void queueMutation(mutate)
        .then((nextBoard) => {
          setBoard(nextBoard);
        })
        .catch((nextError) => {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Unable to save your changes."
          );
        });
    },
    [queueMutation]
  );

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

    runMutation(() => moveCard(active.id as string, destinationColumn.id, nextPosition));
  };

  const handleRenameColumn = (columnId: string, title: string) => {
    runMutation(() => renameColumn(columnId, title));
  };

  const handleAddCard = (columnId: string, title: string, details: string) => {
    runMutation(() => addCard(columnId, title, details));
  };

  const handleUpdateCard = (cardId: string, title: string, details: string) => {
    runMutation(() => updateCard(cardId, title, details));
  };

  const handleDeleteCard = (_columnId: string, cardId: string) => {
    runMutation(() => deleteCard(cardId));
  };

  const handleSendAiMessage = async (
    message: string,
    history: AIChatMessage[]
  ): Promise<AIChatResponse> => {
    if (!board) {
      throw new Error("The board is still loading.");
    }

    try {
      const response = await queueMutation(() => sendAiBoardMessage(message, history));
      setBoard(response.board);
      return response;
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to contact the AI assistant."
      );
      throw nextError;
    }
  };

  const activeCard = activeCardId ? cardsById[activeCardId] : null;

  if (isLoading) {
    return (
      <div className="relative overflow-hidden">
        <main className="relative mx-auto flex min-h-screen max-w-[1680px] items-center justify-center px-6 py-16">
          <div className="rounded-[32px] border border-[var(--stroke)] bg-white/90 px-8 py-6 shadow-[var(--shadow)]" role="status" aria-live="polite">
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

      <main className="relative mx-auto flex min-h-screen max-w-[1920px] flex-col gap-6 px-4 pb-12 pt-8 lg:px-6">
        <header className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--stroke)] bg-white/80 px-6 py-4 shadow-[var(--shadow)] backdrop-blur">
          <div className="flex items-center gap-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--navy-dark)]">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-white">
                <path fillRule="evenodd" d="M2 3.75A.75.75 0 0 1 2.75 3h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 3.75zm0 4.167a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75zm0 4.166a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75zm0 4.167a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75z" clipRule="evenodd" />
              </svg>
            </div>
            <h1 className="font-display text-xl font-semibold text-[var(--navy-dark)]">
              Kanban Studio
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {isSaving ? (
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--secondary-purple)]" role="status" aria-live="polite">
                Saving...
              </p>
            ) : null}
            {error ? (
              <p className="text-xs font-semibold text-[var(--secondary-purple)]" role="alert">
                {error}
              </p>
            ) : null}
            <LogoutButton />
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
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <section className="overflow-x-auto pb-2">
              <div className="grid min-w-[900px] grid-cols-5 gap-3">
                {board.columns.map((column) => (
                  <KanbanColumn
                    key={column.id}
                    column={column}
                    cards={column.cardIds.map((cardId) => board.cards[cardId])}
                    onRename={handleRenameColumn}
                    onAddCard={handleAddCard}
                    onUpdateCard={handleUpdateCard}
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
}
