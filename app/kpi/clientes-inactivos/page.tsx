"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

/* ===== Helpers ===== */
function normalizarRut(rut: string): string {
  if (!rut) return "";
  rut = rut.toUpperCase().trim();
  rut = rut.replace(/[^0-9K]/g, "");
  return rut.replace(/[A-Z]$/, ""); // eliminar sufijo sucursal
}
function parseNumber(v: any): number {
  const n = Number(v?.toString().replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
function parseFecha(v: string): string {
  if (!v) return "";
  const d = new Date(v);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return "";
}
async function fetchCsv(spreadsheetId: string, gid: string): Promise<Record<string, string>[]> {
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
export default function ClientesInactivosConComodato() {
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

        // 🔹 IDs de tus hojas
        const ventasId = "1MY531UHJDhxvHsw6-DwlW8m4BeHwYP48MUSV98UTc1s";
        const comId = "1MY531UHJDhxvHsw6-DwlW8m4BeHwYP48MUSV98UTc1s";
        const ventasGid = "871602912";
        const comGid = "551810728";

        const ventasData = await fetchCsv(ventasId, ventasGid);
        const comodatosData = await fetchCsv(comId, comGid);

        // 🔹 Mapas de datos
        const ventasMap = new Map<string, { total: number; ultima: string; nombre: string; email: string; ejecutivo: string }>();
        const comodatoMap = new Map<string, { total: number; nombre: string; email: string; ejecutivo: string }>();

        // 🔹 Corte: últimos 6M desde septiembre 2025 → marzo 2025
        const cutoff = "2025-03-01";

        /* ===== VENTAS ===== */
        ventasData.forEach((v) => {
          const rut = normalizarRut(v["Rut Cliente"] || v["Codigo Cliente"]);
          if (!rut) return;

          const fecha = parseFecha(v["DocDate"]);
          if (!fecha) return;

          // Solo productos PT (químicos)
          const itemCode = (v["ItemCode"] || v["Codigo Producto"] || "").toUpperCase();
          if (!itemCode.startsWith("PT")) return;

          const monto = parseNumber(v["Global Venta"]);
          const nombre = v["Nombre Cliente"] || "";
          const email = v["EMAIL_COL"] || "";
          const ejecutivo = v["Émpleado Ventas"] || v["Empleado Ventas"] || "";

          if (!ventasMap.has(rut)) {
            ventasMap.set(rut, { total: 0, ultima: fecha, nombre, email, ejecutivo });
          }

          const entry = ventasMap.get(rut)!;
          entry.total += monto;
          if (fecha > entry.ultima) entry.ultima = fecha;
        });

        /* ===== COMODATOS ===== */
        comodatosData.forEach((c) => {
          const rut = normalizarRut(c["Rut Cliente"] || c["Codigo Cliente"]);
          if (!rut) return;

          const fecha = parseFecha(c["Fecha Contab"]);
          if (fecha && fecha < "2023-01-01") return; // solo vigentes >= 2023

          const monto = parseNumber(c["Total"]);
          const nombre = c["Nombre Cliente"] || "";
          const email = c["EMAIL_COL"] || "";
          const ejecutivo = c["Empleado ventas"] || "";

          if (!comodatoMap.has(rut)) {
            comodatoMap.set(rut, { total: 0, nombre, email, ejecutivo });
          }
          comodatoMap.get(rut)!.total += monto;
        });

        /* ===== CONSOLIDADO ===== */
        const resultado: any[] = [];
        for (const [rut, info] of comodatoMap) {
          const venta = ventasMap.get(rut);
          const ultima = venta?.ultima || null;

          // condición: sin ventas en últimos 6M
          const sinVentas = !venta || (ultima && ultima < cutoff);

          if (sinVentas) {
            resultado.push({
              rut,
              cliente: info.nombre || venta?.nombre || "",
              email: info.email || venta?.email || "",
              ejecutivo: info.ejecutivo || venta?.ejecutivo || "",
              comodato: info.total,
              ultimaCompra: ultima || "—",
            });
          }
        }

        /* ===== FILTRO POR USUARIO LOGUEADO ===== */
        let filtrado = resultado;
        if (sessionEmail) {
          const emailLower = sessionEmail.toLowerCase();
          if (!["silvana.pincheira@spartan.cl", "jorge.beltran@spartan.cl"].includes(emailLower)) {
            filtrado = resultado.filter((r) => r.email?.toLowerCase() === emailLower);
          }
        }

        setData(filtrado);
      } catch (err) {
        console.error("Error:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ===== Totales ===== */
  const totalComodato = data.reduce((acc, d) => acc + d.comodato, 0);

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-[#2B6CFF] mb-4">
        📊 Clientes con Comodatos (desde 2023) sin ventas PT últimos 6M
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
              <th className="px-2 py-1 text-right">Comodatos desde 2023</th>
              <th className="px-2 py-1">Última compra</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-3">
                  ✅ No hay clientes con comodato vigente e inactivos en ventas
                </td>
              </tr>
            )}
            {data.map((d, i) => (
              <tr key={i} className="border-t">
                <td className="px-2 py-1">{d.rut}</td>
                <td className="px-2 py-1">{d.cliente}</td>
                <td className="px-2 py-1">{d.email || "—"}</td>
                <td className="px-2 py-1">{d.ejecutivo || "—"}</td>
                <td className="px-2 py-1 text-right">
                  {d.comodato.toLocaleString("es-CL")}
                </td>
                <td className="px-2 py-1">{d.ultimaCompra}</td>
              </tr>
            ))}
          </tbody>
          {data.length > 0 && (
            <tfoot className="bg-zinc-100 font-bold">
              <tr>
                <td colSpan={4} className="px-2 py-1 text-right">
                  Total
                </td>
                <td className="px-2 py-1 text-right">
                  {totalComodato.toLocaleString("es-CL")}
                </td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      )}
    </div>
  );
}
