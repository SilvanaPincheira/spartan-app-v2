"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

/* ===== Helpers ===== */
function sanitizeRut(rut: string) {
  return (rut || "").replace(/[^0-9Kk]/g, "").toUpperCase();
}
function parsePeriodo(val: string): Date | null {
  if (!val) return null;
  // formato esperado: "2025-01"
  const m = val.match(/^(\d{4})[-/](\d{1,2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, 1);
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
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
    // traer email del usuario logueado
    supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email ?? null;
      setSessionEmail(email);
    });
  }, [supabase]);

  useEffect(() => {
    if (!sessionEmail) return;

    (async () => {
      try {
        const ventasId = "1MY531UHJDhxvHsw6-DwlW8m4BeHwYP48MUSV98UTc1s";
        const comId = "1MY531UHJDhxvHsw6-DwlW8m4BeHwYP48MUSV98UTc1s";
        const ventasGid = "871602912"; // pestaña Ventas
        const comGid = "551810728"; // pestaña Comodatos Salida

        const ventas = await fetchCsv(ventasId, ventasGid);
        const comodatos = await fetchCsv(comId, comGid);

        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - 6);

        const cutoffCom = new Date();
        cutoffCom.setFullYear(cutoffCom.getFullYear() - 2);

        // ====== Procesar ventas (por RUT) ======
        const ultimaCompra: Record<string, Date> = {};
        const ventas6m = new Set<string>();

        for (const v of ventas) {
          const rut = sanitizeRut(v["Rut Cliente"] || v["RUT Cliente"] || v["RUT"]);
          const fecha =
            parsePeriodo(v["Periodo"]) ||
            new Date(v["DocDate"]) ||
            new Date(v["Fecha Documento"]);
          if (!rut || !fecha || isNaN(fecha.getTime())) continue;

          if (!ultimaCompra[rut] || fecha > ultimaCompra[rut]) {
            ultimaCompra[rut] = fecha;
          }
          if (fecha >= cutoff) ventas6m.add(rut);
        }

        // ====== Procesar comodatos (por RUT) ======
        const resultado: any[] = [];
        for (const c of comodatos) {
          const rut = sanitizeRut(c["Rut Cliente"] || c["RUT Cliente"] || c["Rut"]);
          const fechaContab = parsePeriodo(c["Periodo"]) || new Date(c["Fecha Contab"]);
          if (!rut || !fechaContab || fechaContab < cutoffCom) continue;

          if (ventas6m.has(rut)) continue;

          resultado.push({
            rut,
            nombre: c["Nombre Cliente"] || "",
            email: (c["EMAIL_COL"] || "").toLowerCase(),
            ejecutivo: c["Empleado ventas"] || c["Ejecutivo"] || "",
            monto: num(c["Total"]),
            ultimaCompra: ultimaCompra[rut]
              ? ultimaCompra[rut].toLocaleDateString("es-CL")
              : "—",
          });
        }

        // ====== Filtrar por el usuario logueado (EMAIL_COL de Comodatos) ======
        let filtrado = resultado;
        if (sessionEmail) {
          filtrado = resultado.filter(
            (r) => r.email && r.email.toLowerCase() === sessionEmail.toLowerCase()
          );
        }

        setData(filtrado);
      } catch (err) {
        console.error("Error KPI:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionEmail]);

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-[#2B6CFF] mb-2">
        📊 Clientes con comodatos vigentes sin compras en 6M
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
