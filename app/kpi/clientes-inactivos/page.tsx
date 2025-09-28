"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

/* ===== Helpers ===== */
function normalizarRut(rut: string): string {
  return (rut || "").replace(/[^0-9Kk]/g, "").toUpperCase();
}
function esRutValido(rut: string): boolean {
  if (!rut) return false;
  // formato simple: números + guion + dígito verificador
  return /^[0-9]+-[0-9K]$/.test(rut);
}
function parseNumber(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function parseFecha(v: string): string {
  if (!v) return "";
  const d1 = new Date(v);
  if (!isNaN(d1.getTime())) {
    return d1.toISOString().slice(0, 10); // yyyy-mm-dd
  }
  return "";
}
async function fetchCsv(
  spreadsheetId: string,
  gid: string
): Promise<Record<string, string>[]> {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
  const res = await fetch(url, { cache: "no-store" });
  const txt = await res.text();
  const rows = txt.split("\n").map((r) => r.split(","));
  const headers = rows[0];
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
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
      try {
        // 🔹 Sesión actual
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const email = session?.user?.email || null;
        setSessionEmail(email);

        const ventasId = "1MY531UHJDhxvHsw6-DwlW8m4BeHwYP48MUSV98UTc1s";
        const comId = "1MY531UHJDhxvHsw6-DwlW8m4BeHwYP48MUSV98UTc1s";
        const ventasGid = "871602912";
        const comGid = "551810728";

        const ventasData: Record<string, any>[] = await fetchCsv(
          ventasId,
          ventasGid
        );
        const comodatosData: Record<string, any>[] = await fetchCsv(
          comId,
          comGid
        );

        // 🔹 Map de Ventas por RUT normalizado
        const ventasMap = new Map<
          string,
          { total: number; ultima: string }
        >();
        ventasData.forEach((v: Record<string, any>) => {
          const rutBase = normalizarRut(
            v["Rut Cliente"] || v["Codigo Cliente"]
          );
          if (!esRutValido(rutBase)) return; // 👈 filtro extra

          const total = parseNumber(v["Global Venta"]);
          const fecha =
            parseFecha(v["DocDate"]) || parseFecha(v["Periodo"]);

          if (!ventasMap.has(rutBase)) {
            ventasMap.set(rutBase, { total: 0, ultima: fecha });
          }

          const entry = ventasMap.get(rutBase)!;
          entry.total += total;
          if (fecha && (!entry.ultima || fecha > entry.ultima)) {
            entry.ultima = fecha;
          }
        });

        // 🔹 Map de Comodatos por RUT
        const comodatoMap = new Map<
          string,
          { total: number; nombre: string; email: string; ejecutivo: string }
        >();
        comodatosData.forEach((c: Record<string, any>) => {
          const rutBase = normalizarRut(c["Rut Cliente"]);
          if (!esRutValido(rutBase)) return; // 👈 filtro extra

          const total = parseNumber(c["Total"]);
          const nombre = c["Nombre Cliente"] || "";
          const email = c["EMAIL_COL"] || "";
          const ejecutivo = c["Ejecutivo"] || "";

          if (!comodatoMap.has(rutBase)) {
            comodatoMap.set(rutBase, { total: 0, nombre, email, ejecutivo });
          }
          comodatoMap.get(rutBase)!.total += total;
        });

        // 🔹 Fecha de corte: últimos 6M
        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - 6);
        const cutoffStr = cutoff.toISOString().slice(0, 10);

        // 🔹 Construir dataset final
        const resultado: any[] = [];
        for (const [rut, info] of comodatoMap) {
          const venta = ventasMap.get(rut);
          const ultima = venta?.ultima || "—";
          const inactivo = !venta || (ultima && ultima < cutoffStr);

          if (inactivo) {
            resultado.push({
              rut,
              nombre: info.nombre,
              email: info.email,
              ejecutivo: info.ejecutivo,
              monto: info.total,
              ultimaCompra: ultima,
            });
          }
        }

        // 🔹 Filtrado por email del usuario logueado
        let filtrado = resultado;
        if (sessionEmail && !sessionEmail.endsWith("@spartan.cl")) {
          filtrado = resultado.filter(
            (r) =>
              r.email?.toLowerCase() === sessionEmail.toLowerCase()
          );
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
