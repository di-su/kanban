import React from "react";

interface DeleteButtonProps {
  onClick: () => void;
  title?: string;
}

export default function DeleteButton({ onClick, title = "Delete" }: DeleteButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        marginLeft: 8,
        background: "#fee",
        border: "1px solid #f99",
        borderRadius: 4,
        padding: "2px 6px",
        cursor: "pointer",
        fontSize: "16px",
        lineHeight: "1"
      }}
      title={title}
    >
      ×
    </button>
  );
}