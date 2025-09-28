// app/facturas-nc/page.tsx
"use client";

import React, { useEffect, useState } from "react";

/* ============================================================================
   Helpers
   ============================================================================ */
function normalize(s: string) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function money(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}

function parseCsv(text: string): Record<string, string>[] {
  const rows = text.replace(/\r/g, "").split("\n").map((r) => r.split(","));
  if (!rows.length) return [];
  const headers = rows[0].map((h) =>
    h.trim().toLowerCase().replace(/\s+/g, "_")
  );
  return rows.slice(1).map((r) =>
    Object.fromEntries(r.map((v, i) => [headers[i], (v ?? "").trim()]))
  );
}

async function fetchCsv(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  const text = await res.text();
  return parseCsv(text);
}

function normalizeGoogleSheetUrl(url: string) {
  const m = (url || "").match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const id = m ? m[1] : "";
  let gid = "0";
  const g = (url || "").match(/[?&#]gid=([0-9]+)/);
  if (g) gid = g[1];
  return { id, gid };
}

/* ============================================================================
   Component
   ============================================================================ */
export default function FacturasNCPage() {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [search, setSearch] = useState("");
  const [detalle, setDetalle] = useState<Record<string, string>[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { id, gid } = normalizeGoogleSheetUrl(
          "https://docs.google.com/spreadsheets/d/1MY531UHJDhxvHsw6-DwlW8m4BeHwYP48MUSV98UTc1s/edit?gid=871602912#gid=871602912"
        );
        if (!id) return;
        const url = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
        const data = await fetchCsv(url);
        setRows(data);
      } catch (e: any) {
        setError(e.message || "Error al cargar datos");
      }
    })();
  }, []);

  const filtrados = rows.filter((r) => {
    if (!search) return true;
    const s = normalize(search);
    return (
      normalize(r["rut_cliente"] || "").includes(s) ||
      normalize(r["nombre_cliente"] || "").includes(s) ||
      normalize(r["folionum"] || "").includes(s)
    );
  });

  return (
    <div className="p-6 bg-white min-h-screen">
      <h1 className="text-xl font-bold mb-4 flex items-center gap-2">
        📑 Facturas y Notas de Crédito
      </h1>

      <input
        type="text"
        placeholder="Buscar por RUT, Cliente o Folio..."
        className="border rounded px-3 py-2 w-full mb-4"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {error && <div className="text-red-600 mb-2">{error}</div>}

      <div className="overflow-x-auto">
        <table className="min-w-full border text-sm">
          <thead className="bg-zinc-100">
            <tr>
              <th className="px-2 py-1 border">Tipo DTE</th>
              <th className="px-2 py-1 border">Periodo</th>
              <th className="px-2 py-1 border">Empleado Ventas</th>
              <th className="px-2 py-1 border">Código Cliente</th>
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
            {filtrados.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="px-2 py-1 border">{r["tipo_dte"]}</td>
                <td className="px-2 py-1 border">{r["periodo"]}</td>
                <td className="px-2 py-1 border">{r["empleado_ventas"]}</td>
                <td className="px-2 py-1 border">{r["codigo_cliente"]}</td>
                <td className="px-2 py-1 border">{r["nombre_cliente"]}</td>
                <td className="px-2 py-1 border">{r["direccion"]}</td>
                <td className="px-2 py-1 border">{r["comuna"]}</td>
                <td className="px-2 py-1 border">{r["ciudad"]}</td>
                <td className="px-2 py-1 border">{r["folionum"]}</td>
                <td className="px-2 py-1 border">{money(r["global_venta"])}</td>
                <td className="px-2 py-1 border">
                  <button
                    className="text-blue-600 underline"
                    onClick={() =>
                      setDetalle(rows.filter((x) => x["folionum"] === r["folionum"]))
                    }
                  >
                    Detalle
                  </button>
                </td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={11} className="text-center py-4 text-zinc-500">
                  No se encontraron resultados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Detalle */}
      {detalle.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded p-6 max-w-3xl w-full shadow-lg">
            <h2 className="text-lg font-bold mb-4">
              Detalle — Folio {detalle[0]["folionum"]}
            </h2>
            <table className="min-w-full border text-sm mb-4">
              <thead className="bg-zinc-100">
                <tr>
                  <th className="px-2 py-1 border">ItemCode</th>
                  <th className="px-2 py-1 border">Descripción</th>
                  <th className="px-2 py-1 border">Cantidad</th>
                  <th className="px-2 py-1 border">Cantidad Kilos</th>
                  <th className="px-2 py-1 border">Global Venta</th>
                </tr>
              </thead>
              <tbody>
                {detalle.map((d, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1 border">{d["itemcode"]}</td>
                    <td className="px-2 py-1 border">{d["dscription"]}</td>
                    <td className="px-2 py-1 border">{d["quantity"]}</td>
                    <td className="px-2 py-1 border">{d["cantidad_kilos"]}</td>
                    <td className="px-2 py-1 border">{money(d["global_venta"])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              className="bg-red-500 text-white px-4 py-2 rounded"
              onClick={() => setDetalle([])}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
