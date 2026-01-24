"use client";

import { PAPELES_PROMO } from "./data";

function formatCLP(n: number) {
  return n.toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}

export default function PromocionesPapelesPage() {
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>
        Promociones · Papeles
      </h1>

      <div style={{ opacity: 0.8, marginBottom: 20 }}>
        Productos de papel disponibles para promoción comercial.
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 16,
        }}
      >
        {PAPELES_PROMO.map((p) => (
          <div
            key={p.codigo}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 14,
              padding: 14,
              background: "white",
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {/* Imagen descargable */}
            <a
              href={p.imagen}
              download
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: "none" }}
            >
              <div
                style={{
                  height: 220,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#f9fafb",
                  borderRadius: 10,
                  cursor: "pointer",
                }}
              >
                <img
                  src={p.imagen}
                  alt={p.nombre}
                  style={{
                    maxHeight: "100%",
                    maxWidth: "100%",
                    objectFit: "contain",
                  }}
                />
              </div>
            </a>

            <div
              style={{
                fontSize: 11,
                color: "#2563eb",
                textAlign: "center",
              }}
            >
              Descargar imagen
            </div>

            {/* Nombre */}
            <div
              style={{
                fontWeight: 800,
                fontSize: 14,
                textAlign: "justify",
              }}
            >
              {p.nombre}
            </div>

            {/* Código */}
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              Código: <b>{p.codigo}</b>
            </div>

            {/* Precio */}
            <div
              style={{
                marginTop: "auto",
                fontSize: 16,
                fontWeight: 900,
                color: "#0f172a",
              }}
            >
              {formatCLP(p.precio)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
