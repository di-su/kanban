'use server';

import { revalidatePath } from 'next/cache';
import { Card, Column } from '../types';
import { getColumns, saveColumns, uid } from './storage';

// Column operations
export async function addColumn(title: string) {
  if (!title.trim()) return null;
  
  const columns = await getColumns();
  const newColumn = { id: uid(), title, cards: [] };
  columns.push(newColumn);
  await saveColumns(columns);
  
  revalidatePath('/');
  return columns;
}

export async function deleteColumn(colId: string) {
  const columns = await getColumns();
  const filtered = columns.filter(col => col.id !== colId);
  await saveColumns(filtered);
  
  revalidatePath('/');
  return filtered;
}

export async function renameColumn(colId: string, newTitle: string) {
  const columns = await getColumns();
  const updated = columns.map(col => 
    col.id === colId ? { ...col, title: newTitle } : col
  );
  await saveColumns(updated);
  
  revalidatePath('/');
  return updated;
}

// Card operations
export async function addCard(colId: string, content: string) {
  if (!content.trim()) return null;
  
  const columns = await getColumns();
  const updated = columns.map(col =>
    col.id === colId 
      ? { ...col, cards: [...col.cards, { id: uid(), content }] } 
      : col
  );
  await saveColumns(updated);
  
  revalidatePath('/');
  return updated;
}

export async function deleteCard(colId: string, cardId: string) {
  const columns = await getColumns();
  const updated = columns.map(col =>
    col.id === colId 
      ? { ...col, cards: col.cards.filter(card => card.id !== cardId) } 
      : col
  );
  await saveColumns(updated);
  
  revalidatePath('/');
  return updated;
}

// Drag and drop operations
export async function moveCard(cardId: string, fromColId: string, toColId: string) {
  const columns = await getColumns();
  let movedCard: Card | undefined;
  
  // Remove card from source column
  const updated = columns.map(col => {
    if (col.id === fromColId) {
      const cards = col.cards.filter(card => {
        if (card.id === cardId) {
          movedCard = card;
          return false;
        }
        return true;
      });
      return { ...col, cards };
    }
    return col;
  });
  
  // Add card to target column
  if (movedCard) {
    const final = updated.map(col =>
      col.id === toColId 
        ? { ...col, cards: [...col.cards, movedCard] as Card[] }
        : col
    );
    await saveColumns(final);
    revalidatePath('/');
    return final;
  }
  
  return columns;
}

export async function reorderColumns(draggedColId: string, targetColId: string) {
  const columns = await getColumns();
  const draggedIndex = columns.findIndex(col => col.id === draggedColId);
  const targetIndex = columns.findIndex(col => col.id === targetColId);
  
  if (draggedIndex === -1 || targetIndex === -1) return columns;
  
  const reordered = [...columns];
  const [removed] = reordered.splice(draggedIndex, 1);
  reordered.splice(targetIndex, 0, removed);
  
  await saveColumns(reordered);
  revalidatePath('/');
  return reordered;
}