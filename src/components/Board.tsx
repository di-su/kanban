'use client';

import React, { useState, useTransition } from 'react';
import Column from './Column';
import { addColumn, moveCard, reorderColumns } from '../lib/actions';
import useDragAndDrop from '../hooks/useDragAndDrop';
import { Column as ColumnType } from '../types';

interface BoardProps {
  initialColumns: ColumnType[];
}

export default function Board({ initialColumns }: BoardProps) {
  const [columns, setColumns] = useState(initialColumns);
  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [isPending, startTransition] = useTransition();
  const dnd = useDragAndDrop();

  // Handle adding a new column
  const handleAddColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColumnTitle.trim()) return;
    
    startTransition(async () => {
      const updatedColumns = await addColumn(newColumnTitle);
      if (updatedColumns) {
        setColumns(updatedColumns);
        setNewColumnTitle('');
      }
    });
  };

  // Handle card drop with server action
  const handleCardDrop = async (toColId: string) => {
    if (!dnd.draggedCard) return;
    
    const { cardId, fromColId } = dnd.draggedCard;
    
    
    // Server update
    startTransition(async () => {
      const updated = await moveCard(cardId, fromColId, toColId);
      if (updated) {
        setColumns(updated);
      }
    });
  };

  // Handle column drop with server action
  const handleColumnDrop = async (targetColId: string) => {
    if (!dnd.draggedColId || dnd.draggedColId === targetColId) return;
    
    const draggedColId = dnd.draggedColId;
    
    
    // Server update
    startTransition(async () => {
      const updated = await reorderColumns(draggedColId, targetColId);
      if (updated) {
        setColumns(updated);
      }
    });
  };

  return (
    <div style={{ 
      display: 'flex', 
      gap: '20px', 
      padding: '20px',
      opacity: isPending ? 0.7 : 1,
      transition: 'opacity 0.2s'
    }}>
      {columns.map((col) => (
        <Column
          key={col.id}
          column={col}
          onCardDragStart={(cardId) => dnd.handleCardDragStart(cardId, col.id)}
          onCardDrop={() => handleCardDrop(col.id)}
          onColumnDragStart={() => dnd.handleColumnDragStart(col.id)}
          onColumnDrop={() => handleColumnDrop(col.id)}
          onColumnDragEnd={dnd.handleColumnDragEnd}
          isColumnDragged={dnd.isColumnDragged(col.id)}
          isCardDraggedOver={dnd.isCardDraggedOverColumn(col.id)}
          isColumnDropTarget={dnd.isColumnDropTarget(col.id)}
          onUpdate={setColumns}
        />
      ))}
      
      <form onSubmit={handleAddColumn} style={{ minWidth: '250px' }}>
        <input
          type="text"
          placeholder="New column title..."
          value={newColumnTitle}
          onChange={(e) => setNewColumnTitle(e.target.value)}
          style={{
            width: '100%',
            padding: '8px',
            marginBottom: '8px'
          }}
        />
        <button 
          type="submit"
          disabled={isPending}
          style={{
            width: '100%',
            padding: '8px',
            cursor: isPending ? 'not-allowed' : 'pointer',
            opacity: isPending ? 0.6 : 1
          }}
        >
          Add Column
        </button>
      </form>
    </div>
  );
}