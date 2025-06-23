import React from "react";
import DeleteButton from "./DeleteButton";
import { styles } from "../styles/shared";
import { Card as CardType } from "../types";

interface CardProps {
  card: CardType;
  colId: string;
  onDeleteCard: (colId: string, cardId: string) => void;
  onDragStart: (cardId: string, fromColId: string) => void;
}

export default function Card({ card, colId, onDeleteCard, onDragStart }: CardProps) {
  // Drag handlers
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    onDragStart(card.id, colId);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      style={styles.card.base}
    >
      <span style={{ flex: 1 }}>{card.content}</span>
      <DeleteButton 
        onClick={() => onDeleteCard(colId, card.id)} 
        title="Delete card" 
      />
    </div>
  );
}
