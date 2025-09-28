"use client";

import { useEffect, useState } from "react";

export default function AlertasClientesComodatosPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/kpi/alertas-clientes-comodatos", {
          cache: "no-store",
        });
        const json = await res.json();
        setData(json.data || []);
      } catch (err) {
        console.error("🔥 Error al cargar KPI:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalComodatos = data.reduce(
    (acc, d) => acc + (d.comodato || 0),
    0
  );

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-[#2B6CFF] mb-4">
        📊 Clientes con Comodatos vigentes (≥2023) sin ventas PT últimos 6M
      </h1>

      {loading ? (
        <p>Cargando…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border">
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
              {data.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center py-3 text-zinc-500"
                  >
                    ✅ No hay clientes con comodatos vigentes e inactivos en
                    ventas PT
                  </td>
                </tr>
              )}
              {data.map((d, i) => (
                <tr key={i} className="border-t">
                  <td className="px-2 py-1">{d.rut}</td>
                  <td className="px-2 py-1">{d.cliente}</td>
                  <td className="px-2 py-1">{d.email || "—"}</td>
                  <td className="px-2 py-1">{d.ejecutivo || "—"}</td>
                  <td className="px-2 py-1 text-right">
                    {d.comodato?.toLocaleString("es-CL")}
                  </td>
                  <td className="px-2 py-1">{d.ultimaCompra}</td>
                </tr>
              ))}
            </tbody>
            {data.length > 0 && (
              <tfoot className="bg-zinc-100 font-bold">
                <tr>
                  <td colSpan={4} className="px-2 py-1 text-right">
                    Total
                  </td>
                  <td className="px-2 py-1 text-right">
                    {totalComodatos.toLocaleString("es-CL")}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
