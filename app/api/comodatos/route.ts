import { NextResponse } from "next/server";
import Papa from "papaparse";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

const URL =
  "https://docs.google.com/spreadsheets/d/1MY531UHJDhxvHsw6-DwlW8m4BeHwYP48MUSV98UTc1s/export?format=csv&gid=551810728";

function normalize(val: string) {
  return val?.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^\w_]/g, "");
}

export async function GET() {
  try {
    // 1️⃣ Usuario logueado
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const email = user.email?.toLowerCase() ?? "";

    // 2️⃣ Leer CSV desde Google Sheets
    const res = await fetch(URL, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ error: "Error al leer hoja Comodatos" }, { status: 500 });
    }

    const text = await res.text();
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });

    // 3️⃣ Normalizar cabeceras
    const headers = parsed.meta.fields?.map(normalize) || [];
    const data = (parsed.data as any[]).map((row) => {
      const obj: any = {};
      headers.forEach((h, i) => {
        obj[h] = row[parsed.meta.fields?.[i] || ""] ?? "";
      });
      return obj;
    });

    // 4️⃣ Filtrar por usuario logueado (EMAIL_COL)
    const admins = ["silvana.pincheira@spartan.cl", "jorge.beltran@spartan.cl"];
    let filtered = data;
    if (!admins.includes(email)) {
      filtered = data.filter(
        (row) => (row["email_col"] || "").toString().trim().toLowerCase() === email
      );
    }

    return NextResponse.json({ data: filtered });
  } catch (err) {
    console.error("🔥 Error API Comodatos:", err);
    return NextResponse.json({ error: "No se pudo leer Comodatos" }, { status: 500 });
  }
}
