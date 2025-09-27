"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

/* ===== Helpers ===== */
function sanitizeRut(rut: string) {
  return (rut || "").replace(/[^0-9Kk]/g, "").toUpperCase();
}
function parseDateLike(d: any): Date | null {
  if (!d) return null;
  // Google Sheets exporta como "M/D/YY H:mm" → ej: "1/23/25 0:00"
  const parts = String(d).split(" ");
  const datePart = parts[0];
  const [m, d2, y] = datePart.split("/");
  if (!m || !d2 || !y) return null;
  const year = y.length === 2 ? 2000 + Number(y) : Number(y);
  const dt = new Date(year, Number(m) - 1, Number(d2));
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

/* ===== Component ===== */
export default function ClientesInactivos() {
  const supabase = createClientComponentClient();
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setSessionEmail(data.user?.email ?? null);
    });
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

        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - 6);

        // ===== 1. Última compra por RUT consolidada =====
        const ultimaCompra: Record<string, Date> = {};
        const activos = new Set<string>();

        for (const v of ventas) {
          const rut = sanitizeRut(
            v["Rut Cliente"] || v["RUT Cliente"] || v["RUT"]
          );
          const fecha = parseDateLike(
            v["DocDate"] || v["Fecha Documento"] || v["Posting Date"]
          );
          if (!rut || !fecha) continue;

          // Guardar siempre la fecha máxima por RUT
          const prev = ultimaCompra[rut];
          if (!prev || fecha > prev) ultimaCompra[rut] = fecha;

          // Activo si tiene compras recientes
          if (fecha >= cutoff) activos.add(rut);
        }

        // ===== 2. Filtrar clientes con comodatos pero sin compras en 6M =====
        const resultado: any[] = [];
        for (const c of comodatos) {
          const rut = sanitizeRut(c["Rut Cliente"] || c["RUT"]);
          if (!rut) continue;

          // Filtrar por EMAIL_COL (ejecutivo)
          const email = c["EMAIL_COL"] || "";
          if (email.toLowerCase() !== sessionEmail.toLowerCase()) continue;

          if (activos.has(rut)) continue; // ya compró en últimos 6M

          resultado.push({
            rut,
            nombre: c["Nombre Cliente"] || "",
            email,
            ejecutivo: c["Ejecutivo"] || "",
            monto: num(c["Total"]),
            ultimaCompra: ultimaCompra[rut]
              ? ultimaCompra[rut].toLocaleDateString("es-CL")
              : "—",
          });
        }

        setData(resultado);
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
              <th className="px-2 py-1">Monto Comodato</th>
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
                  {d.monto.toLocaleString("es-CL")}
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
