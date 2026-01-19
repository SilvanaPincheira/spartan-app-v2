"use client";

import React, { useState } from "react";

interface Props {
  open: boolean;
  folio: string;
  historial: string;
  onClose: () => void;
  onGuardar: (texto: string) => Promise<void>;
}

export default function ModalGestionObservacion({
  open,
  folio,
  historial,
  onClose,
  onGuardar,
}: Props) {
  const [texto, setTexto] = useState("");

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(720px, 100%)",
          background: "white",
          borderRadius: 14,
          border: "1px solid #e5e7eb",
          boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: 14, borderBottom: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 16, fontWeight: 900 }}>Gestión / Observación</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            Folio: <b>{folio}</b>
          </div>
        </div>

        <div style={{ padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>
            Historial
          </div>
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: 10,
              background: "#fafafa",
              maxHeight: 220,
              overflowY: "auto",
              whiteSpace: "pre-wrap",
              fontSize: 12,
            }}
          >
            {historial?.trim() ? historial : "— Sin historial —"}
          </div>
        </div>

        <div style={{ padding: 14 }}>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={6}
            placeholder="Escribe una nueva gestión (se agrega al historial)…"
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #d1d5db",
            }}
          />
        </div>

        <div
          style={{
            padding: 14,
            borderTop: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
          }}
        >
          <button onClick={onClose}>Cancelar</button>
          <button
            onClick={() => {
              onGuardar(texto);
              setTexto("");
            }}
            style={{
              background: "#111827",
              color: "white",
              padding: "10px 12px",
              borderRadius: 10,
            }}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
