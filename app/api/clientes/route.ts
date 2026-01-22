import { NextResponse } from "next/server";
import Papa from "papaparse";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

const URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTHJGESD71DkWv2kZWuYhuVMOPVKMp5S4eclXT7J7Yy9OUOIvh8mpdpGUNXCM5_XuPrThaoCefkPvzm/pub?output=csv";

// Normaliza cabeceras
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
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    const email = user.email?.toLowerCase().trim() ?? "";

    // 2️⃣ Leer CSV
    const res = await fetch(URL, { cache: "no-store" });
    if (!res.ok) throw new Error("No se pudo obtener el CSV");

    const text = await res.text();

    // 3️⃣ Parsear CSV
    const parsed = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
    });

    if (!parsed.meta.fields)
      throw new Error("No se detectaron cabeceras");

    const headers = parsed.meta.fields.map(normalize);

    // 4️⃣ Normalizar filas
    const rows = (parsed.data as any[]).map((row) => {
      const obj: any = {};
      headers.forEach((h, i) => {
        const original = parsed.meta.fields?.[i] ?? "";
        obj[h] = (row[original] ?? "").toString().trim();
      });
      return obj;
    });

    // 5️⃣ Filtrar por EMAIL_COL
    const filtered = rows.filter((r) => {
      const emailCol = r.email_col?.toLowerCase().trim();
      return emailCol && emailCol === email;
    });

    // 6️⃣ 🔒 SANITIZAR / CONTRATO DEL BACKEND
    const data = filtered.map((r) => ({
      cardcode: r.cardcode ?? "",
      cardname: r.cardname ?? r.nombre ?? "",
      rut: r.rut ?? r.lictradnum ?? "",
      ejecutivo: r.empleado_ventas ?? "",
      direccion:
        r.direccion_despacho ??
        r.dirección_despacho ??
        r.address ??
        "",
      comuna: r.comuna ?? r.despacho_comuna ?? "",
      ciudad: r.ciudad ?? r.despacho_ciudad ?? "",
    }));

    // 7️⃣ Respuesta final
    return NextResponse.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (err: any) {
    console.error("❌ Error /api/clientes:", err);
    return NextResponse.json(
      {
        error: "No se pudo leer Clientes",
        details: err.message,
      },
      { status: 500 }
    );
  }
}
