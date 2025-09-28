"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

/* ===== Helpers ===== */
function normKey(k: string) {
  return (k || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function parseNumberCL(v: any): number {
  if (v == null) return 0;
  const s = String(v).replace(/\./g, "").replace(/,/g, "").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function money(v: any) {
  const n = parseNumberCL(v);
  if (n === 0) return "—";
  return n.toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

async function parseCsv(text: string): Promise<Record<string, string>[]> {
  const Papa = (await import("papaparse")).default;
  const out = Papa.parse(text, { header: true, skipEmptyLines: true });
  return out.data.map((row: any) => {
    const o: Record<string, any> = {};
    Object.keys(row || {}).forEach((k) => {
      o[normKey(k)] = row[k];
    });
    return o;
  });
}

async function fetchCsv(spreadsheetId: string, gid: string) {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
  const res = await fetch(url, { cache: "no-store" });
  const txt = await res.text();
  return parseCsv(txt);
}

/* ===== Page Component ===== */
export default function AlertasClientesComodatos() {
  const supabase = createClientComponentClient();
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        // usuario logueado
        const { data: s } = await supabase.auth.getSession();
        const email = s.session?.user?.email || null;
        setSessionEmail(email);

        // leer hoja
        const spreadsheetId = "1_gD_uYjBh3NlWogDqiiU_kkrZTDueQ98kSrGfc92vSg"; // tu hoja
        const gid = "0";
        const data = await fetchCsv(spreadsheetId, gid);

        // normalizar
        const cleaned = data.map((r) => ({
          rut: r["rut_cliente"],
          cliente: r["nombre_cliente"],
          ejecutivo: r["empleado_ventas"],
          ventas: parseNumberCL(r["ventas_quimicos_2025"]),
          comodatos: parseNumberCL(r["comodatos_activos_2021"]),
          alerta: r["alerta_final"] || "",
          email: r["email_col"] || "",
        }));

        // filtro por email del usuario
        const filtrado = email
          ? cleaned.filter(
              (r) => (r.email || "").toLowerCase() === email.toLowerCase()
            )
          : cleaned;

        setRows(filtrado);
      } catch (err) {
        console.error("Error cargando hoja:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalVentas = rows
    .filter((r) => !filtro || r.alerta.toLowerCase() === filtro.toLowerCase())
    .reduce((acc, r) => acc + (r.ventas || 0), 0);

  const totalComodatos = rows
    .filter((r) => !filtro || r.alerta.toLowerCase() === filtro.toLowerCase())
    .reduce((acc, r) => acc + (r.comodatos || 0), 0);

  const visibles = rows.filter(
    (r) => !filtro || r.alerta.toLowerCase() === filtro.toLowerCase()
  );

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-[#2B6CFF] mb-4">
        🚨 Alertas Clientes con Comodatos (desde 2023) sin ventas PT últimos 6M
      </h1>

      {loading ? (
        <p>Cargando…</p>
      ) : (
        <>
          {/* filtro alerta */}
          <div className="mb-4 flex gap-2">
            {["", "Alerta", "Ok", "Sin Comodato"].map((f) => (
              <button
                key={f}
                onClick={() => setFiltro(f.toLowerCase())}
                className={`px-3 py-1 rounded ${
                  filtro === f.toLowerCase()
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-200"
                }`}
              >
                {f === "" ? "Todos" : f}
              </button>
            ))}
          </div>

          <table className="min-w-full text-sm border">
            <thead className="bg-zinc-100">
              <tr>
                <th className="px-2 py-1">RUT</th>
                <th className="px-2 py-1">Cliente</th>
                <th className="px-2 py-1">Ejecutivo</th>
                <th className="px-2 py-1 text-right">Ventas Químicos 2025</th>
                <th className="px-2 py-1 text-right">Comodatos Activos ≥ 2021</th>
                <th className="px-2 py-1">Alerta</th>
              </tr>
            </thead>
            <tbody>
              {visibles.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-3">
                    ✅ No hay clientes para mostrar
                  </td>
                </tr>
              )}
              {visibles.map((r, i) => (
                <tr key={i} className="border-t">
                  <td className="px-2 py-1">{r.rut}</td>
                  <td className="px-2 py-1">{r.cliente}</td>
                  <td className="px-2 py-1">{r.ejecutivo}</td>
                  <td className="px-2 py-1 text-right">{money(r.ventas)}</td>
                  <td className="px-2 py-1 text-right">{money(r.comodatos)}</td>
                  <td className="px-2 py-1">{r.alerta}</td>
                </tr>
              ))}
            </tbody>
            {visibles.length > 0 && (
              <tfoot className="bg-zinc-100 font-bold">
                <tr>
                  <td colSpan={3} className="px-2 py-1 text-right">
                    Totales
                  </td>
                  <td className="px-2 py-1 text-right">
                    {money(totalVentas)}
                  </td>
                  <td className="px-2 py-1 text-right">
                    {money(totalComodatos)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </>
      )}
    </div>
  );
}
