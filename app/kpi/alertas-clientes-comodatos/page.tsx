"use client";

import { useEffect, useState } from "react";

export default function AlertasClientesComodatosPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/kpi/alertas-clientes-comodatos", { cache: "no-store" });
        const json = await res.json();
        setData(json.data || []);
      } catch (err) {
        console.error("❌ Error cargando KPI:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = data.filter((d) =>
    [d.rut, d.cliente, d.ejecutivo, d.email]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const totalComodato = filtered.reduce((acc, d) => acc + (d.comodato || 0), 0);

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-[#2B6CFF] mb-4">
        🚨 Alertas Clientes con Comodatos (desde 2023) sin ventas PT últimos 6M
      </h1>

      {/* 🔍 Buscador */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar cliente, RUT o ejecutivo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded border px-3 py-2 text-sm"
        />
      </div>

      {loading ? (
        <p>Cargando…</p>
      ) : filtered.length === 0 ? (
        <p className="text-center py-6 text-zinc-600">
          ✅ No hay clientes con comodato vigente e inactivos en ventas PT
        </p>
      ) : (
        <div className="overflow-x-auto rounded border">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-100">
              <tr>
                <th className="px-2 py-1 text-left">RUT</th>
                <th className="px-2 py-1 text-left">Cliente</th>
                <th className="px-2 py-1 text-left">Email</th>
                <th className="px-2 py-1 text-left">Ejecutivo</th>
                <th className="px-2 py-1 text-right">Comodatos desde 2023</th>
                <th className="px-2 py-1 text-left">Última compra</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d, i) => (
                <tr key={i} className="border-t hover:bg-zinc-50">
                  <td className="px-2 py-1">{d.rut}</td>
                  <td className="px-2 py-1">{d.cliente}</td>
                  <td className="px-2 py-1">{d.email}</td>
                  <td className="px-2 py-1">{d.ejecutivo || "—"}</td>
                  <td className="px-2 py-1 text-right">
                    {d.comodato.toLocaleString("es-CL")}
                  </td>
                  <td className="px-2 py-1">{d.ultimaCompra}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-zinc-100 font-bold">
              <tr>
                <td colSpan={4} className="px-2 py-1 text-right">
                  Total
                </td>
                <td className="px-2 py-1 text-right">
                  {totalComodato.toLocaleString("es-CL")}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
