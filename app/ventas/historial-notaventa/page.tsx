"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRouter } from "next/navigation";

export default function HistorialNotasVenta() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [notas, setNotas] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const email = session?.user?.email || null;
      setUserEmail(email);

      try {
        const res = await fetch("/api/historial-notaventa");
        const json = await res.json();

        if (!json.ok) throw new Error(json.error);
        let data = json.data || [];

        // 🔒 Filtra por login
        if (email) {
          const usuario = email.split("@")[0].toLowerCase();
          data = data.filter(
            (n: any) =>
              n.ejecutivo?.toLowerCase().includes(usuario) ||
              n.ejecutivo?.toLowerCase().includes(email.toLowerCase())
          );
        }

        setNotas(data);
      } catch (e: any) {
        console.error(e);
        setError("No se pudo obtener las Notas de Venta");
      }
    })();
  }, [supabase]);

  const notasFiltradas = notas.filter(
    (n) =>
      n.numeroNV?.toLowerCase().includes(busqueda.toLowerCase()) ||
      n.cliente?.toLowerCase().includes(busqueda.toLowerCase()) ||
      n.ejecutivo?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-2xl font-bold text-blue-600 mb-4 flex items-center gap-2">
        🧾 Historial de Notas de Venta
      </h1>

      <input
        type="text"
        placeholder="Buscar por cliente, ejecutivo o N° NV..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        className="w-full max-w-xl mb-4 border border-gray-300 rounded-md p-2 shadow-sm"
      />

      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 rounded p-3 mb-4">
          {error}
        </div>
      )}

      {notasFiltradas.length === 0 && !error ? (
        <p className="text-gray-500 text-sm">No hay resultados que coincidan.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border bg-white rounded-lg shadow-sm text-sm">
            <thead className="bg-gray-100 text-gray-700 font-semibold">
              <tr>
                <th className="border p-2 text-left">N° NV</th>
                <th className="border p-2 text-left">Fecha</th>
                <th className="border p-2 text-left">Cliente</th>
                <th className="border p-2 text-left">RUT</th>
                <th className="border p-2 text-left">Ejecutivo</th>
                <th className="border p-2 text-right">Total</th>
                <th className="border p-2 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {notasFiltradas.map((n, i) => (
                <tr key={i} className="border-t hover:bg-blue-50 transition-colors">
                  <td className="p-2">{n.numeroNV}</td>
                  <td className="p-2">{n.fecha}</td>
                  <td className="p-2">{n.cliente}</td>
                  <td className="p-2">{n.rut}</td>
                  <td className="p-2">{n.ejecutivo}</td>
                  <td className="p-2 text-right">{n.total}</td>
                  <td className="p-2 text-center">
                    <button
                      onClick={() => router.push(`/ventas/notaventas?nv=${n.numeroNV}`)}
                      className="text-blue-600 hover:underline mr-2"
                    >
                      Abrir
                    </button>
                    <button
                      onClick={() => router.push(`/ventas/notaventas?duplicar=${n.numeroNV}`)}
                      className="text-emerald-600 hover:underline"
                    >
                      Duplicar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
