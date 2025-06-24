'use client';

import React, { useState, useTransition } from 'react';
import Card from './Card';
import DeleteButton from './DeleteButton';
import { styles } from '../styles/shared';
import { Column as ColumnType } from '../types';
import { renameColumn, deleteColumn, addCard, deleteCard } from '../lib/actions';

interface ColumnProps {
  column: ColumnType;
  onCardDragStart: (cardId: string) => void;
  onCardDrop: () => void;
  onColumnDragStart: () => void;
  onColumnDrop: () => void;
  onColumnDragEnd: () => void;
  isColumnDragged: boolean;
  isCardDraggedOver: boolean;
  isColumnDropTarget: boolean;
  onUpdate: (columns: ColumnType[]) => void;
}

export default function Column({ 
  column, 
  onCardDragStart, 
  onCardDrop,
  onColumnDragStart,
  onColumnDrop,
  onColumnDragEnd,
  isColumnDragged,
  isCardDraggedOver,
  isColumnDropTarget,
  onUpdate
}: ColumnProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(column.title);
  const [newCardContent, setNewCardContent] = useState('');
  const [isPending, startTransition] = useTransition();
  
  // Sync title with column prop changes
  React.useEffect(() => {
    setTitle(column.title);
  }, [column.title]);
  
  const handleTitleSubmit = async () => {
    if (title.trim() && title !== column.title) {
      startTransition(async () => {
        const updated = await renameColumn(column.id, title);
        if (updated) onUpdate(updated);
      });
    } else {
      setTitle(column.title);
    }
    setIsEditing(false);
  };
  
  const handleDelete = async () => {
    startTransition(async () => {
      const updated = await deleteColumn(column.id);
      if (updated) onUpdate(updated);
    });
  };
  
  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardContent.trim()) return;
    
    startTransition(async () => {
      const updated = await addCard(column.id, newCardContent);
      if (updated) {
        onUpdate(updated);
        setNewCardContent('');
      }
    });
  };
  
  const handleDeleteCard = async (cardId: string) => {
    startTransition(async () => {
      const updated = await deleteCard(column.id, cardId);
      if (updated) onUpdate(updated);
    });
  };
  
  const columnStyle = {
    ...styles.column.base,
    opacity: isColumnDragged || isPending ? 0.5 : 1,
    border: isCardDraggedOver ? '2px dashed #4285f4' : '2px solid transparent',
    backgroundColor: isColumnDropTarget ? '#e8f0fe' : '#f3f3f3',
    transition: 'all 0.2s ease'
  };
  
  return (
    <div 
      style={columnStyle}
      draggable
      onDragStart={onColumnDragStart}
      onDragEnd={onColumnDragEnd}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isCardDraggedOver) {
          onCardDrop();
        } else if (isColumnDropTarget) {
          onColumnDrop();
        }
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        {isEditing ? (
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTitleSubmit();
              if (e.key === 'Escape') {
                setTitle(column.title);
                setIsEditing(false);
              }
            }}
            style={{ fontSize: '18px', fontWeight: 'bold', padding: '4px' }}
            autoFocus
          />
        ) : (
          <h3 
            onClick={() => setIsEditing(true)}
            style={{ cursor: 'pointer', userSelect: 'none' }}
          >
            {column.title}
          </h3>
        )}
        <DeleteButton onClick={handleDelete} disabled={isPending} />
      </div>
      
      {column.cards.map(card => (
        <Card 
          key={card.id}
          card={card}
          onDragStart={() => onCardDragStart(card.id)}
          onDelete={() => handleDeleteCard(card.id)}
          disabled={isPending}
        />
      ))}
      
      <form onSubmit={handleAddCard}>
        <input
          type="text"
          placeholder="Add a card..."
          value={newCardContent}
          onChange={(e) => setNewCardContent(e.target.value)}
          disabled={isPending}
          style={{
            width: '100%',
            padding: '8px',
            marginTop: '10px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            opacity: isPending ? 0.6 : 1
          }}
        />
      </form>
    </div>
  );
}