// app/api/metas/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Papa from "papaparse";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

function normalize(header: string) {
  let h = header.toLowerCase().trim();

  // reemplazos básicos
  h = h
    .replace(/\s+/g, "_")
    .replace(/[^\w_]/g, "")
    .replace("meta_noviembre_2025", "meta_noviembre_2025")
    .replace("total_quimicos", "total_quimicos");

  // diferenciamos cumplimiento
  if (header.toLowerCase().includes("cumplimiento $")) return "cumplimiento_dinero";
  if (header.toLowerCase().includes("cumplimiento %")) return "cumplimiento_porcentaje";

  return h;
}

function parseNumber(val: any) {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const clean = val
      .replace(/\./g, "")
      .replace(/,/g, ".")
      .replace(/[^0-9.-]/g, "");
    const n = parseFloat(clean);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

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
    const email = user.email?.toLowerCase() ?? "";

    // 2️⃣ URL directa de Google Sheets
    const url =
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vQeg3EGhKOHiA9cRDqPioN5oaHZUOpDxB1olx-H6jkUIdBnyRvgEBJwe3IQeb3N7e9rnsQy4UnOQlk1/pub?gid=1307997110&single=true&output=csv";

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("No se pudo leer la hoja");

    const text = await res.text();

    // 3️⃣ Parseo con normalización de cabeceras
    const parsed = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      transformHeader: normalize,
    });

    // 4️⃣ Construir filas limpias
    const data = (parsed.data as any[]).map((row) => {
      const obj: any = {};
      for (const key in row) {
        obj[key] = row[key] ?? "";
      }
      return obj;
    });

    // 5️⃣ Filtrar por email
    const filtered = data.filter(
      (row) => row["email_col"]?.toLowerCase() === email
    );

    // 6️⃣ Mapear columnas que necesitamos
    const columnasOrdenadas = [
      "zona_chile",
      "gerencia",
      "supervisor",
      "vendedor",
      "pedido",
      "entrega",
      "total_quimicos",
      "no_son_equipo_venta",
      "meta_noviembre_2025",
      "cumplimiento_dinero",
      "cumplimiento_porcentaje",
    ];

    const cleaned = filtered.map((row) => {
      const obj: any = {};
      columnasOrdenadas.forEach((col) => {
        obj[col] =
          col.includes("meta") || col.includes("cumplimiento") || col.includes("total")
            ? parseNumber(row[col])
            : row[col] ?? "";
      });
      return obj;
    });

    console.log("✅ Fila ejemplo:", cleaned[0]);
    return NextResponse.json({ data: cleaned });
  } catch (err: any) {
    console.error("🔥 Error en API Metas:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
