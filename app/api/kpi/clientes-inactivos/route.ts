export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Papa from "papaparse";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

/* ================== Helpers ================== */

// Normalizar RUT base (ej: "C15880311-9A" → "15880311-9")
function rutBase(raw: string): string {
  if (!raw) return "";
  let s = raw.toUpperCase().trim();
  s = s.replace(/^C/, ""); // quitar prefijo C
  s = s.replace(/[A-Z]$/, ""); // quitar sufijo sucursal
  s = s.replace(/[^0-9K]/g, ""); // dejar solo dígitos y K
  return s;
}
function rutDisplay(base: string): string {
  if (!base) return "";
  if (base.length < 2) return base;
  return `${base.slice(0, -1)}-${base.slice(-1)}`;
}

function parseFecha(v: string): string {
  if (!v) return "";
  const s = v.trim();
  // dd/MM/yyyy
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    const d = m[1].padStart(2, "0");
    const mo = m[2].padStart(2, "0");
    return `${m[3]}-${mo}-${d}`;
  }
  // yyyy-MM-dd
  const m2 = s.match(/^(\d{4})[/-](\d{2})[/-](\d{2})$/);
  if (m2) return s;
  const d2 = new Date(s);
  if (!isNaN(d2.getTime())) return d2.toISOString().slice(0, 10);
  return "";
}

function parseNumber(v: any): number {
  if (!v) return 0;
  const s = String(v).replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function extractEmails(row: any): string[] {
  const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  const emails: string[] = [];
  Object.keys(row)
    .filter((k) => k.toLowerCase().startsWith("email"))
    .forEach((k) => {
      const matches = String(row[k] ?? "").match(emailRegex);
      if (matches) emails.push(...matches.map((m) => m.toLowerCase().trim()));
    });
  return Array.from(new Set(emails));
}

async function fetchCsv(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  const txt = await res.text();
  const parsed = Papa.parse(txt, { header: true, skipEmptyLines: true });
  return parsed.data as any[];
}

/* ================== Handler ================== */

export async function GET() {
  try {
    // 1️⃣ Usuario autenticado
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const email = user.email?.toLowerCase().trim() ?? "";

    // 2️⃣ URLs de Google Sheets (cambia por tus IDs reales)
    const urlVentas =
      "https://docs.google.com/spreadsheets/d/1MY531UHJDhxvHsw6-DwlW8m4BeHwYP48MUSV98UTc1s/edit?gid=871602912#gid=871602912";
    const urlComodatos =
      "https://docs.google.com/spreadsheets/d/1MY531UHJDhxvHsw6-DwlW8m4BeHwYP48MUSV98UTc1s/edit?gid=551810728#gid=551810728";

    const ventasRows = await fetchCsv(urlVentas);
    const comRows = await fetchCsv(urlComodatos);

    // 3️⃣ Mapear ventas PT últimos 6M (corte marzo 2025)
    const cutoff = "2025-03-01";
    const ventasMap = new Map<string, { ultima: string }>();
    for (const v of ventasRows) {
      const rut = rutBase(v["Rut Cliente"] || v["Codigo Cliente"]);
      if (!rut) continue;

      const itemCode = String(v["ItemCode"] || "").toUpperCase();
      if (!itemCode.startsWith("PT")) continue; // solo químicos

      const fecha = parseFecha(v["DocDate"]);
      if (!fecha) continue;

      if (!ventasMap.has(rut)) ventasMap.set(rut, { ultima: fecha });
      const entry = ventasMap.get(rut)!;
      if (fecha > entry.ultima) entry.ultima = fecha;
    }

    // 4️⃣ Mapear comodatos vigentes (>= 2023, con EMAIL_COL)
    const comMap = new Map<
      string,
      { total: number; nombre: string; emails: string[]; ejecutivo: string }
    >();
    for (const c of comRows) {
      const rut = rutBase(c["Rut Cliente"]);
      if (!rut) continue;

      const fecha = parseFecha(c["Fecha Contab"]);
      if (fecha && fecha < "2023-01-01") continue; // solo vigentes

      const emails = extractEmails(c);
      if (emails.length === 0) continue; // sin EMAIL_COL → fuera

      const total = parseNumber(c["Total"]);
      const nombre = c["Nombre Cliente"] || "";
      const ejecutivo = c["Empleado ventas"] || "";

      if (!comMap.has(rut)) {
        comMap.set(rut, { total: 0, nombre, emails, ejecutivo });
      }
      comMap.get(rut)!.total += total;
    }

    // 5️⃣ Consolidar clientes inactivos
    const resultado: any[] = [];
    for (const [rut, info] of comMap) {
      const v = ventasMap.get(rut);
      const ultima = v?.ultima || null;
      const sinVentas = !v || (ultima && ultima < cutoff);

      if (sinVentas) {
        resultado.push({
          rut: rutDisplay(rut),
          cliente: info.nombre,
          emails: info.emails,
          ejecutivo: info.ejecutivo,
          comodato: info.total,
          ultimaCompra: ultima || "—",
        });
      }
    }

    // 6️⃣ Filtrar por usuario logueado
    const admins = ["silvana.pincheira@spartan.cl", "jorge.beltran@spartan.cl"];
    let filtrado = resultado;
    if (!admins.includes(email)) {
      filtrado = resultado.filter((r) => r.emails.includes(email));
    }

    return NextResponse.json({ data: filtrado });
  } catch (err) {
    console.error("🔥 Error en API clientes-inactivos:", err);
    return NextResponse.json({ error: "Error en servidor" }, { status: 500 });
  }
}
