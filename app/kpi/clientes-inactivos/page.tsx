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

/* ===== Component ===== */
export default function ClientesInactivos() {
  const supabase = createClientComponentClient();
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSessionEmail(session?.user?.email ?? null);
    };
    getSession();
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

        // Clientes activos (ventas últimos 6 meses)
        const activos = new Set<string>();
        const ultimaCompra: Record<string, Date> = {};

        for (const v of ventas) {
          const rut = sanitizeRut(v["Rut Cliente"] || v["RUT Cliente"]);
          const fecha = parseDateLike(v["DocDate"] || v["Fecha Documento"]);
          if (!rut || !fecha) continue;

          if (fecha >= cutoff) activos.add(rut);
          if (!ultimaCompra[rut] || fecha > ultimaCompra[rut]) {
            ultimaCompra[rut] = fecha;
          }
        }

        // Filtrar clientes inactivos con comodatos
        const resultado: any[] = [];
        for (const c of comodatos) {
          const rut = sanitizeRut(c["Rut Cliente"] || c["RUT Cliente"]);
          if (!rut) continue;
          if (activos.has(rut)) continue;

          resultado.push({
            rut,
            nombre: c["Nombre Cliente"] || "",
            email: c["EMAIL_COL"] || "",
            ejecutivo: c["Ejecutivo"] || "",
            monto: num(c["Total"]),
            ultimaCompra: ultimaCompra[rut]
              ? ultimaCompra[rut].toLocaleDateString("es-CL")
              : "—",
          });
        }

        // 🔹 Agrupar por RUT
        const agrupados: Record<string, any> = {};
        for (const r of resultado) {
          if (!agrupados[r.rut]) {
            agrupados[r.rut] = {
              rut: r.rut,
              nombre: r.nombre,
              email: r.email,
              ejecutivo: r.ejecutivo,
              monto: 0,
              ultimaCompra: r.ultimaCompra,
            };
          }
          agrupados[r.rut].monto += r.monto;

          // última compra más reciente
          if (
            r.ultimaCompra !== "—" &&
            (!agrupados[r.rut].ultimaCompra ||
              agrupados[r.rut].ultimaCompra === "—" ||
              new Date(r.ultimaCompra.split("/").reverse().join("-")) >
                new Date(
                  agrupados[r.rut].ultimaCompra.split("/").reverse().join("-")
                ))
          ) {
            agrupados[r.rut].ultimaCompra = r.ultimaCompra;
          }
        }

        // 🔹 Filtrar por el email del usuario logueado
        const filtrados = Object.values(agrupados).filter(
          (d: any) => d.email === sessionEmail
        );

        setData(filtrados);
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
