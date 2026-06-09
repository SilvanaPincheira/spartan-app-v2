import { NextResponse } from "next/server";
import Papa from "papaparse";

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

// Convierte valores numéricos si vienen como texto
function toNumber(value: any) {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

// Valida API KEY enviada por el integrador SAP
function validarApiKey(req: Request) {
  const apiKey = req.headers.get("x-api-key");
  return apiKey === process.env.SPARTANONE_API_KEY;
}

export async function GET(req: Request) {
  try {
    // 1️⃣ Validar API KEY
    if (!validarApiKey(req)) {
      return NextResponse.json(
        {
          ok: false,
          error: "No autorizado",
        },
        { status: 401 }
      );
    }

    // 2️⃣ Leer CSV desde Google Sheets
    const res = await fetch(URL, { cache: "no-store" });

    if (!res.ok) {
      throw new Error("No se pudo obtener el CSV de clientes");
    }

    const text = await res.text();

    // 3️⃣ Parsear CSV
    const parsed = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
    });

    if (!parsed.meta.fields) {
      throw new Error("No se detectaron cabeceras en clientes");
    }

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

    // 5️⃣ Contrato limpio para integración SAP
    const data = rows.map((r) => ({
      empleadoVentas: r.empleado_ventas ?? "",
      rut: r.rut ?? r.lictradnum ?? "",
      cardCode: r.cardcode ?? "",
      cardName: r.cardname ?? r.nombre ?? "",
      condicionPago: r.condicion_pago ?? "",
      giro: r.giro ?? "",
      email: r.e_mail ?? r.email ?? "",
      direccionDespacho:
        r.direccion_despacho ??
        r.dirección_despacho ??
        r.address ??
        "",
      despachoComuna: r.despacho_comuna ?? r.comuna ?? "",
      despachoCiudad: r.despacho_ciudad ?? r.ciudad ?? "",
      emailEjecutivo: r.email_col ?? "",
    }));

    // 6️⃣ Respuesta final
    return NextResponse.json({
      ok: true,
      endpoint: "clientes",
      source: "google_sheets",
      count: data.length,
      data,
    });
  } catch (err: any) {
    console.error("❌ Error /api/sap/clientes:", err);

    return NextResponse.json(
      {
        ok: false,
        error: "No se pudo leer Clientes",
        details: err.message,
      },
      { status: 500 }
    );
  }
}