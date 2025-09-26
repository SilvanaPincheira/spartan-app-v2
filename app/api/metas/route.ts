export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Papa from "papaparse";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

function normalize(val: string) {
  return val
    ?.toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w_]/g, "");
}

export async function GET() {
  try {
    // 1️⃣ Usuario autenticado
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const email = user.email?.toLowerCase() ?? "";

    // 2️⃣ URL directa de Google Sheets (formato CSV)
    const url =
      "https://docs.google.com/spreadsheets/d/1GASOV0vl85q5STfvDn5hdZFD0Mwcj2SzXM6IqvgI50A/gviz/tq?tqx=out:csv&sheet=meta";

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.error("❌ Error al leer hoja:", await res.text());
      return NextResponse.json({ error: "No se pudo leer la hoja" }, { status: 500 });
    }

    const text = await res.text();
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });

    // 3️⃣ Normalizar cabeceras
    const headers = parsed.meta.fields?.map(normalize) || [];
    const data = (parsed.data as any[]).map((row) => {
      const obj: any = {};
      headers.forEach((h, i) => {
        const original = parsed.meta.fields?.[i] || "";
        obj[h] = row[original] ?? "";
      });
      return obj;
    });

    // 4️⃣ Filtrar por EMAIL_COL
    const filtered = data.filter(
      (row) => row["email_col"]?.toLowerCase() === email
    );

    // 5️⃣ Solo devolver las columnas relevantes
    const columnasOrdenadas = [
      "zona_chile",
      "gerencia",
      "supervisor",
      "vendedor",
      "pdido",
      "entrega",
      "total_quimicos",
      "no_son_equipo_venta",
      "meta_septiembre_2025",
      "cumplimiento",
      "cumplimiento_",
    ];

    const cleaned = filtered.map((row) => {
      const obj: any = {};
      columnasOrdenadas.forEach((col) => {
        obj[col] = row[col] ?? "";
      });
      return obj;
    });

    console.log("✅ Metas:", cleaned.length, "filas para", email);

    return NextResponse.json({ data: cleaned });
  } catch (err) {
    console.error("🔥 Error en API Metas:", err);
    return NextResponse.json({ error: "Error en servidor" }, { status: 500 });
  }
}
