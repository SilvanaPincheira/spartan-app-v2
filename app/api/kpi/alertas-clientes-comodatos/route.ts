export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Papa from "papaparse";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

// Normalizar cabeceras
function normKey(k: string) {
  return (k || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

async function fetchCsv(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  const txt = await res.text();
  const parsed = Papa.parse(txt, { header: true, skipEmptyLines: true });
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
    // 1️⃣ Usuario logueado
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const email = user.email?.toLowerCase() ?? "";

    // 2️⃣ Leer la hoja de Google Sheets
    const url =
      "https://docs.google.com/spreadsheets/d/1_gD_uYjBh3NlWogDqiiU_kkrZTDueQ98kSrGfc92vSg/edit?gid=0#gid=0"; // 👈 reemplaza con tu ID real
    const rows = await fetchCsv(url);

    // 3️⃣ Filtrar por EMAIL_COL
    const admins = ["silvana.pincheira@spartan.cl", "jorge.beltran@spartan.cl"];
    let filtrado = rows;
    if (!admins.includes(email)) {
      filtrado = rows.filter(
        (r) => (r.email_col || "").toLowerCase().trim() === email
      );
    }

    // 4️⃣ Devolver columnas relevantes
    const columnas = [
      "rut_cliente",
      "nombre_cliente",
      "empleado_ventas",
      "ventas_quimicos_2025",
      "comodatos_activos_2021",
      "alerta_final",
      "email_col",
    ];
    const data = filtrado.map((r) => {
      const o: any = {};
      columnas.forEach((c) => (o[c] = r[c] ?? ""));
      return o;
    });

    return NextResponse.json({ data });
  } catch (err) {
    console.error("🔥 Error en API alertas-clientes-comodatos:", err);
    return NextResponse.json({ error: "Error en servidor" }, { status: 500 });
  }
}
