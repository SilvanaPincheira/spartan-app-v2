"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

/* ===== Helpers ===== */
function normalizarRut(rut: string): string {
  if (!rut) return "";
  rut = rut.toUpperCase().trim();
  rut = rut.replace(/[^0-9K]/g, "");
  // eliminar sufijo de sucursal (C, D, etc.)
  return rut.replace(/[A-Z]$/, "");
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
export default function ClientesConsolidados() {
  const supabase = createClientComponentClient();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const ventasId = "1MY531UHJDhxvHsw6-DwlW8m4BeHwYP48MUSV98UTc1s";
        const comId = "1MY531UHJDhxvHsw6-DwlW8m4BeHwYP48MUSV98UTc1s";
        const ventasGid = "871602912";
        const comGid = "551810728";

        const ventasData = await fetchCsv(ventasId, ventasGid);
        const comodatosData = await fetchCsv(comId, comGid);

        // 🔹 Fecha corte: últimos 6 meses
        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - 6);
        const cutoffStr = cutoff.toISOString().slice(0, 10);

        // 🔹 Ventas agrupadas por RUT base
        const ventasMap = new Map<
          string,
          { total: number; ultima: string; nombre: string }
        >();
        ventasData.forEach((v) => {
          const rut = normalizarRut(v["Rut Cliente"] || v["Codigo Cliente"]);
          if (!rut) return;

          const monto = parseNumber(v["Global Venta"]);
          const fecha = parseFecha(v["DocDate"]) || parseFecha(v["Periodo"]);
          if (!fecha) return;

          if (!ventasMap.has(rut)) {
            ventasMap.set(rut, { total: 0, ultima: fecha, nombre: v["Nombre Cliente"] || "" });
          }

          const entry = ventasMap.get(rut)!;
          if (fecha >= cutoffStr) entry.total += monto;
          if (fecha > entry.ultima) entry.ultima = fecha;
        });

        // 🔹 Comodatos desde 2023
        const comodatoMap = new Map<string, { total: number; nombre: string }>();
        comodatosData.forEach((c) => {
          const rut = normalizarRut(c["Rut Cliente"]);
          if (!rut) return;

          const fecha = parseFecha(c["Fecha Inicio"]) || parseFecha(c["Fecha"]);
          if (fecha && fecha < "2023-01-01") return; // solo >= 2023

          const total = parseNumber(c["Total"]);
          if (!comodatoMap.has(rut)) {
            comodatoMap.set(rut, { total: 0, nombre: c["Nombre Cliente"] || "" });
          }
          comodatoMap.get(rut)!.total += total;
        });

        // 🔹 Consolidar dataset final
        const resultado: any[] = [];
        const allRuts = new Set([...ventasMap.keys(), ...comodatoMap.keys()]);
        allRuts.forEach((rut) => {
          const venta = ventasMap.get(rut);
          const comodato = comodatoMap.get(rut);

          resultado.push({
            rut,
            cliente: venta?.nombre || comodato?.nombre || "",
            ventas: venta?.total || 0,
            ultimaCompra: venta?.ultima || "—",
            comodato: comodato?.total || 0,
          });
        });

        setData(resultado);
      } catch (err) {
        console.error("Error:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-[#2B6CFF] mb-4">
        📊 Consolidado: Ventas últimos 6M y Comodatos desde 2023
      </h1>
      {loading ? (
        <p>Cargando…</p>
      ) : (
        <table className="min-w-full text-sm border">
          <thead className="bg-zinc-100">
            <tr>
              <th className="px-2 py-1">RUT</th>
              <th className="px-2 py-1">Cliente</th>
              <th className="px-2 py-1 text-right">Ventas 6M</th>
              <th className="px-2 py-1">Última compra</th>
              <th className="px-2 py-1 text-right">Comodatos desde 2023</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-3">
                  ✅ No hay registros
                </td>
              </tr>
            )}
            {data.map((d, i) => (
              <tr key={i} className="border-t">
                <td className="px-2 py-1">{d.rut}</td>
                <td className="px-2 py-1">{d.cliente}</td>
                <td className="px-2 py-1 text-right">
                  {d.ventas.toLocaleString("es-CL")}
                </td>
                <td className="px-2 py-1">{d.ultimaCompra}</td>
                <td className="px-2 py-1 text-right">
                  {d.comodato.toLocaleString("es-CL")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
