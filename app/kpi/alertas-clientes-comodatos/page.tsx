"use client";

import { useEffect, useState } from "react";

interface AlertaCliente {
  rut_cliente: string;
  nombre_cliente: string;
  empleado_ventas: string;
  ventas_quimicos_2025: string;
  comodatos_activos_2021: string;
  alerta_final: string;
  email_col: string;
}

export default function AlertasClientesComodatosPage() {
  const [data, setData] = useState<AlertaCliente[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/kpi/alertas-clientes-comodatos", {
          cache: "no-store",
        });
        const json = await res.json();
        if (json.data) setData(json.data);
      } catch (err) {
        console.error("❌ Error cargando alertas clientes:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-[#2B6CFF] mb-4">
        🚨 Alertas Clientes con Comodatos
      </h1>

      {loading ? (
        <p>Cargando…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border">
            <thead className="bg-zinc-100">
              <tr>
                <th className="px-2 py-1">RUT</th>
                <th className="px-2 py-1">Cliente</th>
                <th className="px-2 py-1">Ejecutivo</th>
                <th className="px-2 py-1 text-right">Ventas Químicos 2025</th>
                <th className="px-2 py-1 text-right">Comodatos Activos ≥2021</th>
                <th className="px-2 py-1">Alerta Final</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-3">
                    ✅ No hay alertas para tus clientes
                  </td>
                </tr>
              )}
              {data.map((d, i) => (
                <tr key={i} className="border-t">
                  <td className="px-2 py-1">{d.rut_cliente}</td>
                  <td className="px-2 py-1">{d.nombre_cliente}</td>
                  <td className="px-2 py-1">{d.empleado_ventas}</td>
                  <td className="px-2 py-1 text-right">{d.ventas_quimicos_2025}</td>
                  <td className="px-2 py-1 text-right">{d.comodatos_activos_2021}</td>
                  <td className="px-2 py-1">{d.alerta_final}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
