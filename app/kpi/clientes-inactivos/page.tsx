"use client";

import { useEffect, useState } from "react";

/* ===================== HELPERS ===================== */
function sanitizeRut(rut: string) {
  return (rut || "").replace(/[^0-9Kk]/g, "").toUpperCase();
}
function parseDateLike(d: any): Date | null {
  if (!d) return null;
  if (d instanceof Date) return d;
  const t = Date.parse(String(d));
  return isNaN(t) ? null : new Date(t);
}
function num(x: any) {
  const v = Number(x);
  return Number.isFinite(v) ? v : 0;
}
/* Parser CSV robusto */
function parseCsv(text: string): Record<string, any>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  const pushCell = () => (row.push(cell), (cell = ""));
  const pushRow = () => (row.length ? rows.push(row) : 0, (row = []));

  const s = text.replace(/\r/g, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') (cell += '"'), i++;
        else inQuotes = false;
      } else cell += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") pushCell();
      else if (ch === "\n") (pushCell(), pushRow());
      else cell += ch;
    }
  }
  if (cell.length || row.length) (pushCell(), pushRow());
  if (!rows.length) return [];

  const headers = rows[0].map((h) => h.trim());
  const out: Record<string, any>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.every((c) => c === "")) continue;
    const obj: any = {};
    headers.forEach((h, j) => (obj[h] = r[j] ?? ""));
    out.push(obj);
  }
  return out;
}
async function fetchCsv(spreadsheetId: string, gid: string | number) {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`CSV ${res.status}`);
  const text = await res.text();
  return parseCsv(text);
}
function normalizeGoogleSheetUrl(url: string) {
  const m = url.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const id = m ? m[1] : "";
  let gid = "0";
  const g = url.match(/[?&#]gid=([0-9]+)/);
  if (g) gid = g[1];
  return { id, gid };
}

/* ===================== COMPONENTE ===================== */
export default function ClientesInactivos() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setError("");
        setLoading(true);

        // === Config ===
        const ventasUrl =
          "https://docs.google.com/spreadsheets/d/1MY531UHJDhxvHsw6-DwlW8m4BeHwYP48MUSV98UTc1s/edit?gid=871602912#gid=871602912";
        const comodatosUrl =
          "https://docs.google.com/spreadsheets/d/1MY531UHJDhxvHsw6-DwlW8m4BeHwYP48MUSV98UTc1s/edit?gid=551810728#gid=551810728";

        const { id: ventasId, gid: ventasGid } = normalizeGoogleSheetUrl(ventasUrl);
        const { id: comId, gid: comGid } = normalizeGoogleSheetUrl(comodatosUrl);

        const ventas = await fetchCsv(ventasId, ventasGid);
        const comodatos = await fetchCsv(comId, comGid);

        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - 6);

        // === Clientes con ventas últimos 6M ===
        const activos = new Set<string>();
        const ultimaCompra: Record<string, Date> = {};

        for (const v of ventas) {
          const rut = sanitizeRut(
            v["RUT Cliente"] || v["Rut Cliente"] || v["RUT"] || v["Rut"]
          );
          const fecha = parseDateLike(
            v["DocDate"] || v["Fecha Documento"] || v["Posting Date"] || v["Fecha"]
          );
          if (!rut || !fecha) continue;
          if (fecha >= cutoff) activos.add(rut);
          if (!ultimaCompra[rut] || fecha > ultimaCompra[rut]) {
            ultimaCompra[rut] = fecha;
          }
        }

        // === Inactivos con comodatos ===
        const resultado: any[] = [];
        for (const c of comodatos) {
          const rut = sanitizeRut(c["RUT Cliente"] || c["Rut"]);
          if (!rut) continue;
          if (activos.has(rut)) continue; // ya compró

          resultado.push({
            rut,
            nombre: c["Nombre Cliente"] || c["Cliente"] || "",
            email: c["EMAIL_COL"] || "",
            ejecutivo: c["Ejecutivo"] || "",
            monto: num(c["Total"]),
            ultimaCompra: ultimaCompra[rut]
              ? ultimaCompra[rut].toLocaleDateString("es-CL")
              : "—",
          });
        }

        setData(resultado);
      } catch (err: any) {
        console.error("Error KPI:", err);
        setError(String(err.message || err));
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

      {loading && <p>Cargando…</p>}
      {error && <p className="text-red-600">❌ {error}</p>}

      {!loading && !error && (
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
              <tr key={i} className="border-t hover:bg-zinc-50">
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
