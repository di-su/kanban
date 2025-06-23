export interface Card {
  id: string;
  content: string;
}

export interface Column {
  id: string;
  title: string;
  cards: Card[];
}

export interface DraggedCard {
  cardId: string;
  fromColId: string;
}

export interface DragAndDropState {
  draggedCard: DraggedCard | null;
  draggedColId: string | null;
  handleCardDragStart: (cardId: string, fromColId: string) => void;
  handleColDragStart: (colId: string) => void;
  handleDrop: (targetColId: string, targetCardId?: string | null) => void;
  handleDragEnd: () => void;
  isCardBeingDragged: (cardId: string) => boolean;
  isColumnBeingDragged: (colId: string) => boolean;
  isDraggingCard: () => boolean;
  isDraggingColumn: () => boolean;
}