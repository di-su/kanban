'use client'

import React from "react";
import Column from "./Column";
import useKanban from "../hooks/useKanban";

export default function Board() {
  const kanban = useKanban();

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start", padding: 16 }}>
      {kanban.columns.map(col => (
        <Column
          key={col.id}
          col={col}
          onAddCard={kanban.addCard}
          onDeleteCard={kanban.deleteCard}
          onDeleteColumn={kanban.deleteColumn}
          onRenameColumn={kanban.renameColumn}
          onDragStart={kanban.onCardDragStart}
          onDrop={kanban.onCardDrop}
          isDraggedOver={kanban.isCardDraggedOverColumn(col.id)}
          // Column drag and drop
          draggable
          onColDragStart={kanban.onColumnDragStart}
          onColDrop={kanban.onColumnDrop}
          onColDragEnd={kanban.onColumnDragEnd}
          isColDragged={kanban.isColumnDragged(col.id)}
          isColDropTarget={kanban.isColumnDropTarget(col.id)}
        />
      ))}
      <div style={{ minWidth: 180 }}>
        <input
          placeholder="New column title"
          value={kanban.newColumnTitle}
          onChange={e => kanban.setNewColumnTitle(e.target.value)}
          style={{ width: "100%", marginBottom: 4 }}
        />
        <button onClick={kanban.addColumn} style={{ width: "100%" }}>Add Column</button>
      </div>
    </div>
  );
}
