"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

/* ===================== Tipos ===================== */
type Cotizacion = {
  "Número CTZ"?: string;
  Fecha?: string;
  Cliente?: string;
  RUT?: string;
  "Código Cliente"?: string;
  Dirección?: string;
  "Condición Pago"?: string;
  Giro?: string;
  Ejecutivo?: string;
  "Email Ejecutivo"?: string;
  "Celular Ejecutivo"?: string;
  "Forma de Pago"?: string;
  Validez?: string;
  "Código Producto"?: string;
  Descripción?: string;
  Kg?: string;
  Cantidad?: string;
  "Precio Unitario/Presentación"?: string;
  Descuento?: string;
  "Total Ítem"?: string;
  Subtotal?: string;
  "IVA (19%)"?: string;
  "Total (con IVA)"?: string;
};

/* ===================== Helpers ===================== */
const normalize = (s: string = "") =>
  s.normalize("NFD").replace(/\p{Diacritic}+/gu, "").toLowerCase();

const money = (n?: string | number) => {
  const num =
    typeof n === "string"
      ? Number(n.replace(/[^\d.-]/g, "")) || 0
      : n || 0;
  return num.toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
};

/* ===================== Componente principal ===================== */
export default function HistorialCotizacionesFB() {
  const [data, setData] = useState<Cotizacion[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* ==== Cargar datos desde API ==== */
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/cotizaciones-fb");
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || "Error en respuesta API");
        setData(json.data);
      } catch (e: any) {
        setError(e.message || "Error cargando cotizaciones");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ==== Filtrar ==== */
  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = normalize(search);
    return data.filter(
      (r) =>
        normalize(r.Cliente || "").includes(q) ||
        normalize(r.RUT || "").includes(q) ||
        normalize(r.Ejecutivo || "").includes(q) ||
        normalize(r["Código Producto"] || "").includes(q) ||
        normalize(r.Descripción || "").includes(q)
    );
  }, [data, search]);

  /* ==== Agrupar por número de cotización ==== */
  const grouped = useMemo(() => {
    const map = new Map<string, Cotizacion[]>();
    for (const r of filtered) {
      const key = r["Número CTZ"] || r["Código Cliente"] || "SIN_NUMERO";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries()).map(([key, rows]) => {
      const primera = rows[0];
      return {
        numero: primera["Número CTZ"] || key,
        fecha: primera.Fecha,
        cliente: primera.Cliente,
        rut: primera.RUT,
        ejecutivo: primera.Ejecutivo,
        total: primera["Total (con IVA)"],
        items: rows,
      };
    });
  }, [filtered]);

  /* ===================== RENDER ===================== */
  return (
    <div className="p-6 bg-white min-h-screen">
      {/* Encabezado */}
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-blue-700 flex items-center gap-2">
          📑 Historial de Cotizaciones F&B
        </h1>
        <Link
          href="/ventas/cotizacion"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm shadow"
        >
          + Nueva Cotización
        </Link>
      </header>

      {/* Buscador */}
      <div className="flex items-center gap-2 mb-5">
        <input
          type="text"
          placeholder="Buscar por cliente, RUT, ejecutivo o producto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded px-3 py-1 w-96"
        />
        {loading && <span className="text-sm text-zinc-500">Cargando...</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>

      {/* Tabla principal */}
      <div className="overflow-x-auto border rounded shadow-sm">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-blue-700 text-white">
            <tr>
              <th className="px-2 py-1 text-left">N° Cotización</th>
              <th className="px-2 py-1 text-left">Fecha</th>
              <th className="px-2 py-1 text-left">Cliente</th>
              <th className="px-2 py-1 text-left">RUT</th>
              <th className="px-2 py-1 text-left">Ejecutivo</th>
              <th className="px-2 py-1 text-right">Total</th>
              <th className="px-2 py-1 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map((g, i) => (
              <tr
                key={i}
                className="border-b hover:bg-blue-50 transition cursor-pointer"
              >
                <td className="px-2 py-1 font-semibold text-blue-700">
                  {g.numero}
                </td>
                <td className="px-2 py-1">{g.fecha}</td>
                <td className="px-2 py-1">{g.cliente}</td>
                <td className="px-2 py-1">{g.rut}</td>
                <td className="px-2 py-1">{g.ejecutivo}</td>
                <td className="px-2 py-1 text-right">{money(g.total)}</td>
                <td className="px-2 py-1 text-center">
                  <Link
                    href={`/ventas/cotizacion?ver=${encodeURIComponent(
                      g.numero || ""
                    )}`}
                    className="text-blue-600 hover:underline mr-2"
                  >
                    Ver
                  </Link>
                  <Link
                    href={`/ventas/cotizacion?duplicar=${encodeURIComponent(
                      g.numero || ""
                    )}`}
                    className="text-emerald-600 hover:underline"
                  >
                    Duplicar
                  </Link>
                </td>
              </tr>
            ))}
            {grouped.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="text-center py-4 text-zinc-500">
                  No se encontraron cotizaciones.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
