"use client";

import { useEffect, useMemo, useState } from "react";

/* ================= Helpers ================= */
function sanitizeRut(rut: string) {
  return (rut || "").toString().replace(/[^0-9Kk]/g, "").toUpperCase();
}
function num(x: any) {
  const v = Number(String(x).replace(/\./g, "").replace(/,/g, "."));
  return Number.isFinite(v) ? v : 0;
}

/** CSV robusto (comillas, comas dentro, etc.) */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const pushCell = () => (row.push(cell), (cell = ""));
  const pushRow = () => {
    if (row.length) rows.push(row);
    row = [];
  };
  const s = (text || "").replace(/\r/g, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") pushCell();
      else if (ch === "\n") {
        pushCell();
        pushRow();
      } else cell += ch;
    }
  }
  if (cell.length || row.length) {
    pushCell();
    pushRow();
  }
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim());
  const out: Record<string, string>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every((c) => c === "")) continue;
    const obj: Record<string, string> = {};
    headers.forEach((h, j) => (obj[h] = (r[j] ?? "").trim()));
    out.push(obj);
  }
  return out;
}

async function fetchCsv(spreadsheetId: string, gid: string) {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`CSV ${res.status}`);
  const text = await res.text();
  return parseCsv(text);
}

/** Fecha inteligente:
 * - "1/23/25 0:00" => mes/día/año
 * - "23/1/2025" => día/mes/año
 * - "2025-01-23"
 * - serial Excel (número)
 */
function parseSmartDate(raw: any): Date | null {
  if (raw == null || raw === "") return null;

  // Excel serial
  if (/^\d+(\.\d+)?$/.test(String(raw))) {
    const days = Number(raw);
    if (!Number.isFinite(days)) return null;
    const base = new Date(1899, 11, 30).getTime(); // Excel base
    const ms = base + days * 86400000;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }

  const s = String(raw).trim();
  // ISO
  const iso = new Date(s);
  if (!isNaN(iso.getTime())) return iso;

  // dd/mm/yyyy o mm/dd/yy + hora
  const m = s.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (m) {
    let a = Number(m[1]); // ¿día o mes?
    let b = Number(m[2]); // ¿mes o día?
    let y = Number(m[3]);
    const hh = Number(m[4] || 0);
    const mm = Number(m[5] || 0);
    const ss = Number(m[6] || 0);
    if (y < 100) y += 2000;

    // Heurística:
    // - si el 2do valor >12 => es mm/dd (ej: 1/23/25)
    // - si el 1ro >12 => es dd/mm
    // - ambiguo => por defecto dd/mm (LatAm)
    let day: number, month: number;
    if (b > 12) {
      // mm/dd
      month = a - 1;
      day = b;
    } else if (a > 12) {
      // dd/mm
      day = a;
      month = b - 1;
    } else {
      // por defecto dd/mm
      day = a;
      month = b - 1;
    }

    const d = new Date(y, month, day, hh, mm, ss);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

/* =================== Página =================== */
type Row = {
  rut: string;
  nombre: string;
  email: string;
  ejecutivo: string;
  montoComodato24m: number;
  ventas6m: number;
  ultimaCompra: Date | null;
};

export default function ClientesInactivos() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setErrorMsg("");
        setLoading(true);

        // === IDs y GIDs
        const SHEET_ID = "1MY531UHJDhxvHsw6-DwlW8m4BeHwYP48MUSV98UTc1s";
        const VENTAS_GID = "871602912"; // Ventas
        const COMODATOS_GID = "551810728"; // Comodatos Salida

        const [ventas, comodatos] = await Promise.all([
          fetchCsv(SHEET_ID, VENTAS_GID),
          fetchCsv(SHEET_ID, COMODATOS_GID),
        ]);

        // Rangos
        const hoy = new Date();
        const desde6m = new Date(hoy.getFullYear(), hoy.getMonth() - 6, hoy.getDate());
        const desde24m = new Date(hoy.getFullYear(), hoy.getMonth() - 24, hoy.getDate());

        // Acumuladores por RUT
        const ventas6mByRut = new Map<string, number>();
        const ultimaCompraByRut = new Map<string, Date>();
        const nombreByRut = new Map<string, string>();
        const emailByRut = new Map<string, string>();
        const ejecutivoByRut = new Map<string, string>();

        // ===== VENTAS: sumar 6M y última compra (sin limitar) =====
        for (const r of ventas) {
          const rut = sanitizeRut(
            r["Rut Cliente"] ||
              r["RUT Cliente"] ||
              r["RUT"] ||
              r["Rut"] ||
              r["RUT Cliente "]
          );
          if (!rut) continue;

          // captura nombre/ejecutivo/email por si sirven mejor que Comodatos
          const nombre = r["Nombre Cliente"] || "";
          const ej =
            r["Èmpleado Ventas"] ||
            r["Empleado ventas"] ||
            r["Empleado Ventas"] ||
            "";
          const mail = r["EMAIL_COL"] || "";

          if (nombre && !nombreByRut.has(rut)) nombreByRut.set(rut, nombre);
          if (ej && !ejecutivoByRut.has(rut)) ejecutivoByRut.set(rut, ej);
          if (mail && !emailByRut.has(rut)) emailByRut.set(rut, mail);

          const fecha =
            parseSmartDate(r["DocDate"]) ||
            parseSmartDate(r["Fecha Documento"]) ||
            parseSmartDate(r["Posting Date"]) ||
            parseSmartDate(r["Fecha Doc."]) ||
            parseSmartDate(r["Fecha"]);
          if (!fecha) continue;

          // última compra (máxima)
          const prev = ultimaCompraByRut.get(rut);
          if (!prev || fecha > prev) ultimaCompraByRut.set(rut, fecha);

          // suma 6M (si corresponde)
          if (fecha >= desde6m) {
            const venta =
              num(r["Global Venta"]) ||
              num(r["Total Venta"]) ||
              num(r["Total"]) ||
              0;
            ventas6mByRut.set(rut, (ventas6mByRut.get(rut) || 0) + venta);
          }
        }

        // ===== COMODATOS: vigentes (24m) por RUT =====
        const comodato24mByRut = new Map<string, number>();
        for (const c of comodatos) {
          const rut = sanitizeRut(
            c["Rut Cliente"] || c["RUT Cliente"] || c["RUT"] || c["Rut"]
          );
          if (!rut) continue;

          // Capturar nombre/email/ejecutivo desde comodatos si faltan
          const nombre = c["Nombre Cliente"] || "";
          const mail = c["EMAIL_COL"] || "";
          const ej = c["Ejecutivo"] || "";

          if (nombre && !nombreByRut.has(rut)) nombreByRut.set(rut, nombre);
          if (mail && !emailByRut.has(rut)) emailByRut.set(rut, mail);
          if (ej && !ejecutivoByRut.has(rut)) ejecutivoByRut.set(rut, ej);

          const fecha =
            parseSmartDate(c["Fecha Contab"]) ||
            parseSmartDate(c["Fecha Conta"]) ||
            parseSmartDate(c["Fecha"]);
          if (!fecha || fecha < desde24m) continue; // solo 24m

          const total = num(c["Total"]);
          if (!total) continue;

          comodato24mByRut.set(rut, (comodato24mByRut.get(rut) || 0) + total);
        }

        // ===== Construcción del KPI =====
        const result: Row[] = [];
        comodato24mByRut.forEach((montoComodato24m, rut) => {
          if (montoComodato24m <= 0) return;

          const ventas6m = ventas6mByRut.get(rut) || 0;
          if (ventas6m > 0) return; // solo sin compras en 6M

          result.push({
            rut,
            nombre: nombreByRut.get(rut) || "—",
            email: emailByRut.get(rut) || "—",
            ejecutivo: ejecutivoByRut.get(rut) || "—",
            montoComodato24m,
            ventas6m,
            ultimaCompra: ultimaCompraByRut.get(rut) || null,
          });
        });

        // Orden: mayor comodato
        result.sort((a, b) => b.montoComodato24m - a.montoComodato24m);

        setRows(result);
      } catch (e: any) {
        console.error(e);
        setErrorMsg(e?.message || "Error cargando KPI");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalClientes = useMemo(() => rows.length, [rows]);

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-[#2B6CFF] mb-4">
        📊 Clientes con comodatos vigentes sin compras en 6M
      </h1>

      {errorMsg && (
        <div className="mb-3 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <p>Cargando…</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="mb-2 text-sm text-zinc-600">
            {totalClientes.toLocaleString()} clientes
          </div>
          <table className="min-w-full text-sm border">
            <thead className="bg-zinc-100">
              <tr>
                <th className="px-2 py-1 text-left">RUT</th>
                <th className="px-2 py-1 text-left">Cliente</th>
                <th className="px-2 py-1 text-left">Email</th>
                <th className="px-2 py-1 text-left">Ejecutivo</th>
                <th className="px-2 py-1 text-right">Comodato 24M</th>
                <th className="px-2 py-1 text-left">Última compra</th>
                <th className="px-2 py-1 text-left">Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-2 py-4 text-center text-zinc-600">
                    ✅ No hay clientes inactivos con comodato vigente
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.rut} className="border-t">
                    <td className="px-2 py-1">{r.rut}</td>
                    <td className="px-2 py-1">{r.nombre}</td>
                    <td className="px-2 py-1">{r.email}</td>
                    <td className="px-2 py-1">{r.ejecutivo}</td>
                    <td className="px-2 py-1 text-right">
                      {r.montoComodato24m.toLocaleString("es-CL")}
                    </td>
                    <td className="px-2 py-1">
                      {r.ultimaCompra
                        ? r.ultimaCompra.toLocaleDateString("es-CL")
                        : "—"}
                    </td>
                    <td className="px-2 py-1">
                      <span className="text-red-600">🔴 Sin compras 6M</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

