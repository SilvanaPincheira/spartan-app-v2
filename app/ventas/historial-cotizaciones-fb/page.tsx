"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";

/* ===================== Tipos ===================== */
type Cotizacion = {
  fecha?: string;
  cliente?: string;
  rut?: string;
  codigo_cliente?: string;
  direccion?: string;
  condicion_pago?: string;
  giro?: string;
  ejecutivo?: string;
  email_ejecutivo?: string;
  celular_ejecutivo?: string;
  forma_de_pago?: string;
  validez?: string;
  codigo_producto?: string;
  descripcion?: string;
  kg?: string;
  cantidad?: string;
  precio_unitariopresentacion?: string;
  descuento?: string;
  total_item?: string;
  subtotal?: string;
  iva_19?: string;
  total_con_iva?: string;
};

/* ===================== Helpers ===================== */
const normalize = (s: string = "") =>
  s.normalize("NFD").replace(/\p{Diacritic}+/gu, "").toLowerCase();

const money = (n?: string | number) => {
  const num = typeof n === "string" ? Number(n.replace(/[^\d.-]/g, "")) : n || 0;
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

  /* === Cargar datos desde API === */
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

  /* === Filtrado === */
  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = normalize(search);
    return data.filter(
      (r) =>
        normalize(r.cliente || "").includes(q) ||
        normalize(r.rut || "").includes(q) ||
        normalize(r.ejecutivo || "").includes(q)
    );
  }, [data, search]);

  /* === Agrupar por cliente + fecha === */
  const grouped = useMemo(() => {
    const map = new Map<string, Cotizacion[]>();
    for (const r of filtered) {
      const key = `${r.fecha}__${r.cliente}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries()).map(([key, rows]) => {
      const [fecha, cliente] = key.split("__");
      return { fecha, cliente, items: rows };
    });
  }, [filtered]);

  return (
    <div className="p-6 bg-white min-h-screen">
      {/* Encabezado */}
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
          placeholder="Buscar por cliente, RUT o ejecutivo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded px-3 py-1 w-80"
        />
        {loading && <span className="text-sm text-zinc-500">Cargando...</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>

      {/* Tabla principal */}
      {grouped.length === 0 ? (
        <p className="text-zinc-600 text-sm mt-6">
          No se encontraron cotizaciones.
        </p>
      ) : (
        <div className="space-y-6">
          {grouped.map((g, i) => {
            const total = g.items[0]?.total_con_iva;
            const ejecutivo = g.items[0]?.ejecutivo;
            return (
              <div
                key={i}
                className="border rounded shadow-sm bg-zinc-50 hover:bg-zinc-100 transition"
              >
                <div className="flex justify-between items-center px-4 py-2 border-b bg-white">
                  <div>
                    <div className="font-semibold text-blue-700">
                      {g.cliente}
                    </div>
                    <div className="text-xs text-zinc-500">
                      Fecha: {g.fecha} · Ejecutivo: {ejecutivo}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-zinc-700">
                      {money(total)}
                    </div>
                    <div className="flex gap-2 justify-end mt-1">
                      <Link
                        href={`/ventas/cotizacion?ver=${encodeURIComponent(
                          g.items[0]?.codigo_cliente || ""
                        )}`}
                        className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                      >
                        Ver
                      </Link>
                      <Link
                        href={`/ventas/cotizacion?duplicar=${encodeURIComponent(
                          g.items[0]?.codigo_cliente || ""
                        )}`}
                        className="text-xs bg-emerald-600 text-white px-2 py-1 rounded hover:bg-emerald-700"
                      >
                        Duplicar
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Tabla interna */}
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
                    {g.items.map((r, j) => (
                      <tr key={j} className="border-t hover:bg-white">
                        <td className="px-2 py-1">{r.codigo_producto}</td>
                        <td className="px-2 py-1">{r.descripcion}</td>
                        <td className="px-2 py-1 text-right">{r.kg}</td>
                        <td className="px-2 py-1 text-right">{r.cantidad}</td>
                        <td className="px-2 py-1 text-right">
                          {money(r.precio_unitariopresentacion)}
                        </td>
                        <td className="px-2 py-1 text-right">{r.descuento}</td>
                        <td className="px-2 py-1 text-right">
                          {money(r.total_item)}
                        </td>
                      </tr>
                    ))}
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
