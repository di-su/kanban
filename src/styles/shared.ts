import React from 'react';

export const styles = {
  column: {
    base: {
      borderRadius: 8,
      padding: 12,
      minWidth: 220,
      boxShadow: "0 1px 4px #0001",
      transition: "background 0.2s, border 0.2s",
      position: "relative" as const
    },
    dragging: {
      background: "#e0eaff",
      opacity: 0.6
    },
    normal: {
      background: "#f3f3f3",
      opacity: 1
    },
    dropTarget: {
      border: "2px solid #0077ff"
    },
    noBorder: {
      border: "2px solid transparent"
    }
  },
  
  columnHeader: {
    base: {
      display: "flex",
      alignItems: "center",
      marginBottom: 8,
      padding: "4px 6px",
      borderRadius: "4px",
      cursor: "move",
      background: "#e9e9e9"
    }
  },
  
  card: {
    base: {
      background: "#fff",
      borderRadius: 6,
      padding: "8px 12px",
      margin: "8px 0",
      boxShadow: "0 1px 3px #0002",
      display: "flex",
      alignItems: "center",
      cursor: "grab"
    }
  }
};

export const getDragHandlers = (preventDefault = true, stopPropagation = false) => ({
  onDragOver: (e: React.DragEvent) => {
    if (preventDefault) e.preventDefault();
    if (stopPropagation) e.stopPropagation();
  },
  onDrop: (e: React.DragEvent) => {
    if (preventDefault) e.preventDefault();
    if (stopPropagation) e.stopPropagation();
  }
});