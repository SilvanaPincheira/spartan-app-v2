// app/kpi/clientes-inactivos/page.tsx
"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

/* === Helpers === */
function sanitizeRut(rut: string) {
  return (rut || "").replace(/[^0-9Kk]/g, "").toUpperCase();
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

/* === Component === */
export default function ClientesInactivos() {
  const supabase = createClientComponentClient();
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // sesión actual
      const { data: { session } } = await supabase.auth.getSession();
      setSessionEmail(session?.user?.email ?? null);

      try {
        // IDs
        const ventasId = "1MY531UHJDhxvHsw6-DwlW8m4BeHwYP48MUSV98UTc1s";
        const comId = "1MY531UHJDhxvHsw6-DwlW8m4BeHwYP48MUSV98UTc1s";
        const ventasGid = "871602912";
        const comGid = "551810728";

        // Datos
        const ventas = await fetchCsv(ventasId, ventasGid);
        const comodatos = await fetchCsv(comId, comGid);

        // Cutoffs
        const cutoff6m = new Date();
        cutoff6m.setMonth(cutoff6m.getMonth() - 6);
        const cutoffCom = new Date();
        cutoffCom.setMonth(cutoffCom.getMonth() - 24);

        /* --- Ventas agrupadas por RUT --- */
        const ventasPorRut: Record<string, { ventas6m: number; ultimaCompra: string }> = {};
        for (const v of ventas) {
          const rut = sanitizeRut(v["Rut Cliente"] || v["RUT Cliente"] || "");
          const periodo = v["Periodo"]?.toString().trim(); // ej: 2025-01
          if (!rut || !periodo) continue;

          const fechaPeriodo = new Date(periodo + "-01");
          const venta = num(v["Global Venta"]);

          if (!ventasPorRut[rut]) ventasPorRut[rut] = { ventas6m: 0, ultimaCompra: "—" };

          if (fechaPeriodo >= cutoff6m) {
            ventasPorRut[rut].ventas6m += venta;
          }

          if (
            ventasPorRut[rut].ultimaCompra === "—" ||
            new Date(ventasPorRut[rut].ultimaCompra + "-01") < fechaPeriodo
          ) {
            ventasPorRut[rut].ultimaCompra = periodo;
          }
        }

        /* --- Comodatos agrupados por RUT --- */
        const comodatosPorRut: Record<string, { total: number; email: string; nombre: string }> = {};
        for (const c of comodatos) {
          const rut = sanitizeRut(c["Rut Cliente"] || "");
          const periodo = c["Periodo"]?.toString().trim();
          const fechaPeriodo = periodo ? new Date(periodo + "-01") : null;
          const total = num(c["Total"]);
          if (!rut || !fechaPeriodo) continue;

          if (fechaPeriodo >= cutoffCom) {
            if (!comodatosPorRut[rut]) {
              comodatosPorRut[rut] = {
                total: 0,
                email: c["EMAIL_COL"] || "",
                nombre: c["Nombre Cliente"] || "",
              };
            }
            comodatosPorRut[rut].total += total;
          }
        }

        /* --- Unir y filtrar --- */
        const resultado: any[] = [];
        for (const rut in comodatosPorRut) {
          const com = comodatosPorRut[rut];
          const vent = ventasPorRut[rut];
          if (com.total > 0 && (!vent || vent.ventas6m === 0)) {
            resultado.push({
              rut,
              nombre: com.nombre,
              email: com.email,
              monto: com.total,
              ultimaCompra: vent?.ultimaCompra || "—",
            });
          }
        }

        // Filtro por ejecutivo logueado
        const filtrado = sessionEmail
          ? resultado.filter((r) => r.email === sessionEmail)
          : resultado;

        setData(filtrado);
      } catch (err) {
        console.error("Error KPI:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase, sessionEmail]);

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
              <th className="px-2 py-1">Monto Comodato</th>
              <th className="px-2 py-1">Última compra</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-3">
                  ✅ No hay clientes inactivos con comodato vigente
                </td>
              </tr>
            )}
            {data.map((d, i) => (
              <tr key={i} className="border-t">
                <td className="px-2 py-1">{d.rut}</td>
                <td className="px-2 py-1">{d.nombre}</td>
                <td className="px-2 py-1">{d.email}</td>
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
