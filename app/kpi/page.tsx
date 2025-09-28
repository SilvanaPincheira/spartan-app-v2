"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

/* ===================== Helpers ===================== */

function normKey(k: string) {
  return (k || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function parseNumber(v: any): number {
  if (v == null) return 0;
  const s = String(v).replace(/[^0-9,.\-]/g, "").trim();
  if (!s) return 0;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  let t = s;
  if (hasComma && hasDot) t = s.replace(/\./g, "").replace(",", ".");
  else if (hasComma && !hasDot) t = s.replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

function parseFecha(v: any): string {
  if (!v) return "";
  const s = String(v).trim();
  if (!s) return "";
  let m = s.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return "";
}

function rutKey(raw: string): string {
  if (!raw) return "";
  let s = raw.toUpperCase().trim();
  s = s.replace(/^[^0-9]+/, "");   // quita prefijos como "C"
  s = s.replace(/[A-Z]+$/, "");    // quita sufijos de sucursal al final
  s = s.replace(/[^0-9K-]/g, "");
  return s.replace(/-/g, "");      // clave sin guion
}
function rutDisplayFromKey(key: string): string {
  if (!key) return "";
  if (key.length < 2) return key;
  return `${key.slice(0, -1)}-${key.slice(-1)}`;
}

function first(row: Record<string, any>, candidates: string[]): any {
  for (const c of candidates) {
    if (row[c] != null && String(row[c]).trim() !== "") return row[c];
  }
  return "";
}

// Extrae TODOS los emails válidos de columnas EMAIL_COL (incluye duplicadas)
function extractEmails(row: Record<string, any>): string[] {
  const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  const keys = Object.keys(row).filter(
    (k) => k === "email" || k.startsWith("email_col")
  );
  const set = new Set<string>();
  for (const k of keys) {
    const raw = String(row[k] ?? "");
    const parts = raw.split(/[,;\/\s]+/);
    for (const p of parts) {
      const matches = p.match(emailRegex);
      if (matches) {
        matches.forEach((m) => set.add(m.toLowerCase()));
      }
    }
  }
  return Array.from(set);
}

// CSV: intenta papaparse; si no, fallback manual que respeta comillas
async function parseCsv(text: string): Promise<Record<string, string>[]> {
  try {
    const Papa = (await import("papaparse")).default;
    const out = Papa.parse(text, { header: true, skipEmptyLines: true });
    return out.data.map((row: any) => {
      const o: Record<string, any> = {};
      Object.keys(row || {}).forEach((k) => {
        const nk = normKey(k);
        if (o.hasOwnProperty(nk)) {
          let i = 1;
          while (o.hasOwnProperty(`${nk}_${i}`)) i++;
          o[`${nk}_${i}`] = row[k];
        } else {
          o[nk] = row[k];
        }
      });
      return o;
    });
  } catch {
    const rows: string[][] = [];
    let cur = "";
    let inQ = false;
    let row: string[] = [];
    const pushField = () => { row.push(cur); cur = ""; };
    const pushRow = () => { rows.push(row); row = []; };
    for (let i = 0; i < text.length; i++) {
      const ch = text[i], nx = text[i + 1];
      if (ch === '"') {
        if (inQ && nx === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === "," && !inQ) {
        pushField();
      } else if ((ch === "\n" || ch === "\r") && !inQ) {
        if (ch === "\r" && nx === "\n") i++;
        pushField(); pushRow();
      } else cur += ch;
    }
    if (cur.length || row.length) { pushField(); pushRow(); }
    const headers = (rows[0] || []).map(normKey);
    const out: Record<string, string>[] = [];
    for (let r = 1; r < rows.length; r++) {
      const obj: Record<string, string> = {};
      (rows[r] || []).forEach((v, i) => {
        const key = headers[i] || `col_${i}`;
        if (obj.hasOwnProperty(key)) {
          let j = 1;
          while (obj.hasOwnProperty(`${key}_${j}`)) j++;
          obj[`${key}_${j}`] = v;
        } else obj[key] = v;
      });
      out.push(obj);
    }
    return out;
  }
}

async function fetchCsv(spreadsheetId: string, gid: string): Promise<Record<string, string>[]> {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
  const res = await fetch(url, { cache: "no-store" });
  const txt = await res.text();
  return parseCsv(txt);
}

/* ===================== Component ===================== */

export default function ClientesInactivosConComodato() {
  const supabase = createClientComponentClient();
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Sesión
        const { data: s } = await supabase.auth.getSession();
        const email = s.session?.user?.email || null;
        setSessionEmail(email);

        // Hojas
        const ventasId = "1MY531UHJDhxvHsw6-DwlW8m4BeHwYP48MUSV98UTc1s";
        const comId = "1MY531UHJDhxvHsw6-DwlW8m4BeHwYP48MUSV98UTc1s";
        const ventasGid = "871602912";
        const comGid = "551810728";

        const ventasRows = await fetchCsv(ventasId, ventasGid);
        const comRows = await fetchCsv(comId, comGid);

        // Corte 6M desde sep-2025 -> 2025-03-01
        const cutoff = "2025-03-01";

        // ===== Ventas PT por RUT
        const ventasMap = new Map<
          string,
          { total: number; ultima: string; nombre: string; emails: string[]; ejecutivo: string }
        >();

        for (const r of ventasRows) {
          const rutRaw = first(r, ["rut_cliente"]);
          const key = rutKey(String(rutRaw || ""));
          if (!key) continue;

          const fecha = parseFecha(first(r, ["docdate"]));
          if (!fecha) continue;

          const itemCode = String(first(r, ["itemcode", "codigo_producto"])).toUpperCase();
          if (!itemCode.startsWith("PT")) continue; // solo químicos

          const monto = parseNumber(first(r, ["global_venta"]));
          const nombre = String(first(r, ["nombre_cliente"])) || "";
          const emails = extractEmails(r); // por si se requiere fallback
          // Variantes de "Empleado Ventas"
          const ejKey = Object.keys(r).find((k) => k.includes("empleado") && k.includes("ventas")) || "empleado_ventas";
          const ejecutivo = String(r[ejKey] ?? "") || "";

          if (!ventasMap.has(key)) {
            ventasMap.set(key, { total: 0, ultima: fecha, nombre, emails, ejecutivo });
          }
          const entry = ventasMap.get(key)!;
          entry.total += monto;
          if (fecha > entry.ultima) entry.ultima = fecha;
          if (emails.length) {
            // acumula posibles correos
            entry.emails = Array.from(new Set([...entry.emails, ...emails]));
          }
        }

        // ===== Comodatos vigentes (EMAIL_COL base del filtro)
        const comMap = new Map<
          string,
          { total: number; nombre: string; emails: string[]; ejecutivo: string }
        >();

        for (const r of comRows) {
          const rutRaw = first(r, ["rut_cliente"]);
          const key = rutKey(String(rutRaw || ""));
          if (!key) continue;

          const fecha = parseFecha(first(r, ["fecha_contab"]));
          if (fecha && fecha < "2023-01-01") continue; // solo >= 2023

          const total = parseNumber(first(r, ["total"]));
          const nombre = String(first(r, ["nombre_cliente"])) || "";
          const emails = extractEmails(r); // ← AQUÍ TOMAMOS EMAIL_COL (y duplicadas)
          const ejecutivo = String(first(r, ["empleado_ventas"])) || "";

          if (!comMap.has(key)) {
            comMap.set(key, { total: 0, nombre, emails, ejecutivo });
          }
          const entry = comMap.get(key)!;
          entry.total += total;
          if (emails.length) {
            entry.emails = Array.from(new Set([...(entry.emails || []), ...emails]));
          }
        }

        // ===== Consolidado: comodato y SIN ventas PT últimos 6M
        const out: any[] = [];
        for (const [key, info] of comMap) {
          const v = ventasMap.get(key);
          const ultima = v?.ultima || null;
          const sinVentas = !v || (ultima && ultima < cutoff);
          if (!sinVentas) continue;

          // Email para filtro y display:
          // prioriza EMAIL_COL de COMODATOS; si no hay, cae a Ventas
          const emails = (info.emails && info.emails.length ? info.emails : (v?.emails || [])).map((e) => e.toLowerCase());
          const emailDisplay = emails[0] || "";

          out.push({
            rutKey: key,
            rut: rutDisplayFromKey(key),
            cliente: info.nombre || v?.nombre || "",
            emails,                         // <-- lista normalizada
            email: emailDisplay,            // <-- primero para mostrar
            ejecutivo: info.ejecutivo || v?.ejecutivo || "",
            comodato: info.total || 0,
            ultimaCompra: ultima || "—",
          });
        }

        // ===== Filtro por usuario logueado (EMAIL_COL de comodatos prioridad)
        let filtrado = out;
        if (sessionEmail) {
          const me = sessionEmail.toLowerCase().trim();
          const admins = ["silvana.pincheira@spartan.cl", "jorge.beltran@spartan.cl"];
          if (!admins.includes(me)) {
            filtrado = out.filter((r) => (r.emails || []).includes(me));
          }
        }

        filtrado.sort((a, b) => (b.comodato || 0) - (a.comodato || 0) || a.cliente.localeCompare(b.cliente));
        setData(filtrado);
      } catch (e) {
        console.error("Error:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalComodato = data.reduce((acc, d) => acc + (d.comodato || 0), 0);

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
                  ✅ No hay clientes con comodato vigente e inactivos en ventas PT
                </td>
              </tr>
            )}
            {data.map((d, i) => (
              <tr key={i} className="border-t">
                <td className="px-2 py-1">{d.rut}</td>
                <td className="px-2 py-1">{d.cliente}</td>
                <td className="px-2 py-1">{d.email || "—"}</td>
                <td className="px-2 py-1">{d.ejecutivo || "—"}</td>
                <td className="px-2 py-1 text-right">{d.comodato.toLocaleString("es-CL")}</td>
                <td className="px-2 py-1">{d.ultimaCompra}</td>
              </tr>
            ))}
          </tbody>
          {data.length > 0 && (
            <tfoot className="bg-zinc-100 font-bold">
              <tr>
                <td colSpan={4} className="px-2 py-1 text-right">Total</td>
                <td className="px-2 py-1 text-right">{totalComodato.toLocaleString("es-CL")}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      )}
    </div>
  );
}
