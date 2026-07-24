import { NextResponse } from "next/server";

const APPS_SCRIPT_URL =
  "AQUI_DEBES_PONER_LA_URL_PUBLICADA_DEL_APPS_SCRIPT_DE_COTIZACIONES";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const datos = body?.datos;

    if (!Array.isArray(datos) || datos.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "No se recibieron datos válidos para guardar.",
        },
        { status: 400 }
      );
    }

    const filaSinNumero = datos.find(
      (fila: any) => !String(fila?.numeroCTZ || "").trim()
    );

    if (filaSinNumero) {
      return NextResponse.json(
        {
          ok: false,
          error: "La cotización no contiene numeroCTZ.",
          cliente: filaSinNumero?.cliente || "",
        },
        { status: 400 }
      );
    }

    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ datos }),
    });

    const text = await response.text();

    let json: any;

    try {
      json = JSON.parse(text);
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: "Apps Script no devolvió un JSON válido.",
          raw: text,
        },
        { status: 500 }
      );
    }

    if (!response.ok || json.success === false || json.ok === false) {
      return NextResponse.json(
        {
          ok: false,
          error:
            json.error ||
            `Apps Script respondió con código ${response.status}.`,
          respuesta: json,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      rows: Number(json.rows || datos.length),
      numeroCTZ: datos[0]?.numeroCTZ || "",
    });
  } catch (error: any) {
    console.error("❌ Error en /api/save-cotizacion:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          "Ocurrió un error al guardar la cotización.",
      },
      { status: 500 }
    );
  }
}