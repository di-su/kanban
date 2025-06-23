import React, { useState } from "react";
import { Column, DraggedCard } from "../types";

export default function useDragAndDrop() {
  const [draggedCard, setDraggedCard] = useState<DraggedCard | null>(null);
  const [draggedColId, setDraggedColId] = useState<string | null>(null);

  // Card drag and drop handlers
  const handleCardDragStart = (cardId: string, fromColId: string) => {
    setDraggedCard({ cardId, fromColId });
  };

  const handleCardDrop = (
    toColId: string, 
    columns: Column[], 
    setColumns: React.Dispatch<React.SetStateAction<Column[]>>
  ) => {
    if (!draggedCard) return;
    if (draggedCard.fromColId === toColId) return;

    let cardToMove;
    const newColumns = columns
      .map((col) => {
        if (col.id === draggedCard.fromColId) {
          cardToMove = col.cards.find((card) => card.id === draggedCard.cardId);
          return {
            ...col,
            cards: col.cards.filter((card) => card.id !== draggedCard.cardId),
          };
        }
        return col;
      })
      .map((col) => {
        if (col.id === toColId && cardToMove) {
          return { ...col, cards: [...col.cards, cardToMove] };
        }
        return col;
      });

    setColumns(newColumns);
    setDraggedCard(null);
  };

  // Column drag and drop handlers
  const handleColumnDragStart = (colId: string) => {
    setDraggedColId(colId);
  };

  const handleColumnDrop = (
    targetColId: string, 
    columns: Column[], 
    setColumns: React.Dispatch<React.SetStateAction<Column[]>>
  ) => {
    if (!draggedColId || draggedColId === targetColId) return;

    // Find indexes of source and target columns
    const fromIdx = columns.findIndex((col) => col.id === draggedColId);
    const toIdx = columns.findIndex((col) => col.id === targetColId);

    if (fromIdx === -1 || toIdx === -1) return;

    // Create a new array to avoid mutating the original
    const reordered = [...columns];
    
    // Remove the column being dragged
    const [movedColumn] = reordered.splice(fromIdx, 1);
    
    // Insert it at the target position
    reordered.splice(toIdx, 0, movedColumn);
    
    // Update state with the new column order
    setColumns(reordered);
    setDraggedColId(null);
  };

  const handleColumnDragEnd = () => {
    setDraggedColId(null);
  };

  return {
    draggedCard,
    draggedColId,
    handleCardDragStart,
    handleCardDrop,
    handleColumnDragStart,
    handleColumnDrop,
    handleColumnDragEnd,
    isColumnDragged: (colId: string) => draggedColId === colId,
    isCardDraggedOverColumn: (colId: string) =>
      draggedCard !== null && draggedCard.fromColId !== colId,
    isColumnDropTarget: (colId: string) => draggedColId !== null && draggedColId !== colId,
  };
}