import { useState } from 'react';
import useLocalStorage from './useLocalStorage';
import useDragAndDrop from './useDragAndDrop';
import { Column } from '../types';

// Helper to generate unique ids
const uid = () => Math.random().toString(36).slice(2, 9);

export default function useKanban() {
  const defaultColumns: Column[] = [
    { id: uid(), title: "To Do", cards: [{ id: uid(), content: "Sample Task" }] },
    { id: uid(), title: "In Progress", cards: [] },
    { id: uid(), title: "Done", cards: [] },
  ];

  // Use localStorage to persist columns
  const [columns, setColumns, isLoaded] = useLocalStorage<Column[]>('kanban-columns', defaultColumns);
  
  // New column title input state
  const [newColumnTitle, setNewColumnTitle] = useState('');

  // Get drag and drop functionality
  const dnd = useDragAndDrop();

  // Column operations
  const addColumn = () => {
    if (!newColumnTitle.trim()) return;
    setColumns([...columns, { id: uid(), title: newColumnTitle, cards: [] }]);
    setNewColumnTitle('');
  };

  const deleteColumn = (colId: string) => {
    setColumns(columns.filter(col => col.id !== colId));
  };

  const renameColumn = (colId: string, newTitle: string) => {
    setColumns(columns.map(col => 
      col.id === colId ? { ...col, title: newTitle } : col
    ));
  };

  // Card operations
  const addCard = (colId: string, content: string) => {
    if (!content.trim()) return;
    setColumns(columns.map(col =>
      col.id === colId ? { ...col, cards: [...col.cards, { id: uid(), content }] } : col
    ));
  };

  const deleteCard = (colId: string, cardId: string) => {
    setColumns(columns.map(col =>
      col.id === colId ? { ...col, cards: col.cards.filter(card => card.id !== cardId) } : col
    ));
  };

  // Handle card drop - uses the drag state from useDragAndDrop
  const handleCardDrop = (toColId: string) => {
    dnd.handleCardDrop(toColId, columns, setColumns);
  };

  // Handle column drop - uses the drag state from useDragAndDrop
  const handleColumnDrop = (targetColId: string) => {
    dnd.handleColumnDrop(targetColId, columns, setColumns);
  };

  return {
    // State
    columns,
    newColumnTitle,
    setNewColumnTitle,
    isLoaded,
    
    // Column operations
    addColumn,
    deleteColumn,
    renameColumn,
    
    // Card operations
    addCard,
    deleteCard,
    
    // Drag and drop
    onCardDragStart: dnd.handleCardDragStart,
    onCardDrop: handleCardDrop,
    onColumnDragStart: dnd.handleColumnDragStart,
    onColumnDrop: handleColumnDrop,
    onColumnDragEnd: dnd.handleColumnDragEnd,
    
    // State checks for UI
    isColumnDragged: dnd.isColumnDragged,
    isCardDraggedOverColumn: dnd.isCardDraggedOverColumn,
    isColumnDropTarget: dnd.isColumnDropTarget
  };
}