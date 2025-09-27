"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

/* ===== Helpers ===== */
function sanitizeRut(rut: string) {
  return (rut || "").replace(/[^0-9Kk]/g, "").toUpperCase();
}
function parseDateLike(d: any): Date | null {
  if (!d) return null;
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
  const rows = txt.split("\n").map((r) => r.split(","));
  const headers = rows[0];
  return rows.slice(1).map((r) => {
    const obj: any = {};
    headers.forEach((h, i) => (obj[h.trim()] = (r[i] || "").trim()));
    return obj;
  });
}

/* ===== Page Component ===== */
export default function ClientesInactivos() {
  const supabase = createClientComponentClient();
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Obtener sesión
        const {
          data: { session },
        } = await supabase.auth.getSession();
        setSessionEmail(session?.user?.email || null);

        const ventasId = "1MY531UHJDhxvHsw6-DwlW8m4BeHwYP48MUSV98UTc1s";
        const comId = "1MY531UHJDhxvHsw6-DwlW8m4BeHwYP48MUSV98UTc1s";
        const ventasGid = "871602912";
        const comGid = "551810728";

        const ventas = await fetchCsv(ventasId, ventasGid);
        const comodatos = await fetchCsv(comId, comGid);

        /* Consolidar últimas compras por RUT */
        const ventasByRut: Record<string, Date> = {};
        for (const v of ventas) {
          const rut = sanitizeRut(
            v["Rut Cliente"] || v["RUT Cliente"] || v["RUT"]
          );
          const fecha = parseDateLike(v["DocDate"]);
          if (!rut || !fecha) continue;
          if (!ventasByRut[rut] || fecha > ventasByRut[rut]) {
            ventasByRut[rut] = fecha;
          }
        }

        /* Consolidar comodatos por RUT */
        const comodatosByRut: Record<
          string,
          { nombre: string; email: string; ejecutivo: string; monto: number }
        > = {};
        for (const c of comodatos) {
          const rut = sanitizeRut(c["Rut Cliente"] || c["RUT Cliente"] || c["RUT"]);
          if (!rut) continue;
          const nombre = c["Nombre Cliente"] || "";
          const email = c["EMAIL_COL"] || "";
          const ejecutivo = c["Empleado ventas"] || "";
          const monto = num(c["Total"] || 0);

          if (!comodatosByRut[rut]) {
            comodatosByRut[rut] = { nombre, email, ejecutivo, monto };
          } else {
            comodatosByRut[rut].monto += monto;
          }
        }

        /* Determinar clientes inactivos */
        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - 6);

        const resultado: any[] = [];
        for (const rut in comodatosByRut) {
          const info = comodatosByRut[rut];
          const ultima = ventasByRut[rut] || null;
          if (!ultima || ultima < cutoff) {
            resultado.push({
              rut,
              nombre: info.nombre,
              email: info.email,
              ejecutivo: info.ejecutivo,
              monto: info.monto,
              ultimaCompra: ultima ? ultima.toLocaleDateString("es-CL") : "—",
              estado: "🔴 Sin compras 6M",
            });
          }
        }

        /* Filtro por login */
        const filtrados = sessionEmail
          ? resultado.filter(
              (r) => r.email?.toLowerCase() === sessionEmail.toLowerCase()
            )
          : resultado;

        setData(filtrados);
      } catch (err) {
        console.error("Error KPI:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase]);

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-[#2B6CFF] mb-4">
        📊 Clientes con comodatos vigentes sin compras en 6M
      </h1>
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
              <th className="px-2 py-1">Estado</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-3">
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
                  {d.monto.toLocaleString("es-CL")}
                </td>
                <td className="px-2 py-1">{d.ultimaCompra}</td>
                <td className="px-2 py-1">{d.estado}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
