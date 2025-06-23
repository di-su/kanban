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
  isDraggedOver,
  // Column drag and drop
  draggable,
  onColDragStart,
  onColDrop,
  onColDragOver,
  onColDragEnd,
  isColDragged,
  isColDropTarget
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

  // Column drag handlers
  const handleColDragStart = (e) => {
    if (onColDragStart) onColDragStart(col.id);
    e.stopPropagation();
  };

  const handleColDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleColDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onColDrop) onColDrop(col.id);
  };

  const handleColDragEnd = (e) => {
    if (onColDragEnd) onColDragEnd();
    e.stopPropagation();
  };

  return (
    <div
      onDragOver={(e) => {
        handleDragOver(e);
        handleColDragOver(e);
      }}
      onDrop={(e) => {
        handleDrop(e);
        handleColDrop(e);
      }}
      style={{
        background: isColDragged ? "#e0eaff" : "#f3f3f3",
        borderRadius: 8,
        padding: 12,
        minWidth: 220,
        boxShadow: "0 1px 4px #0001",
        border: isColDropTarget ? "2px solid #0077ff" : isDraggedOver ? "2px solid #0077ff" : "2px solid transparent",
        opacity: isColDragged ? 0.6 : 1,
        transition: "background 0.2s, border 0.2s",
        position: "relative" // To position children properly
      }}
    >
      {/* Card drop zone - invisible overlay for handling card drops */}
      <div 
        style={{ 
          width: '100%', 
          height: '100%', 
          position: 'absolute', 
          top: 0, 
          left: 0,
          pointerEvents: 'none' // Let events pass through to column
        }}
      />
      <div 
        draggable={draggable}
        onDragStart={handleColDragStart}
        onDragEnd={handleColDragEnd}
        style={{ 
          display: "flex", 
          alignItems: "center", 
          marginBottom: 8, 
          padding: "4px 6px",
          borderRadius: "4px",
          cursor: "move",
          background: "#e9e9e9"
        }}
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
