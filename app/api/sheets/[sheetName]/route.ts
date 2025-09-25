export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Papa from "papaparse";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

// 🔧 Función para normalizar cabeceras
function normalize(val: string) {
  return val
    ?.toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w_]/g, "");
}

type Params = { params: { sheetName: string } };

export async function GET(req: Request, { params }: Params) {
  try {
    // 1️⃣ Obtener usuario autenticado
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // 2️⃣ Email normalizado del usuario
    const email = user?.email?.toLowerCase() ?? "";

    // 3️⃣ Construir URL al CSV de la hoja
    const sheetName = params.sheetName;
    const spreadsheetId = process.env.SHEET_ID!;
    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${sheetName}`;

    const res = await fetch(url);
    if (!res.ok) {
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

    // 5️⃣ Filtrar solo por filas del usuario logueado (EMAIL_COL)
    const filtered = data.filter(
      (row) =>
        row["email_col"]?.toString().trim().toLowerCase() === email
    );

    return NextResponse.json({ data: filtered });
  } catch (err) {
    console.error("Error leyendo hoja:", err);
    return NextResponse.json({ error: "Error en servidor" }, { status: 500 });
  }
}

