export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Papa from "papaparse";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

// 🔧 Normalizar cabeceras
function normalize(val: string) {
  return val
    ?.toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w_]/g, "");
}

type Params = { params: { sheetName: string } };

// ✅ GET: devolver solo las filas del usuario logueado
export async function GET(req: Request, { params }: Params) {
  try {
    // 1️⃣ Usuario autenticado
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const email = user?.email?.toLowerCase() ?? "";

    // 2️⃣ Decodificar nombre de la hoja (soporta espacios y mayúsculas)
    const sheetName = decodeURIComponent(params.sheetName);
    const spreadsheetId = process.env.SHEET_ID!;
    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${sheetName}`;

    console.log("📄 Leyendo hoja:", sheetName);
    console.log("🌐 URL generada:", url);

    // 3️⃣ Descargar CSV
    const res = await fetch(url);
    if (!res.ok) {
      console.error("❌ Error al leer hoja:", await res.text());
      return NextResponse.json({ error: "No se pudo leer la hoja" }, { status: 500 });
    }

    const text = await res.text();
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });

    // 4️⃣ Normalizar cabeceras
    const headers = parsed.meta.fields?.map(normalize) || [];
    const data = (parsed.data as any[]).map((row) => {
      const obj: any = {};
      headers.forEach((h, i) => {
        const originalKey = parsed.meta.fields?.[i] || "";
        obj[h] = row[originalKey] ?? "";
      });
      return obj;
    });

    // 5️⃣ Filtrar solo filas del usuario logueado (EMAIL_COL)
    const filtered = data.filter(
      (row) =>
        row["email_col"]?.toString().trim().toLowerCase() === email
    );

    console.log("✅ Filas totales:", data.length, "→ Filtradas:", filtered.length);

    return NextResponse.json({ data: filtered });
  } catch (err) {
    console.error("🔥 Error en API Sheets:", err);
    return NextResponse.json({ error: "Error en servidor" }, { status: 500 });
  }
}

