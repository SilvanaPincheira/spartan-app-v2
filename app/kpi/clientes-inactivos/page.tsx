"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

/* ===== Helpers ===== */
function sanitizeRut(rut: string) {
  return (rut || "").replace(/[^0-9Kk]/g, "").toUpperCase();
}
function parsePeriodo(periodo: string): Date | null {
  // Espera formato YYYY-MM o YYYY/MM
  if (!periodo) return null;
  const clean = periodo.replace("/", "-");
  const [y, m] = clean.split("-");
  if (!y || !m) return null;
  const dt = new Date(Number(y), Number(m) - 1, 1);
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
    (async () => {
      // Obtener email del usuario logueado
      const { data: { user } } = await supabase.auth.getUser();
      const email = user?.email || null;
      setSessionEmail(email);

      try {
        const ventasId = "1MY531UHJDhxvHsw6-DwlW8m4BeHwYP48MUSV98UTc1s";
        const comId = "1MY531UHJDhxvHsw6-DwlW8m4BeHwYP48MUSV98UTc1s";
        const ventasGid = "871602912";
        const comGid = "551810728";

        const ventas = await fetchCsv(ventasId, ventasGid);
        const comodatos = await fetchCsv(comId, comGid);

        // 6 meses atrás
        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - 6);

        // Agrupar ventas por RUT, solo productos PT
        const ventasPorRut: Record<string, { ultima: Date; total: number }> = {};
        for (const v of ventas) {
          const rut = sanitizeRut(v["Rut Cliente"] || v["RUT Cliente"] || v["RUT"]);
          const item = (v["ItemCode"] || "").toUpperCase();
          if (!rut || !item.startsWith("PT")) continue;

          const fecha =
            parsePeriodo(v["Periodo"]) ||
            new Date(v["DocDate"] || v["Fecha Documento"] || v["Posting Date"]);
          if (!fecha || isNaN(fecha.getTime())) continue;

          if (!ventasPorRut[rut]) {
            ventasPorRut[rut] = { ultima: fecha, total: num(v["Global Venta"]) };
          } else {
            ventasPorRut[rut].total += num(v["Global Venta"]);
            if (fecha > ventasPorRut[rut].ultima) {
              ventasPorRut[rut].ultima = fecha;
            }
          }
        }

        // Agrupar comodatos por RUT
        const comPorRut: Record<string, { nombre: string; email: string; ejecutivo: string; total: number }> = {};
        for (const c of comodatos) {
          const rut = sanitizeRut(c["Rut Cliente"] || c["RUT"]);
          if (!rut) continue;
          if (!comPorRut[rut]) {
            comPorRut[rut] = {
              nombre: c["Nombre Cliente"] || "",
              email: c["EMAIL_COL"] || "",
              ejecutivo: c["Empleado ventas"] || "",
              total: num(c["Total"]),
            };
          } else {
            comPorRut[rut].total += num(c["Total"]);
          }
        }

        // Construir resultado: clientes con comodatos pero sin compras 6M
        const resultado: any[] = [];
        for (const rut of Object.keys(comPorRut)) {
          const info = comPorRut[rut];
          const ventasRut = ventasPorRut[rut];
          const ultimaCompra = ventasRut?.ultima || null;

          // Condición de inactividad: no tiene compra PT en últimos 6M
          const estaInactivo = !ultimaCompra || ultimaCompra < cutoff;

          if (estaInactivo) {
            resultado.push({
              rut,
              nombre: info.nombre,
              email: info.email,
              ejecutivo: info.ejecutivo,
              monto: info.total,
              ultimaCompra: ultimaCompra
                ? ultimaCompra.toLocaleDateString("es-CL")
                : "—",
            });
          }
        }

        // === Filtro por rol/email ===
        let filtrado = resultado;
        if (email && !["silvana.pincheira@spartan.cl", "jorge.beltran@spartan.cl"].includes(email)) {
          if (email === "claudia.borquez@spartan.cl") {
            filtrado = resultado.filter((r) => r.ejecutivo.startsWith("FB") || r.ejecutivo.startsWith("IN"));
          } else if (email === "carlos.avendano@spartan.cl") {
            filtrado = resultado.filter((r) => r.ejecutivo.startsWith("HC"));
          } else if (email === "alberto.damm@spartan.cl") {
            filtrado = resultado.filter(
              (r) => !r.ejecutivo.startsWith("FB") && !r.ejecutivo.startsWith("IN") && !r.ejecutivo.startsWith("HC")
            );
          } else {
            // Ejecutivos normales -> filtrar por EMAIL_COL
            filtrado = resultado.filter((r) => r.email === email);
          }
        }

        setData(filtrado);
      } catch (err) {
        console.error("Error KPI:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-[#2B6CFF] mb-4">
        📊 Clientes con comodatos vigentes sin compras de químicos en 6M
      </h1>
      {sessionEmail && (
        <p className="mb-4 text-sm text-zinc-600">
          👋 Bienvenido <b>{sessionEmail}</b>, aquí puedes ver tus clientes asignados con alerta de inactividad.
        </p>
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
