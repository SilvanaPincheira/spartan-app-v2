"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

/* ===================== Tipos ===================== */
type Row = Record<string, string>;

type Grupo = {
  id: string;          // Número CTZ o Código Cliente
  fecha: string;
  cliente: string;
  ejecutivo: string;
  filas: Row[];        // todas las filas (ítems) de esa cotización
  totalConIva?: string;
};

/* ===================== Helpers ===================== */
const money = (n?: string | number) => {
  const num =
    typeof n === "string"
      ? Number(String(n).replace(/[^\d.-]/g, ""))
      : Number(n || 0);
  return num.toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
};

const norm = (s: string = "") =>
  s.normalize("NFD").replace(/\p{Diacritic}+/gu, "").toLowerCase();

function get<T extends Row>(r: T, keys: string[], def = ""): string {
  for (const k of keys) {
    const v = r[k];
    if (v !== undefined && String(v).trim() !== "") return String(v);
  }
  return def;
}

/* Preferencias de claves (API vieja con acentos vs API nueva snake_case) */
const K = {
  numero: ["Número CTZ", "numero_ctz", "n_ctz", "numero"],
  fecha: ["Fecha", "fecha"],
  cliente: ["Cliente", "cliente"],
  ejecutivo: ["Ejecutivo", "ejecutivo"],
  totalConIva: ["Total (con IVA)", "total_con_iva", "total"],
  codigoCliente: ["Código Cliente", "codigo_cliente", "cod_cliente"],

  cod: ["Código Producto", "codigo_producto", "codigo"],
  desc: ["Descripción", "descripcion", "producto"],
  kg: ["Kg", "kg"],
  cantidad: ["Cantidad", "cantidad"],
  precio: [
    "Precio Unitario/Presentación",
    "precio_unitario_presentacion",
    "precio_unitario",
    "precio",
  ],
  descuento: ["Descuento", "descuento", "desc_pct"],
  totalItem: ["Total Ítem", "total_item", "total_linea"],
};

export default function HistorialCotizacionesFB() {
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/cotizaciones-fb", { cache: "no-store" });
        const json = await res.json();
        if (!json?.ok) throw new Error(json?.error || "Error de API");
        setRows(json.data || []);
      } catch (e: any) {
        setError(e?.message || "No se pudo cargar el historial");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ---------- Filtro por texto ---------- */
  const filtradas = useMemo(() => {
    if (!search.trim()) return rows;
    const q = norm(search);
    return rows.filter((r) => {
      const cliente = get(r, K.cliente);
      const rut = get(r, ["RUT", "rut"]);
      const ejecutivo = get(r, K.ejecutivo);
      const codigo = get(r, K.cod);
      const desc = get(r, K.desc);
      return (
        norm(cliente).includes(q) ||
        norm(rut).includes(q) ||
        norm(ejecutivo).includes(q) ||
        norm(codigo).includes(q) ||
        norm(desc).includes(q)
      );
    });
  }, [rows, search]);

  /* ---------- Agrupar por Número CTZ (o Código Cliente si no hay) ---------- */
  const grupos: Grupo[] = useMemo(() => {
    const byKey = new Map<string, Grupo>();

    for (const r of filtradas) {
      const numero = get(r, K.numero);
      const fallback = get(r, K.codigoCliente);
      const id = numero || fallback || "SIN_ID";

      const fecha = get(r, K.fecha);
      const cliente = get(r, K.cliente);
      const ejecutivo = get(r, K.ejecutivo);
      const totalConIva = get(r, K.totalConIva);

      if (!byKey.has(id)) {
        byKey.set(id, {
          id,
          fecha,
          cliente,
          ejecutivo,
          filas: [],
          totalConIva,
        });
      }
      byKey.get(id)!.filas.push(r);
    }

    return Array.from(byKey.values());
  }, [filtradas]);

  return (
    <div className="p-6 bg-white min-h-screen">
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-blue-700">
          📜 Historial de Cotizaciones F&B
        </h1>
        <Link
          href="/ventas/cotizacion"
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm shadow"
        >
          + Nueva Cotización
        </Link>
      </header>

      {/* Buscador */}
      <div className="flex items-center gap-2 mb-4">
        <input
          type="text"
          placeholder="Buscar por cliente, RUT, ejecutivo, código o producto…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded px-3 py-1 w-[520px]"
        />
        {loading && <span className="text-sm text-zinc-500">Cargando…</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>

      {grupos.length === 0 ? (
        <p className="text-zinc-600 text-sm mt-6">
          No se encontraron cotizaciones.
        </p>
      ) : (
        <div className="space-y-6">
          {grupos.map((g, i) => {
            const verId = g.id; // Número CTZ o Código Cliente
            const total = g.totalConIva || get(g.filas[0], K.totalConIva, "0");

            return (
              <div
                key={i}
                className="border rounded shadow-sm bg-zinc-50 hover:bg-zinc-100 transition"
              >
                <div className="flex justify-between items-center px-4 py-2 border-b bg-white">
                  <div>
                    {/* Título: Número CTZ o Código Cliente */}
                    <div className="font-semibold text-blue-700">
                      {g.id}
                    </div>
                    <div className="text-xs text-zinc-500">
                      Fecha: {g.fecha || "—"} · Ejecutivo: {g.ejecutivo || "—"}
                    </div>
                    <div className="text-xs text-zinc-500">{g.cliente}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-zinc-700">
                      {money(total)}
                    </div>
                    <div className="flex gap-2 justify-end mt-1">
                      <Link
                        href={`/ventas/cotizacion?ver=${encodeURIComponent(
                          verId
                        )}`}
                        className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                      >
                        Ver
                      </Link>
                      <Link
                        href={`/ventas/cotizacion?duplicar=${encodeURIComponent(
                          verId
                        )}`}
                        className="text-xs bg-emerald-600 text-white px-2 py-1 rounded hover:bg-emerald-700"
                      >
                        Duplicar
                      </Link>
                    </div>
                  </div>
                </div>

                <table className="w-full text-xs border-t border-zinc-300">
                  <thead className="bg-blue-700 text-white">
                    <tr>
                      <th className="p-1 text-left">Código</th>
                      <th className="p-1 text-left">Descripción</th>
                      <th className="p-1 text-right">Kg</th>
                      <th className="p-1 text-right">Cantidad</th>
                      <th className="p-1 text-right">Precio</th>
                      <th className="p-1 text-right">Desc %</th>
                      <th className="p-1 text-right">Total Ítem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.filas.map((r, j) => {
                      const codigo = get(r, K.cod);
                      const desc = get(r, K.desc);
                      const kg = get(r, K.kg);
                      const cantidad = get(r, K.cantidad);
                      const precio = get(r, K.precio);
                      const descPct = get(r, K.descuento);
                      const totalItem = get(r, K.totalItem);

                      return (
                        <tr key={j} className="border-t hover:bg-white">
                          <td className="px-2 py-1">{codigo}</td>
                          <td className="px-2 py-1">{desc}</td>
                          <td className="px-2 py-1 text-right">{kg}</td>
                          <td className="px-2 py-1 text-right">{cantidad}</td>
                          <td className="px-2 py-1 text-right">
                            {money(precio)}
                          </td>
                          <td className="px-2 py-1 text-right">{descPct}</td>
                          <td className="px-2 py-1 text-right">
                            {money(totalItem)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      <style jsx>{`
        th {
          font-weight: 600;
        }
        table {
          border-collapse: collapse;
        }
      `}</style>
    </div>
  );
}

