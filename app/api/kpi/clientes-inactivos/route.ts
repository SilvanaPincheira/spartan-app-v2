export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Papa from "papaparse";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

// Helpers simples
function normKey(k: string) {
  return (k || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}
function parseNumber(v: any) {
  const n = Number(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
function parseFecha(v: string) {
  if (!v) return "";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}
function rutKey(rut: string) {
  return rut?.toUpperCase().replace(/[^0-9K]/g, "") ?? "";
}
function rutDisplay(key: string) {
  return key.length > 1 ? `${key.slice(0, -1)}-${key.slice(-1)}` : key;
}
function extractEmails(row: any): string[] {
  const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  const emails: string[] = [];
  Object.keys(row)
    .filter((k) => k.startsWith("email_col"))
    .forEach((k) => {
      const matches = String(row[k] ?? "").match(emailRegex);
      if (matches) emails.push(...matches.map((m) => m.toLowerCase().trim()));
    });
  return Array.from(new Set(emails));
}
async function fetchCsv(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  const headers = parsed.meta.fields?.map(normKey) || [];
  return (parsed.data as any[]).map((row) => {
    const o: any = {};
    headers.forEach((h, i) => {
      const original = parsed.meta.fields?.[i] || "";
      o[h] = row[original] ?? "";
    });
    return o;
  });
}

export async function GET() {
  try {
    // 1️⃣ Usuario
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const email = user.email?.toLowerCase() ?? "";

    // 2️⃣ URLs CSV (ejemplo)
    const urlVentas = "https://docs.google.com/spreadsheets/d/.../export?format=csv&gid=VENTAS";
    const urlComodatos = "https://docs.google.com/spreadsheets/d/.../export?format=csv&gid=COMODATOS";

    const ventasRows = await fetchCsv(urlVentas);
    const comRows = await fetchCsv(urlComodatos);

    // 3️⃣ Mapear ventas PT últimos 6M (corte marzo 2025)
    const cutoff = "2025-03-01";
    const ventasMap = new Map<string, { ultima: string }>();
    for (const v of ventasRows) {
      const rut = rutKey(v["rut_cliente"] || v["codigo_cliente"]);
      if (!rut) continue;
      const itemCode = String(v["itemcode"] || "").toUpperCase();
      if (!itemCode.startsWith("PT")) continue;
      const fecha = parseFecha(v["docdate"]);
      if (!fecha) continue;
      if (!ventasMap.has(rut)) ventasMap.set(rut, { ultima: fecha });
      if (fecha > ventasMap.get(rut)!.ultima) ventasMap.get(rut)!.ultima = fecha;
    }

    // 4️⃣ Mapear comodatos >=2023
    const comMap = new Map<string, { total: number; nombre: string; emails: string[]; ejecutivo: string }>();
    for (const c of comRows) {
      const rut = rutKey(c["rut_cliente"]);
      if (!rut) continue;
      const fecha = parseFecha(c["fecha_contab"]);
      if (fecha && fecha < "2023-01-01") continue;
      const emails = extractEmails(c);
      if (emails.length === 0) continue; // obligatorio
      const total = parseNumber(c["total"]);
      const nombre = c["nombre_cliente"] || "";
      const ejecutivo = c["empleado_ventas"] || "";
      if (!comMap.has(rut)) comMap.set(rut, { total: 0, nombre, emails, ejecutivo });
      const entry = comMap.get(rut)!;
      entry.total += total;
    }

    // 5️⃣ Consolidar clientes inactivos
    const resultado: any[] = [];
    for (const [rut, info] of comMap) {
      const v = ventasMap.get(rut);
      const ultima = v?.ultima || null;
      const sinVentas = !v || (ultima && ultima < cutoff);
      if (!sinVentas) continue;
      resultado.push({
        rut: rutDisplay(rut),
        cliente: info.nombre,
        emails: info.emails,
        ejecutivo: info.ejecutivo,
        comodato: info.total,
        ultimaCompra: ultima || "—",
      });
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
