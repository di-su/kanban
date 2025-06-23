import React, { useState } from "react";
import Card from "./Card";
import DeleteButton from "./DeleteButton";
import { styles } from "../styles/shared";
import { Column as ColumnType } from "../types";

interface ColumnProps {
  col: ColumnType;
  onAddCard: (colId: string, content: string) => void;
  onDeleteCard: (colId: string, cardId: string) => void;
  onDeleteColumn: (colId: string) => void;
  onRenameColumn: (colId: string, newTitle: string) => void;
  onDragStart: (cardId: string, fromColId: string) => void;
  onDrop: (targetColId: string) => void;
  isDraggedOver: boolean;
  // Column drag and drop
  draggable: boolean;
  onColDragStart?: (colId: string) => void;
  onColDrop?: (targetColId: string) => void;
  onColDragEnd?: () => void;
  isColDragged: boolean;
  isColDropTarget: boolean;
}

export default function Column({
  col,
  onAddCard,
  onDeleteCard,
  onDeleteColumn,
  onRenameColumn,
  onDragStart,
  onDrop,
  isDraggedOver,
  // Column drag and drop
  draggable,
  onColDragStart,
  onColDrop,
  onColDragEnd,
  isColDragged,
  isColDropTarget
}: ColumnProps) {
  const [editTitle, setEditTitle] = useState(false);
  const [title, setTitle] = useState(col.title);
  const [newCardText, setNewCardText] = useState("");

  const handleTitleBlur = () => {
    setEditTitle(false);
    if (title !== col.title) {
      onRenameColumn(col.id, title);
    }
  };

  // Combined drag handlers
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if it's a column drop (when dragging columns)
    if (isColDropTarget) {
      if (onColDrop) onColDrop(col.id);
    } else {
      // Otherwise it's a card drop
      onDrop(col.id);
    }
  };

  const handleColDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    if (onColDragStart) onColDragStart(col.id);
    e.stopPropagation();
  };

  const handleColDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    if (onColDragEnd) onColDragEnd();
    e.stopPropagation();
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{
        ...styles.column.base,
        ...(isColDragged ? styles.column.dragging : styles.column.normal),
        ...(isColDropTarget || isDraggedOver ? styles.column.dropTarget : styles.column.noBorder)
      }}
    >
      <div 
        draggable={draggable}
        onDragStart={handleColDragStart}
        onDragEnd={handleColDragEnd}
        style={styles.columnHeader.base}
      >
        {editTitle ? (
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            autoFocus
            style={{ flex: 1 }}
          />
        ) : (
          <h3
            style={{ flex: 1, margin: 0, cursor: "pointer" }}
            onClick={() => setEditTitle(true)}
            title="Click to rename"
          >
            {col.title}
          </h3>
        )}
        <DeleteButton 
          onClick={() => onDeleteColumn(col.id)} 
          title="Delete column" 
        />
      </div>
      <div style={{ minHeight: 24 }}>
        {col.cards.map(card => (
          <Card
            key={card.id}
            card={card}
            colId={col.id}
            onDeleteCard={onDeleteCard}
            onDragStart={onDragStart}
          />
        ))}
      </div>
      <div style={{ marginTop: 8 }}>
        <input
          value={newCardText}
          onChange={e => setNewCardText(e.target.value)}
          placeholder="Add card"
          style={{ width: "100%", marginBottom: 4 }}
          onKeyDown={e => {
            if (e.key === "Enter" && newCardText.trim()) {
              onAddCard(col.id, newCardText);
              setNewCardText("");
            }
          }}
        />
        <button
          onClick={() => {
            if (newCardText.trim()) {
              onAddCard(col.id, newCardText);
              setNewCardText("");
            }
          }}
          style={{ width: "100%" }}
        >
          Add Card
        </button>
      </div>
    </div>
  );
}