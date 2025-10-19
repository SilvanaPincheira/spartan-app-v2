"use client";

import { useEffect, useState } from "react";

type NotaVenta = {
  numeroNV: string;
  fechaHora?: string;
  cliente: string;
  rut: string;
  codigoCliente: string;
  ejecutivo: string;
  total?: number;
};

export default function HistorialNotaVentaPage() {
  const [notas, setNotas] = useState<NotaVenta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    async function cargarNotas() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/historial-notaventa");
        
        if (!res.ok) throw new Error("No se pudo obtener las Notas de Venta");
        const data = await res.json();

        // Ajusta si tu API devuelve data.data o data directamente
        const filas = data?.data || data;
        setNotas(filas || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    cargarNotas();
  }, []);

  const notasFiltradas = notas.filter((n) => {
    const q = busqueda.toLowerCase();
    return (
      n.numeroNV?.toLowerCase().includes(q) ||
      n.cliente?.toLowerCase().includes(q) ||
      n.ejecutivo?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      <h1 className="text-2xl font-bold text-blue-600 mb-4">
        📜 Historial de Notas de Venta
      </h1>

      <div className="mb-4 flex gap-2">
        <input
          type="text"
          placeholder="Buscar por cliente, ejecutivo o NV..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="border rounded-md px-3 py-2 w-full"
        />
      </div>

      {loading && <p>Cargando notas...</p>}
      {error && (
        <p className="text-red-600 bg-red-50 p-2 rounded">{error}</p>
      )}

      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="min-w-full border border-zinc-200 bg-white rounded-lg text-sm">
            <thead className="bg-zinc-100">
              <tr>
                <th className="px-3 py-2 text-left">N° Nota Venta</th>
                <th className="px-3 py-2 text-left">Fecha / Hora</th>
                <th className="px-3 py-2 text-left">Cliente</th>
                <th className="px-3 py-2 text-left">Ejecutivo</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {notasFiltradas.map((n, i) => (
                <tr key={i} className="border-t hover:bg-zinc-50">
                  <td className="px-3 py-2">{n.numeroNV}</td>
                  <td className="px-3 py-2">{n.fechaHora || "—"}</td>
                  <td className="px-3 py-2">{n.cliente}</td>
                  <td className="px-3 py-2">{n.ejecutivo}</td>
                  <td className="px-3 py-2 text-right">
                    {n.total
                      ? n.total.toLocaleString("es-CL", {
                          style: "currency",
                          currency: "CLP",
                        })
                      : "—"}
                  </td>
                </tr>
              ))}

              {notasFiltradas.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-4 text-gray-500">
                    No hay registros que coincidan con la búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
