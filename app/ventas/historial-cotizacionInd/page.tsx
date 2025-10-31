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
              </tr>
            </thead>
            <tbody>
              {filtradas.map((c, i) => (
                <tr
                  key={i}
                  className="hover:bg-blue-50 transition cursor-pointer"
                  onClick={() => alert(`Abrir detalle de ${c.numero_ctz}`)}
                >
                  <td className="border px-3 py-2">{c.numero_ctz}</td>
                  <td className="border px-3 py-2">{c.fecha}</td>
                  <td className="border px-3 py-2">{c.cliente}</td>
                  <td className="border px-3 py-2">{c.rut}</td>
                  <td className="border px-3 py-2 text-right">
                    {Number(c["total_(con_iva)"] || 0).toLocaleString("es-CL")}
                  </td>
                  <td className="border px-3 py-2">{c.validez}</td>
                  <td className="border px-3 py-2">{c.forma_de_pago}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
