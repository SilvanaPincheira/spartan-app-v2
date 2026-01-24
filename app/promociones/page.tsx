"use client";

import Link from "next/link";

export default function PromocionesPage() {
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 20 }}>
        Promociones
      </h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: 20,
        }}
      >
        {/* CARD MÁQUINAS */}
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 18,
            padding: 20,
            background: "white",
            boxShadow: "0 4px 10px rgba(0,0,0,0.04)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: "#2563eb",
                marginBottom: 10,
              }}
            >
              Máquinas
            </div>

            <div style={{ opacity: 0.85, fontSize: 14 }}>
              Equipos disponibles para promociones comerciales, demostraciones
              y apoyo en cierre de ventas.
            </div>
          </div>

          <Link
            href="/promociones/maquinas"
            style={{
              marginTop: 16,
              color: "#2563eb",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Entrar →
          </Link>
        </div>

        {/* CARD PAPELES */}
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 18,
            padding: 20,
            background: "white",
            boxShadow: "0 4px 10px rgba(0,0,0,0.04)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: "#2563eb",
                marginBottom: 10,
              }}
            >
              Papeles
            </div>

            <div style={{ opacity: 0.85, fontSize: 14 }}>
              Productos de papel y consumibles disponibles en condiciones
              promocionales vigentes.
            </div>
          </div>

          <Link
            href="/promociones/papeles"
            style={{
              marginTop: 16,
              color: "#2563eb",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Entrar →
          </Link>
        </div>
      </div>
    </div>
  );
}
