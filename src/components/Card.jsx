import React from "react";

export default function Card({ card, colId, onDeleteCard, onDragStart }) {
  // Drag handlers
  const handleDragStart = (e) => {
    onDragStart(card.id, colId);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      style={{
        background: "#fff",
        borderRadius: 6,
        padding: "8px 12px",
        margin: "8px 0",
        boxShadow: "0 1px 3px #0002",
        display: "flex",
        alignItems: "center",
        cursor: "grab"
      }}
    >
      <span style={{ flex: 1 }}>{card.text}</span>
      <button
        onClick={() => onDeleteCard(colId, card.id)}
        style={{ marginLeft: 8, background: "#fee", border: "1px solid #f99", borderRadius: 4 }}
        title="Delete card"
      >
        ×
      </button>
    </div>
  );
}
