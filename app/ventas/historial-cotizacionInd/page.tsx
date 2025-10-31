"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function HistorialCotizacionesPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/cotizaciones");
        const json = await res.json();
        setData(json.data || []);
      } catch (err) {
        console.error("Error cargando historial:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 🔍 Filtro de búsqueda
  const filtradas = data.filter((c) =>
    [c.numero_ctz, c.cliente, c.rut]
      .some((v) => v?.toLowerCase().includes(busqueda.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-white p-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#2B6CFF]">
          📚 Historial de Cotizaciones IND
        </h1>
        <Link href="/ventas" className="text-sm text-[#2B6CFF] hover:underline">
          ← Volver a Gestión de Ventas
        </Link>
      </div>

      {/* Filtro */}
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Buscar por cliente, CTZ o RUT..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="border px-3 py-2 rounded text-sm w-80"
        />
        <span className="text-sm text-zinc-500">
          {filtradas.length} resultado(s)
        </span>
      </div>

      {/* Tabla */}
      {loading ? (
        <p className="text-gray-500 text-sm">Cargando cotizaciones...</p>
      ) : filtradas.length === 0 ? (
        <p className="text-gray-500 text-sm">
          No tienes cotizaciones registradas.
        </p>
      ) : (
        <div className="overflow-x-auto border rounded-lg shadow-sm">
          <table className="w-full border text-sm">
            <thead className="bg-zinc-100 text-[#2B6CFF]">
              <tr>
                <th className="border px-3 py-2 text-left">N° CTZ</th>
                <th className="border px-3 py-2 text-left">Fecha</th>
                <th className="border px-3 py-2 text-left">Cliente</th>
                <th className="border px-3 py-2 text-left">RUT</th>
                <th className="border px-3 py-2 text-right">Total (con IVA)</th>
                <th className="border px-3 py-2 text-left">Validez</th>
                <th className="border px-3 py-2 text-left">Forma de Pago</th>
                <th className="border px-3 py-2 text-center">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {filtradas.map((c, i) => {
                const total = Number(
                  c.total ||
                  c["total_(con_iva)"] ||
                  c["total_item"] ||
                  c["monto_total"] ||
                  0
                );

                return (
                  <tr
                    key={i}
                    className="hover:bg-blue-50 transition"
                  >
                    <td className="border px-3 py-2">{c.numero_ctz}</td>
                    <td className="border px-3 py-2">{c.fecha}</td>
                    <td className="border px-3 py-2">{c.cliente}</td>
                    <td className="border px-3 py-2">{c.rut}</td>
                    <td className="border px-3 py-2 text-right">
                      {total.toLocaleString("es-CL", {
                        style: "currency",
                        currency: "CLP",
                        maximumFractionDigits: 0,
                      })}
                    </td>
                    <td className="border px-3 py-2">{c.validez}</td>
                    <td className="border px-3 py-2">{c.forma_pago || c.forma_de_pago}</td>
                    <td className="border px-3 py-2 text-center">
                      <div className="flex justify-center gap-2">
                        {/* 🔍 Ver Detalle */}
                        <Link
                          href={`/ventas/cotizacion-industrial?ver=${encodeURIComponent(
                            c.numero_ctz
                          )}`}
                          className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                        >
                          Ver
                        </Link>

                        {/* 📄 Duplicar */}
                        <Link
                          href={`/ventas/cotizacion-industrial?duplicar=${encodeURIComponent(
                            c.numero_ctz
                          )}`}
                          className="px-2 py-1 text-xs bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200"
                        >
                          Duplicar
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

