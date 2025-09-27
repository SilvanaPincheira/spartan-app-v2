// app/kpi/clientes-inactivos/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

/* ================== CONFIG ================== */
const SHEET_ID = "1MY531UHJDhxvHsw6-DwlW8m4BeHwYP48MUSV98UTc1s";
const GID_VENTAS = "871602912";          // pestaña Ventas
const GID_COMODATOS = "551810728";       // pestaña Comodatos Salida

// Correos con vista completa (sin filtro por EMAIL_COL). Opcional.
const ADMIN_EMAILS = new Set<string>([
  "benjamin.beltran@spartan.cl",
  "patricia.acuna@spartan.cl",
  "jorge.palma@spartan.cl",
]);

/* ================== HELPERS ================== */
function clp(n: number) {
  return (n || 0).toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}
function sanitizeRut(v: string) {
  return (v || "").toString().replace(/[^0-9Kk]/g, "").toUpperCase();
}
function num(x: any) {
  if (x == null) return 0;
  const s = String(x).replace(/\./g, "").replace(/,/g, ".");
  const v = Number(s);
  return Number.isFinite(v) ? v : 0;
}
function parseCsv(text: string): Record<string, string>[] {
  const rows = text.replace(/\r/g, "").split("\n");
  if (!rows.length) return [];
  const headers = rows[0].split(",").map((h) => h.trim());
  const out: Record<string, string>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i].split(",");
    if (!cols || cols.every((c) => c.trim() === "")) continue;
    const obj: Record<string, string> = {};
    headers.forEach((h, j) => (obj[h] = (cols[j] ?? "").trim()));
    out.push(obj);
  }
  return out;
}
async function fetchCsv(sheetId: string, gid: string) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`CSV ${res.status}`);
  return parseCsv(await res.text());
}

/**
 * Fechas en Ventas vienen del estilo "1/23/25 0:00" -> mes/día/año
 * Este parser intenta:
 * - Date() nativo
 * - mm/dd/yy
 * - dd/mm/yy (fallback) si el primer número > 12
 */
function parseSmartDate(raw: any): Date | null {
  if (!raw && raw !== 0) return null;
  const s = String(raw).trim();
  // Intento directo
  const direct = new Date(s);
  if (!isNaN(direct.getTime())) return direct;

  // Quitar hora si viene
  const main = s.split(" ")[0] || s;

  // mm/dd/yy o mm/dd/yyyy
  let m = main.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let mm = Number(m[1]);
    let dd = Number(m[2]);
    let yy = Number(m[3]);
    if (yy < 100) yy += 2000;
    // Si mm>12, asumimos dd/mm/yy
    if (mm > 12) {
      const d2 = new Date(yy, dd - 1, mm);
      return isNaN(d2.getTime()) ? null : d2;
    }
    const d1 = new Date(yy, mm - 1, dd);
    return isNaN(d1.getTime()) ? null : d1;
  }

  // dd-mm-yyyy
  m = main.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yy = Number(m[3]);
    const d = new Date(yy, mm - 1, dd);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// Saca el primer email que encuentre en el row (hay hojas con columnas duplicadas EMAIL_COL)
function getAnyEmail(row: Record<string, string>) {
  for (const [k, v] of Object.entries(row)) {
    if (/email/i.test(k) && String(v).trim()) return String(v).trim().toLowerCase();
  }
  return "";
}

function getRutFromVentas(r: Record<string, string>) {
  return sanitizeRut(
    r["Rut Cliente"] ??
      r["RUT Cliente"] ??
      r["RUT"] ??
      r["Rut"] ??
      ""
  );
}
function getRutFromComodatos(r: Record<string, string>) {
  return sanitizeRut(
    r["Rut Cliente"] ??
      r["RUT Cliente"] ??
      r["RUT"] ??
      r["Rut"] ??
      ""
  );
}

/* ================== TIPOS ================== */
type OutRow = {
  rut: string;
  nombre: string;
  email: string;
  ejecutivo: string;
  comodato24m: number;
  ultimaCompra: Date | null;
};

/* ================== PAGE ================== */
export default function ClientesInactivos() {
  const supabase = createClientComponentClient();
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [isAdminOverride, setIsAdminOverride] = useState(false);

  const [rows, setRows] = useState<OutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    // 1) sacar email del usuario
    supabase.auth.getUser().then(({ data }) => {
      setSessionEmail(data.user?.email ?? null);
    });
    // 2) admin override via ?all=1
    if (typeof window !== "undefined") {
      const u = new URL(window.location.href);
      setIsAdminOverride(u.searchParams.get("all") === "1");
    }
  }, [supabase]);

  useEffect(() => {
    (async () => {
      if (!sessionEmail && !isAdminOverride) {
        // esperamos tener sesión (o all=1)
        return;
      }
      setLoading(true);
      setErr("");

      try {
        const ventas = await fetchCsv(SHEET_ID, GID_VENTAS);
        const comodatos = await fetchCsv(SHEET_ID, GID_COMODATOS);

        const today = new Date();
        const cutoff6m = new Date(today.getFullYear(), today.getMonth() - 6, today.getDate());
        const cutoff24m = new Date(today.getFullYear(), today.getMonth() - 24, today.getDate());

        const ventas6m = new Map<string, number>();       // sum venta últimos 6m por rut
        const ultimaCompra = new Map<string, Date>();     // máx fecha venta por rut
        const nombres = new Map<string, string>();        // nombre por rut
        const emails = new Map<string, string>();         // email por rut (de ventas o comodatos)
        const ejecutivos = new Map<string, string>();     // ejecutivo por rut

        // ===== VENTAS =====
        for (const v of ventas) {
          const rut = getRutFromVentas(v);
          if (!rut) continue;

          // nombre / email / ejecutivo
          if (v["Nombre Cliente"]) nombres.set(rut, v["Nombre Cliente"].trim());
          const mail = getAnyEmail(v);
          if (mail && !emails.has(rut)) emails.set(rut, mail);
          const eje =
            v["Èmpleado Ventas"] ??
            v["Empleado ventas"] ??
            v["Empleado Ventas"] ??
            "";
          if (eje && !ejecutivos.has(rut)) ejecutivos.set(rut, eje.trim());

          // fechas y montos
          const f = parseSmartDate(v["DocDate"] ?? v["Fecha Documento"] ?? v["Posting Date"]);
          if (f) {
            if (!ultimaCompra.has(rut) || f > (ultimaCompra.get(rut) as Date))
              ultimaCompra.set(rut, f);
            if (f >= cutoff6m) {
              const tot = num(v["Global Venta"] ?? v["Total Venta"] ?? v["PV antes del descuento"]);
              ventas6m.set(rut, (ventas6m.get(rut) || 0) + tot);
            }
          }
        }

        // ===== COMODATOS (últimos 24m) =====
        const comodato24m = new Map<string, number>();
        for (const c of comodatos) {
          const rut = getRutFromComodatos(c);
          if (!rut) continue;

          // nombre / email / ejecutivo
          if (c["Nombre Cliente"]) nombres.set(rut, c["Nombre Cliente"].trim());
          const mail = getAnyEmail(c);
          if (mail && !emails.has(rut)) emails.set(rut, mail); // tomar del que exista
          if (c["Ejecutivo"] && !ejecutivos.has(rut)) ejecutivos.set(rut, c["Ejecutivo"].trim());

          const f = parseSmartDate(
            c["Fecha Contab"] ?? c["Fecha Contabilización"] ?? c["Periodo"]
          );
          if (!f || f < cutoff24m) continue;

          const total = num(c["Total"]);
          comodato24m.set(rut, (comodato24m.get(rut) || 0) + total);
        }

        // ===== Consolidación y filtro por sesión =====
        const sessionMail = (sessionEmail ?? "").toLowerCase();
        const canSeeAll = isAdminOverride || (sessionMail && ADMIN_EMAILS.has(sessionMail));

        const result: OutRow[] = [];
        comodato24m.forEach((monto, rut) => {
          const venta6m = ventas6m.get(rut) || 0;
          if (monto <= 0 || venta6m > 0) return; // queremos: tiene comodato y NO compró en 6m

          const emailRut = (emails.get(rut) || "").toLowerCase();

          // filtro por cartera (EMAIL_COL)
          if (!canSeeAll) {
            if (!emailRut) return;
            if (emailRut !== sessionMail) return;
          }

          result.push({
            rut,
            nombre: nombres.get(rut) || "—",
            email: emails.get(rut) || "—",
            ejecutivo: ejecutivos.get(rut) || "—",
            comodato24m: monto,
            ultimaCompra: ultimaCompra.get(rut) || null,
          });
        });

        // ordenar por monto comodato desc
        result.sort((a, b) => (b.comodato24m || 0) - (a.comodato24m || 0));
        setRows(result);
      } catch (e: any) {
        setErr(e?.message || "Error cargando KPI.");
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionEmail, isAdminOverride]);

  const totalComodatos = useMemo(
    () => rows.reduce((a, r) => a + (r.comodato24m || 0), 0),
    [rows]
  );

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-[#2B6CFF] mb-3">
        📊 Clientes con comodatos vigentes sin compras en 6M
      </h1>

      {err && (
        <div className="mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </div>
      )}

      {loading ? (
        <div>Cargando…</div>
      ) : rows.length === 0 ? (
        <div className="rounded border bg-white px-3 py-2 text-sm">
          ✅ No hay clientes inactivos con comodato vigente para tu cartera.
        </div>
      ) : (
        <>
          <div className="mb-2 text-sm text-zinc-600">
            Registros: <strong>{rows.length.toLocaleString("es-CL")}</strong> ·
            &nbsp;Comodato 24M total: <strong>{clp(totalComodatos)}</strong>
          </div>

          <div className="overflow-x-auto rounded border bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-100 text-zinc-700">
                <tr>
                  <th className="px-2 py-2 text-left">RUT</th>
                  <th className="px-2 py-2 text-left">Cliente</th>
                  <th className="px-2 py-2 text-left">Email</th>
                  <th className="px-2 py-2 text-left">Ejecutivo</th>
                  <th className="px-2 py-2 text-right">Comodato 24M</th>
                  <th className="px-2 py-2 text-left">Última compra</th>
                  <th className="px-2 py-2 text-left">Estado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.rut} className="border-t">
                    <td className="px-2 py-1">{r.rut}</td>
                    <td className="px-2 py-1">{r.nombre}</td>
                    <td className="px-2 py-1">{r.email}</td>
                    <td className="px-2 py-1">{r.ejecutivo}</td>
                    <td className="px-2 py-1 text-right">{clp(r.comodato24m)}</td>
                    <td className="px-2 py-1">
                      {r.ultimaCompra
                        ? r.ultimaCompra.toLocaleDateString("es-CL")
                        : "—"}
                    </td>
                    <td className="px-2 py-1 text-red-600">🔴 Sin compras 6M</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

