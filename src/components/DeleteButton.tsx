import React from "react";

interface DeleteButtonProps {
  onClick: () => void;
  title?: string;
  disabled?: boolean;
}

export default function DeleteButton({ onClick, title = "Delete", disabled }: DeleteButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        marginLeft: 8,
        background: "#fee",
        border: "1px solid #f99",
        borderRadius: 4,
        padding: "2px 6px",
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: "16px",
        lineHeight: "1",
        opacity: disabled ? 0.5 : 1
      }}
      title={title}
    >
      ×
    </button>
  );
}