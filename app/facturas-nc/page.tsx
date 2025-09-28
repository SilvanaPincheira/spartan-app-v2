// app/facturas-nc/page.tsx
// -----------------------------------------------------------------------------
// FACTURAS Y NOTAS DE CRÉDITO — CLIENT COMPONENT (Next.js / React)
// -----------------------------------------------------------------------------
// ✔ Carga desde Google Sheets (CSV).
// ✔ Filtro por usuario logueado (EMAIL_COL).
// ✔ Admin (silvana.pincheira@spartan.cl) puede ver todo.
// ✔ Búsqueda por RUT, Cliente o Folio.
// ✔ Tabla principal: Tipo_DTE, Periodo, Empleado Ventas, Cliente, Folio, etc.
// ✔ Botón Detalle → abre modal con todas las líneas del Folio (ItemCode, Cantidad, etc).
// ✔ Formato CLP en Global Venta.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

/* ============================================================================
   [A] HELPERS
   ============================================================================ */
// Normaliza strings para comparación sin mayúsculas/acentos
function normalize(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// Convierte CSV plano a array de objetos
function parseCsv(text: string): Record<string, string>[] {
  const rows = text.replace(/\r/g, "").split("\n").map(r => r.split(","));
  if (!rows.length) return [];
  const headers = rows[0].map(h => h.trim());
  const out: Record<string, string>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(c => !c.trim())) continue;
    const obj: Record<string, string> = {};
    headers.forEach((h, j) => (obj[h] = (row[j] ?? "").trim()));
    out.push(obj);
  }
  return out;
}

// Formato moneda CLP
function money(n: any) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "-";
  return v.toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}

/* ============================================================================
   [B] COMPONENTE PRINCIPAL
   ============================================================================ */
export default function FacturasNCPage() {
  /* ----- Estado global ----- */
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [search, setSearch] = useState("");
  const [detalle, setDetalle] = useState<Record<string, string>[] | null>(null);
  const [userEmail, setUserEmail] = useState("");

  /* ----- Configuración ----- */
  const SHEET_URL =
    "https://docs.google.com/spreadsheets/d/1MY531UHJDhxvHsw6-DwlW8m4BeHwYP48MUSV98UTc1s/export?format=csv&gid=871602912";

  const ADMIN_EMAIL = "silvana.pincheira@spartan.cl";

  /* ==========================================================================
     [C] EFECTOS: carga de datos
     ========================================================================== */
  useEffect(() => {
    (async () => {
      try {
        // Leer usuario logueado
        const supabase = createClientComponentClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const me = (user?.email || "").toLowerCase().trim();
        setUserEmail(me);

        // Leer CSV
        const res = await fetch(SHEET_URL, { cache: "no-store" });
        const txt = await res.text();
        const data = parseCsv(txt);

        // Filtrar según EMAIL_COL
        const filtrado =
          me === ADMIN_EMAIL || !me
            ? data
            : data.filter(
                (r) => (r.EMAIL_COL || "").toLowerCase().trim() === me
              );

        setRows(filtrado);
      } catch (err) {
        console.error("Error cargando CSV:", err);
      }
    })();
  }, []);

  /* ==========================================================================
     [D] FILTRADO DE BÚSQUEDA
     ========================================================================== */
  const filtered = rows.filter((r) => {
    if (!search) return true;
    const s = normalize(search);
    return (
      normalize(r["Codigo Cliente"]).includes(s) ||
      normalize(r["Nombre Cliente"]).includes(s) ||
      normalize(r["Folio"]).includes(s) ||
      normalize(r["RUT Cliente"] || "").includes(s)
    );
  });

  /* ==========================================================================
     [E] RENDER
     ========================================================================== */
  return (
    <div className="p-6">
      {/* ===== Título ===== */}
      <h1 className="text-xl font-bold mb-4 flex items-center gap-2">
        📑 Facturas y Notas de Crédito
      </h1>

      {/* ===== Filtro ===== */}
      <input
        type="text"
        className="w-full border rounded px-3 py-2 mb-4"
        placeholder="Buscar por RUT, Cliente o Folio..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* ===== Tabla principal ===== */}
      <div className="overflow-x-auto">
        <table className="min-w-full border text-sm">
          <thead className="bg-zinc-100">
            <tr>
              <th className="px-2 py-1 border">Tipo DTE</th>
              <th className="px-2 py-1 border">Periodo</th>
              <th className="px-2 py-1 border">Empleado Ventas</th>
              <th className="px-2 py-1 border">Codigo Cliente</th>
              <th className="px-2 py-1 border">Nombre Cliente</th>
              <th className="px-2 py-1 border">Dirección</th>
              <th className="px-2 py-1 border">Comuna</th>
              <th className="px-2 py-1 border">Ciudad</th>
              <th className="px-2 py-1 border">Folio</th>
              <th className="px-2 py-1 border">Global Venta</th>
              <th className="px-2 py-1 border">Acción</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={i} className="border-t hover:bg-zinc-50">
                <td className="px-2 py-1 border">{r["Tipo_DTE"]}</td>
                <td className="px-2 py-1 border">{r["Periodo"]}</td>
                <td className="px-2 py-1 border">{r["Empleado Ventas"]}</td>
                <td className="px-2 py-1 border">{r["Codigo Cliente"]}</td>
                <td className="px-2 py-1 border">{r["Nombre Cliente"]}</td>
                <td className="px-2 py-1 border">{r["Direccion"]}</td>
                <td className="px-2 py-1 border">{r["Comuna"]}</td>
                <td className="px-2 py-1 border">{r["Ciudad"]}</td>
                <td className="px-2 py-1 border">{r["Folio"]}</td>
                <td className="px-2 py-1 border">
                  {money(r["Global Venta"])}
                </td>
                <td
                  className="px-2 py-1 border text-blue-600 underline cursor-pointer"
                  onClick={() =>
                    setDetalle(filtered.filter((x) => x["Folio"] === r["Folio"]))
                  }
                >
                  Detalle
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ===== Modal detalle ===== */}
      {detalle && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4">
          <div className="bg-white rounded shadow-lg max-w-4xl w-full p-6 relative">
            <button
              onClick={() => setDetalle(null)}
              className="absolute top-2 right-2 text-gray-600"
            >
              ✖
            </button>
            <h2 className="text-lg font-bold mb-4">
              Detalle — Folio {detalle[0]["Folio"]}
            </h2>

            <table className="min-w-full border text-sm">
              <thead className="bg-zinc-100">
                <tr>
                  <th className="px-2 py-1 border">ItemCode</th>
                  <th className="px-2 py-1 border">Dscription</th>
                  <th className="px-2 py-1 border">Quantity</th>
                  <th className="px-2 py-1 border">Cantidad Kilos</th>
                  <th className="px-2 py-1 border">Global Venta</th>
                </tr>
              </thead>
              <tbody>
                {detalle.map((d, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1 border">{d["ItemCode"]}</td>
                    <td className="px-2 py-1 border">{d["Dscription"]}</td>
                    <td className="px-2 py-1 border">{d["Quantity"]}</td>
                    <td className="px-2 py-1 border">{d["Cantidad Kilos"]}</td>
                    <td className="px-2 py-1 border">
                      {money(d["Global Venta"])}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
