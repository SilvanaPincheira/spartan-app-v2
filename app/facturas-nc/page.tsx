"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

/* ===================== HELPERS ===================== */
function parseCsv(text: string): Record<string, string>[] {
  const rows = text.split("\n").map((r) => r.split(","));
  const headers = rows[0];
  return rows.slice(1).map((r) =>
    Object.fromEntries(r.map((v, i) => [headers[i]?.trim(), v?.trim()]))
  );
}

async function fetchCsv(spreadsheetId: string, gid: string) {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`CSV ${res.status}`);
  return parseCsv(await res.text());
}

function money(n: any) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "-";
  return v.toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}

/* ===================== COMPONENTE ===================== */
export default function FacturasNCPage() {
  const [session, setSession] = useState<any>(null);
  const [data, setData] = useState<Record<string, string>[]>([]);
  const [filtered, setFiltered] = useState<Record<string, string>[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [detalle, setDetalle] = useState<Record<string, string>[] | null>(null);

  /* ---- Inicializar sesión ---- */
  useEffect(() => {
    const supabase = createClientComponentClient();
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });
  }, []);

  /* ---- Cargar CSV ---- */
  useEffect(() => {
    (async () => {
      const { id, gid } = {
        id: "1MY531UHJDhxvHsw6-DwlW8m4BeHwYP48MUSV98UTc1s",
        gid: "871602912",
      };
      const rows = await fetchCsv(id, gid);
      setData(rows);
    })().catch((e) => console.error(e));
  }, []);

  /* ---- Filtrado ---- */
  useEffect(() => {
    if (!data.length) return;

    let f = [...data];

    // filtrar por usuario logueado (Empleado Ventas)
    if (session?.user?.email) {
      f = f.filter(
        (r) =>
          r["Empleado Ventas"]?.toLowerCase() ===
          session.user.email.toLowerCase()
      );
    }

    // filtro búsqueda
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      f = f.filter(
        (r) =>
          r["Codigo Cliente"]?.toLowerCase().includes(q) ||
          r["Nombre Cliente"]?.toLowerCase().includes(q) ||
          r["FolioNum"]?.toLowerCase().includes(q) ||
          r["RUT"]?.toLowerCase().includes(q)
      );
    }

    setFiltered(f);
  }, [data, session, busqueda]);

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">🧾 Facturas y Notas de Crédito</h1>

      {/* Filtro búsqueda */}
      <input
        type="text"
        placeholder="Buscar por RUT, Cliente o Folio..."
        className="border rounded px-3 py-2 mb-4 w-full"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      {/* Tabla principal */}
      <div className="overflow-x-auto">
        <table className="min-w-full border text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-2 py-1 border">Tipo DTE</th>
              <th className="px-2 py-1 border">Periodo</th>
              <th className="px-2 py-1 border">Empleado Ventas</th>
              <th className="px-2 py-1 border">Código Cliente</th>
              <th className="px-2 py-1 border">Nombre Cliente</th>
              <th className="px-2 py-1 border">Dirección</th>
              <th className="px-2 py-1 border">Comuna</th>
              <th className="px-2 py-1 border">Ciudad</th>
              <th className="px-2 py-1 border">Folio</th>
              <th className="px-2 py-1 border">Global Venta</th>
              <th className="px-2 py-1 border">Acción</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="px-2 py-1 border">{r["Tipo_DTE"]}</td>
                <td className="px-2 py-1 border">{r["Periodo"]}</td>
                <td className="px-2 py-1 border">{r["Empleado Ventas"]}</td>
                <td className="px-2 py-1 border">{r["Codigo Cliente"]}</td>
                <td className="px-2 py-1 border">{r["Nombre Cliente"]}</td>
                <td className="px-2 py-1 border">{r["Direccion"]}</td>
                <td className="px-2 py-1 border">{r["Comuna"]}</td>
                <td className="px-2 py-1 border">{r["Ciudad"]}</td>
                <td className="px-2 py-1 border">{r["FolioNum"]}</td>
                <td className="px-2 py-1 border">{money(r["Global Venta"])}</td>
                <td className="px-2 py-1 border text-center">
                  <button
                    className="bg-blue-600 text-white text-xs px-2 py-1 rounded"
                    onClick={() =>
                      setDetalle([
                        {
                          ItemCode: r["ItemCode"],
                          Dscription: r["Dscription"],
                          Quantity: r["Quantity"],
                          CantidadKilos: r["Cantidad Kilos"],
                          GlobalVenta: r["Global Venta"],
                        },
                      ])
                    }
                  >
                    Detalle
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal detalle */}
      {detalle && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center">
          <div className="bg-white rounded p-6 w-2/3 max-w-2xl shadow-lg">
            <h2 className="text-lg font-bold mb-4">📄 Detalle</h2>
            <table className="min-w-full border text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-2 py-1 border">ItemCode</th>
                  <th className="px-2 py-1 border">Descripción</th>
                  <th className="px-2 py-1 border">Cantidad</th>
                  <th className="px-2 py-1 border">Cantidad Kilos</th>
                  <th className="px-2 py-1 border">Global Venta</th>
                </tr>
              </thead>
              <tbody>
                {detalle.map((d, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-2 py-1 border">{d.ItemCode}</td>
                    <td className="px-2 py-1 border">{d.Dscription}</td>
                    <td className="px-2 py-1 border">{d.Quantity}</td>
                    <td className="px-2 py-1 border">{d.CantidadKilos}</td>
                    <td className="px-2 py-1 border">{money(d.GlobalVenta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 text-right">
              <button
                className="bg-red-500 text-white px-3 py-1 rounded"
                onClick={() => setDetalle(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
