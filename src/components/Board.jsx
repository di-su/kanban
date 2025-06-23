import React, { useState, useEffect } from "react";
import Column from "./Column";

// Helper to generate unique ids
const uid = () => Math.random().toString(36).slice(2, 9);

export default function Board() {
  const initialColumns = () => {
    const saved = localStorage.getItem("kanban-columns");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback to default
      }
    }
    return [
      { id: uid(), title: "To Do", cards: [ { id: uid(), text: "Sample Task" } ] },
      { id: uid(), title: "In Progress", cards: [] },
      { id: uid(), title: "Done", cards: [] },
    ];
  };
  const [columns, setColumns] = useState(initialColumns);
  const [newColTitle, setNewColTitle] = useState("");
  const [dragged, setDragged] = useState(null); // {cardId, fromColId}
  const [draggedColId, setDraggedColId] = useState(null); // column id being dragged

  // Persist columns to localStorage
  useEffect(() => {
    localStorage.setItem("kanban-columns", JSON.stringify(columns));
  }, [columns]);

  // Add column
  const addColumn = () => {
    if (!newColTitle.trim()) return;
    setColumns([...columns, { id: uid(), title: newColTitle, cards: [] }]);
    setNewColTitle("");
  };

  // Delete column
  const deleteColumn = (colId) => {
    setColumns(columns.filter(col => col.id !== colId));
  };

  // Rename column
  const renameColumn = (colId, newTitle) => {
    setColumns(columns.map(col => col.id === colId ? { ...col, title: newTitle } : col));
  };

  // Add card
  const addCard = (colId, text) => {
    setColumns(columns.map(col =>
      col.id === colId ? { ...col, cards: [...col.cards, { id: uid(), text }] } : col
    ));
  };

  // Delete card
  const deleteCard = (colId, cardId) => {
    setColumns(columns.map(col =>
      col.id === colId ? { ...col, cards: col.cards.filter(card => card.id !== cardId) } : col
    ));
  };

  // Drag and drop handlers for cards
  const onDragStart = (cardId, fromColId) => {
    setDragged({ cardId, fromColId });
  };

  const onDrop = (toColId) => {
    if (!dragged) return;
    if (dragged.fromColId === toColId) return;
    let cardToMove;
    const newColumns = columns.map(col => {
      if (col.id === dragged.fromColId) {
        cardToMove = col.cards.find(card => card.id === dragged.cardId);
        return { ...col, cards: col.cards.filter(card => card.id !== dragged.cardId) };
      }
      return col;
    }).map(col => {
      if (col.id === toColId && cardToMove) {
        return { ...col, cards: [...col.cards, cardToMove] };
      }
      return col;
    });
    setColumns(newColumns);
    setDragged(null);
  };

  // Drag and drop handlers for columns
  const onColDragStart = (colId) => {
    setDraggedColId(colId);
  };

  const onColDrop = (targetColId) => {
    if (!draggedColId || draggedColId === targetColId) return;
    const fromIdx = columns.findIndex(col => col.id === draggedColId);
    const toIdx = columns.findIndex(col => col.id === targetColId);
    if (fromIdx === -1 || toIdx === -1) return;
    const reordered = [...columns];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setColumns(reordered);
    setDraggedColId(null);
  };

  const onColDragOver = (colId) => {
    // For highlighting drop target if desired (optional)
  };

  const onColDragEnd = () => {
    setDraggedColId(null);
  };


  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start", padding: 16 }}>
      {columns.map(col => (
        <Column
          key={col.id}
          col={col}
          onAddCard={addCard}
          onDeleteCard={deleteCard}
          onDeleteColumn={deleteColumn}
          onRenameColumn={renameColumn}
          onDragStart={onDragStart}
          onDrop={onDrop}
          isDraggedOver={dragged && dragged.fromColId !== col.id}
          // Column drag and drop
          draggable
          onColDragStart={onColDragStart}
          onColDrop={onColDrop}
          onColDragOver={onColDragOver}
          onColDragEnd={onColDragEnd}
          isColDragged={draggedColId === col.id}
          isColDropTarget={draggedColId && draggedColId !== col.id}
        />
      ))}
      <div style={{ minWidth: 180 }}>
        <input
          placeholder="New column title"
          value={newColTitle}
          onChange={e => setNewColTitle(e.target.value)}
          style={{ width: "100%", marginBottom: 4 }}
        />
        <button onClick={addColumn} style={{ width: "100%" }}>Add Column</button>
      </div>
    </div>
  );
}
