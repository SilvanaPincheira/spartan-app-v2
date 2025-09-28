"use client";

import { useEffect, useState } from "react";

/* ===== Helpers ===== */
function money(v: any) {
  if (v == null || v === "") return "—";
  const s = String(v).replace(/\./g, "").replace(/,/g, "").trim();
  const n = Number(s);
  if (!isFinite(n) || n === 0) return "$0";
  return n.toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

type Cliente = {
  rut_cliente: string;
  nombre_cliente: string;
  empleado_ventas: string;
  ventas_quimicos_2025: string;
  comodatos_activos_2021: string;
  alerta_final: string;
  email_col: string;
};

export default function AlertasClientesComodatos() {
  const [data, setData] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroAlerta, setFiltroAlerta] = useState("Todos");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/kpi/alertas-clientes-comodatos");
        const json = await res.json();
        setData(json.data || []);
      } catch (err) {
        console.error("❌ Error cargando API Alertas:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = data.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch =
      r.rut_cliente?.toLowerCase().includes(q) ||
      r.nombre_cliente?.toLowerCase().includes(q) ||
      r.empleado_ventas?.toLowerCase().includes(q);

    const matchFiltro =
      filtroAlerta === "Todos" || r.alerta_final?.toUpperCase() === filtroAlerta.toUpperCase();

    return matchSearch && matchFiltro;
  });

  // Totales
  const totalVentas = filtered.reduce((acc, c) => {
    const s = String(c.ventas_quimicos_2025 || "").replace(/\./g, "").replace(/,/g, "");
    return acc + (parseInt(s) || 0);
  }, 0);

  const totalComodatos = filtered.reduce((acc, c) => {
    const s = String(c.comodatos_activos_2021 || "").replace(/\./g, "").replace(/,/g, "");
    return acc + (parseInt(s) || 0);
  }, 0);

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-[#2B6CFF] mb-4">
        🚨 Alertas Clientes con Comodatos (desde 2023) sin ventas PT últimos 6M
      </h1>

      {/* Buscador + Filtro */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Buscar cliente, RUT o ejecutivo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded border px-3 py-2 text-sm"
        />
        <select
          value={filtroAlerta}
          onChange={(e) => setFiltroAlerta(e.target.value)}
          className="rounded border px-2 py-2 text-sm"
        >
          <option value="Todos">Todos</option>
          <option value="ALERTA">Alerta</option>
          <option value="OK">OK</option>
          <option value="SIN COMODATO">Sin Comodato</option>
        </select>
      </div>

      {loading ? (
        <p>Cargando…</p>
      ) : filtered.length === 0 ? (
        <p className="text-green-600 font-medium">
          ✅ No hay clientes con comodato vigente e inactivos en ventas PT
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border">
            <thead className="bg-zinc-100">
              <tr>
                <th className="px-2 py-1 text-left">RUT</th>
                <th className="px-2 py-1 text-left">Cliente</th>
                <th className="px-2 py-1 text-left">Ejecutivo</th>
                <th className="px-2 py-1 text-right">Ventas Químicos 2025</th>
                <th className="px-2 py-1 text-right">Comodatos Activos ≥2021</th>
                <th className="px-2 py-1 text-left">Alerta</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr
                  key={i}
                  className={`border-t ${
                    c.alerta_final?.toUpperCase() === "ALERTA" ? "bg-red-100" : ""
                  }`}
                >
                  <td className="px-2 py-1">{c.rut_cliente}</td>
                  <td className="px-2 py-1">{c.nombre_cliente}</td>
                  <td className="px-2 py-1">{c.empleado_ventas}</td>
                  <td className="px-2 py-1 text-right">{money(c.ventas_quimicos_2025)}</td>
                  <td className="px-2 py-1 text-right">{money(c.comodatos_activos_2021)}</td>
                  <td className="px-2 py-1">{c.alerta_final}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-zinc-100 font-semibold">
              <tr>
                <td colSpan={3} className="px-2 py-1 text-right">
                  Totales:
                </td>
                <td className="px-2 py-1 text-right">{money(totalVentas)}</td>
                <td className="px-2 py-1 text-right">{money(totalComodatos)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
