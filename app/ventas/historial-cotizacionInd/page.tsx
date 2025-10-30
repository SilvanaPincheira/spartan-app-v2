"use client";
import { useEffect, useState } from "react";

export default function HistorialCotizacionesPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4 text-[#2B6CFF]">📚 Historial de Cotizaciones</h1>

      {loading ? (
        <p className="text-gray-500 text-sm">Cargando cotizaciones...</p>
      ) : data.length === 0 ? (
        <p className="text-gray-500 text-sm">No tienes cotizaciones registradas.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-2 py-1 text-left">N° CTZ</th>
                <th className="border px-2 py-1 text-left">Fecha</th>
                <th className="border px-2 py-1 text-left">Cliente</th>
                <th className="border px-2 py-1 text-right">Total (con IVA)</th>
                <th className="border px-2 py-1 text-left">Validez</th>
                <th className="border px-2 py-1 text-left">Forma de Pago</th>
              </tr>
            </thead>
            <tbody>
              {data.map((c: any, i) => (
                <tr key={i} className="hover:bg-blue-50 transition">
                  <td className="border px-2 py-1">{c.numero_ctz}</td>
                  <td className="border px-2 py-1">{c.fecha}</td>
                  <td className="border px-2 py-1">{c.cliente}</td>
                  <td className="border px-2 py-1 text-right">
                    {Number(c["total_(con_iva)"] || 0).toLocaleString("es-CL")}
                  </td>
                  <td className="border px-2 py-1">{c.validez}</td>
                  <td className="border px-2 py-1">{c.forma_de_pago}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
