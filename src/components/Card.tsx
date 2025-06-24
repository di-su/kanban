import React from "react";
import DeleteButton from "./DeleteButton";
import { styles } from "../styles/shared";
import { Card as CardType } from "../types";

interface CardProps {
  card: CardType;
  onDragStart: () => void;
  onDelete: () => void;
  disabled?: boolean;
}

export default function Card({ card, onDragStart, onDelete, disabled }: CardProps) {
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    onDragStart();
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div
      draggable={!disabled}
      onDragStart={handleDragStart}
      style={{
        ...styles.card.base,
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? 'not-allowed' : 'move'
      }}
    >
      <span style={{ flex: 1 }}>{card.content}</span>
      <DeleteButton 
        onClick={onDelete} 
        title="Delete card"
        disabled={disabled}
      />
    </div>
  );
}