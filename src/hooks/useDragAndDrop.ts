import { useState } from "react";
import { DraggedCard } from "../types";

export default function useDragAndDrop() {
  const [draggedCard, setDraggedCard] = useState<DraggedCard | null>(null);
  const [draggedColId, setDraggedColId] = useState<string | null>(null);

  // Card drag handlers
  const handleCardDragStart = (cardId: string, fromColId: string) => {
    setDraggedCard({ cardId, fromColId });
  };

  // Column drag handlers
  const handleColumnDragStart = (colId: string) => {
    setDraggedColId(colId);
  };

  const handleColumnDragEnd = () => {
    setDraggedColId(null);
  };

  return {
    draggedCard,
    draggedColId,
    handleCardDragStart,
    handleColumnDragStart,
    handleColumnDragEnd,
    isColumnDragged: (colId: string) => draggedColId === colId,
    isCardDraggedOverColumn: (colId: string) =>
      draggedCard !== null && draggedCard.fromColId !== colId,
    isColumnDropTarget: (colId: string) => draggedColId !== null && draggedColId !== colId,
  };
}