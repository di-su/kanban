import React, { useState } from "react";
import Card from "./Card";

export default function Column({
  col,
  onAddCard,
  onDeleteCard,
  onDeleteColumn,
  onRenameColumn,
  onDragStart,
  onDrop,
  isDraggedOver
}) {
  const [editTitle, setEditTitle] = useState(false);
  const [title, setTitle] = useState(col.title);
  const [newCardText, setNewCardText] = useState("");

  const handleTitleBlur = () => {
    setEditTitle(false);
    if (title !== col.title) {
      onRenameColumn(col.id, title);
    }
  };

  // Drag-and-drop handlers for cards
  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    onDrop(col.id);
  };

  return (
    <div
      style={{
        background: "#f3f3f3",
        borderRadius: 8,
        padding: 12,
        minWidth: 220,
        boxShadow: "0 1px 4px #0001",
        border: isDraggedOver ? "2px solid #0077ff" : "2px solid transparent"
      }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
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
        <button
          onClick={() => onDeleteColumn(col.id)}
          style={{ marginLeft: 8, background: "#fee", border: "1px solid #f99", borderRadius: 4 }}
          title="Delete column"
        >
          ×
        </button>
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
