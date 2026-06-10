import { NextResponse } from "next/server";
import Papa from "papaparse";

const URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTHJGESD71DkWv2kZWuYhuVMOPVKMp5S4eclXT7J7Yy9OUOIvh8mpdpGUNXCM5_XuPrThaoCefkPvzm/pub?output=csv";

function normalize(val: string) {
  return val
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w_]/g, "");
}

function validarApiKey(req: Request) {
  const apiKey = req.headers.get("x-api-key")?.trim();
  const expected = process.env.SPARTANONE_API_KEY?.trim();

  return apiKey === expected;
}

export async function GET(req: Request) {
  try {
    if (!validarApiKey(req)) {
      return NextResponse.json(
        { ok: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const res = await fetch(URL, { cache: "no-store" });

    if (!res.ok) {
      throw new Error("No se pudo obtener el CSV de clientes");
    }

    const text = await res.text();

    const parsed = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
    });

    if (!parsed.meta.fields) {
      throw new Error("No se detectaron cabeceras en clientes");
    }

    const headers = parsed.meta.fields.map(normalize);

    const rows = (parsed.data as any[]).map((row) => {
      const obj: any = {};

      headers.forEach((h, i) => {
        const original = parsed.meta.fields?.[i] ?? "";
        obj[h] = (row[original] ?? "").toString().trim();
      });

      return obj;
    });

    const data = rows.map((r) => ({
      empleadoVentas: r.empleado_ventas ?? "",
      rut: r.rut ?? r.lictradnum ?? "",
      cardCode: r.cardcode ?? "",
      cardName: r.cardname ?? r.nombre ?? "",
      condicionPago: r.condicion_pago ?? "",
      giro: r.giro ?? "",
      email: r.e_mail ?? r.email ?? "",
      direccionDespacho: r.direccion_despacho ?? r.address ?? "",
      despachoComuna: r.despacho_comuna ?? r.comuna ?? "",
      despachoCiudad: r.despacho_ciudad ?? r.ciudad ?? "",
      emailEjecutivo: r.email_col ?? "",
    }));

    return NextResponse.json({
      ok: true,
      endpoint: "clientes",
      source: "google_sheets",
      count: data.length,
      data,
    });
  } catch (err: any) {
    console.error("❌ Error GET /api/sap/clientes:", err);

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

export async function POST(req: Request) {
  try {
    if (!validarApiKey(req)) {
      return NextResponse.json(
        { ok: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    if (!process.env.SAP_SYNC_APPS_SCRIPT_URL) {
      return NextResponse.json(
        {
          ok: false,
          error: "Falta variable SAP_SYNC_APPS_SCRIPT_URL",
        },
        { status: 500 }
      );
    }

    const body = await req.json();

    const data = Array.isArray(body) ? body : [body];

    if (data.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No se recibieron clientes" },
        { status: 400 }
      );
    }

    const res = await fetch(process.env.SAP_SYNC_APPS_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tipo: "clientes",
        accion: "nuevo",
        data,
      }),
    });

    const resultText = await res.text();

    let result: any;

    try {
      result = JSON.parse(resultText);
    } catch {
      result = {
        ok: false,
        raw: resultText,
      };
    }

    if (!res.ok || result?.ok === false) {
      return NextResponse.json(
        {
          ok: false,
          endpoint: "clientes",
          error: "No se pudo registrar diferencial de clientes",
          result,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      endpoint: "clientes",
      source: "sap_sync",
      accion: "nuevo",
      registros: result.registros ?? data.length,
      result,
    });
  } catch (err: any) {
    console.error("❌ Error POST /api/sap/clientes:", err);

    return NextResponse.json(
      {
        ok: false,
        error: "Error al recibir clientes desde SAP",
        details: err?.message || "Error inesperado",
      },
      { status: 500 }
    );
  }
}