export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Papa from "papaparse";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

// Función auxiliar para normalizar cabeceras
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
    // 1️⃣ Usuario autenticado
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // 2️⃣ Construir URL al CSV según el sheetName
    // 👇 Ojo: aquí asumo que todos los datasets están en el mismo SpreadsheetId
    const sheetName = params.sheetName;
    const spreadsheetId = process.env.SHEET_ID!;
    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${sheetName}`;

    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json({ error: "No se pudo leer la hoja" }, { status: 500 });
    }
    const text = await res.text();

    // 3️⃣ Parsear CSV
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });

    const headers = parsed.meta.fields?.map(normalize) || [];
    const data = (parsed.data as any[]).map((row) => {
      const obj: any = {};
      headers.forEach((h, i) => {
        const originalKey = parsed.meta.fields?.[i] || "";
        obj[h] = row[originalKey] ?? "";
      });
      return obj;
    });

    // 4️⃣ Filtrar por email
    const emailCol = headers.find((h) => h.includes("email"));
    const filtered = emailCol
      ? data.filter((row) => row[emailCol] === user.email)
      : data;

    return NextResponse.json({ data: filtered });
  } catch (err) {
    console.error("Error leyendo hoja:", err);
    return NextResponse.json({ error: "Error en servidor" }, { status: 500 });
  }
}
