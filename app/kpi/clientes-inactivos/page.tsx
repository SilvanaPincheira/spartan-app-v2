"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

/* ===== Helpers ===== */
function sanitizeRut(rut: string) {
  return (rut || "").replace(/[^0-9Kk]/g, "").toUpperCase();
}
function parseDateLike(d: any): Date | null {
  if (!d) return null;
  if (typeof d === "number") return new Date(Math.round((d - 25569) * 86400 * 1000)); // Excel serial
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt;
}
function num(x: any) {
  const v = Number(x);
  return Number.isFinite(v) ? v : 0;
}
async function fetchCsv(spreadsheetId: string, gid: string) {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
  const res = await fetch(url, { cache: "no-store" });
  const txt = await res.text();

  // parse CSV simple
  const rows = txt.split("\n").map((r) => r.split(","));
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj: any = {};
    headers.forEach((h, i) => (obj[h] = (r[i] || "").trim()));
    return obj;
  });
}

/* ===== Component ===== */
export default function ClientesInactivos() {
  const supabase = createClientComponentClient();
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Totales KPI
  const [totalClientes, setTotalClientes] = useState(0);
  const [inactivos, setInactivos] = useState(0);
  const [pctInactivos, setPctInactivos] = useState(0);
  const [totalComodato, setTotalComodato] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSessionEmail(session?.user?.email || null);
    })();
  }, [supabase]);

  useEffect(() => {
    if (!sessionEmail) return;
    (async () => {
      try {
        const ventasId = "1MY531UHJDhxvHsw6-DwlW8m4BeHwYP48MUSV98UTc1s";
        const comId = "1MY531UHJDhxvHsw6-DwlW8m4BeHwYP48MUSV98UTc1s";
        const ventasGid = "871602912";
        const comGid = "551810728";

        const ventas = await fetchCsv(ventasId, ventasGid);
        const comodatos = await fetchCsv(comId, comGid);

        const cutoff6m = new Date();
        cutoff6m.setMonth(cutoff6m.getMonth() - 6);

        const cutoff2y = new Date();
        cutoff2y.setFullYear(cutoff2y.getFullYear() - 2);

        // Consolidar ventas por RUT
        const ultimaCompra: Record<string, Date> = {};
        for (const v of ventas) {
          const rut = sanitizeRut(v["Rut Cliente"] || v["RUT Cliente"] || v["Rut"]);
          const fecha = parseDateLike(
            v["DocDate"] || v["Fecha Documento"] || v["Posting Date"] || v["Periodo"]
          );
          if (!rut || !fecha) continue;
          if (!ultimaCompra[rut] || fecha > ultimaCompra[rut]) {
            ultimaCompra[rut] = fecha;
          }
        }

        // Consolidar comodatos por RUT (vigentes últimos 2 años)
        const comodatosByRut: Record<string, { total: number; nombre: string; email: string; ejecutivo: string }> = {};
        for (const c of comodatos) {
          const rut = sanitizeRut(c["Rut Cliente"] || c["RUT Cliente"] || c["Rut"]);
          const fechaContab = parseDateLike(c["Fecha Contab"] || c["Periodo"]);
          if (!rut || !fechaContab) continue;
          if (fechaContab < cutoff2y) continue; // solo últimos 2 años

          if (!comodatosByRut[rut]) {
            comodatosByRut[rut] = {
              total: 0,
              nombre: c["Nombre Cliente"] || "",
              email: c["EMAIL_COL"] || "",
              ejecutivo: c["Empleado ventas"] || c["Ejecutivo"] || ""
            };
          }
          comodatosByRut[rut].total += num(c["Total"]);
        }

        // Construir resultado
        const resultado: any[] = [];
        Object.entries(comodatosByRut).forEach(([rut, info]) => {
          if (!info.email || info.email.toLowerCase() !== sessionEmail.toLowerCase()) return;

          const ultima = ultimaCompra[rut];
          const activo = ultima && ultima >= cutoff6m;

          if (!activo) {
            resultado.push({
              rut,
              nombre: info.nombre,
              email: info.email,
              ejecutivo: info.ejecutivo,
              monto: info.total,
              ultimaCompra: ultima ? ultima.toLocaleDateString("es-CL") : "—",
            });
          }
        });

        setData(resultado);

        // KPIs
        const totalClientesCount = Object.values(comodatosByRut).filter(
          (c) => c.email && c.email.toLowerCase() === sessionEmail.toLowerCase()
        ).length;
        const inactivosCount = resultado.length;
        const totalComodatoSum = Object.values(comodatosByRut)
          .filter((c) => c.email && c.email.toLowerCase() === sessionEmail.toLowerCase())
          .reduce((a, c) => a + c.total, 0);

        setTotalClientes(totalClientesCount);
        setInactivos(inactivosCount);
        setPctInactivos(totalClientesCount > 0 ? (inactivosCount / totalClientesCount) * 100 : 0);
        setTotalComodato(totalComodatoSum);
      } catch (err) {
        console.error("Error KPI:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionEmail]);

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-[#2B6CFF] mb-4">
        📊 Clientes con comodatos vigentes sin compras en 6M
      </h1>

      {/* Resumen KPI */}
      {!loading && (
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <div className="rounded-2xl border bg-white p-4 shadow-sm text-center">
            <div className="text-sm text-zinc-500">Total clientes</div>
            <div className="text-2xl font-bold text-[#2B6CFF]">{totalClientes}</div>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm text-center">
            <div className="text-sm text-zinc-500">Inactivos (6M)</div>
            <div className="text-2xl font-bold text-red-600">
              {inactivos}{" "}
              <span className="text-sm font-medium text-zinc-500">
                ({pctInactivos.toFixed(1)}%)
              </span>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm text-center">
            <div className="text-sm text-zinc-500">Comodato vigente (24M)</div>
            <div className="text-2xl font-bold text-emerald-600">
              {totalComodato.toLocaleString("es-CL", {
                style: "currency",
                currency: "CLP",
              })}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p>Cargando…</p>
      ) : (
        <table className="min-w-full text-sm border">
          <thead className="bg-zinc-100">
            <tr>
              <th className="px-2 py-1">RUT</th>
              <th className="px-2 py-1">Cliente</th>
              <th className="px-2 py-1">Email</th>
              <th className="px-2 py-1">Ejecutivo</th>
              <th className="px-2 py-1 text-right">Monto Comodato</th>
              <th className="px-2 py-1">Última compra</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-3">
                  ✅ No hay clientes inactivos con comodato vigente
                </td>
              </tr>
            )}
            {data.map((d, i) => (
              <tr key={i} className="border-t">
                <td className="px-2 py-1">{d.rut}</td>
                <td className="px-2 py-1">{d.nombre}</td>
                <td className="px-2 py-1">{d.email}</td>
                <td className="px-2 py-1">{d.ejecutivo}</td>
                <td className="px-2 py-1 text-right">
                  {d.monto.toLocaleString("es-CL", { style: "currency", currency: "CLP" })}
                </td>
                <td className="px-2 py-1">{d.ultimaCompra}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
