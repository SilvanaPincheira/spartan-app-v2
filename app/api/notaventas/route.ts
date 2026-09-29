import { NextResponse } from "next/server";

/* ============================================================================
   ⚙️ APPS SCRIPT NOTAS DE VENTA
   ============================================================================ */

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbzx33T5foTEYYXV-r8Rkib9z2Rm9DcJTakZft7Z_UmYX2ItBK8uLJwEgjarfU6HF13ALQ/exec";

/* ============================================================================
   🚀 GET — RESERVAR SIGUIENTE CORRELATIVO
   ============================================================================ */

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const email = (searchParams.get("email") || "")
      .toLowerCase()
      .trim();

    if (!email) {
      return NextResponse.json(
        {
          ok: false,
          status: "error",
          error: "Se requiere el email del ejecutivo",
        },
        { status: 400 }
      );
    }

    /* ------------------------------------------------------------------------
       Apps Script será desde ahora la autoridad del correlativo.

       IMPORTANTE:
       Esta llamada RESERVA el número.
       ------------------------------------------------------------------------ */

    const url =
      `${APPS_SCRIPT_URL}` +
      `?accion=correlativo` +
      `&email=${encodeURIComponent(email)}` +
      `&_=${Date.now()}`;

    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
      },
    });

    const text = await res.text();

    console.log("===== CORRELATIVO APPS SCRIPT =====");
    console.log("HTTP:", res.status);
    console.log("Email:", email);
    console.log("Respuesta:", text);
    console.log("===================================");

    let json: any;

    try {
      json = JSON.parse(text);
    } catch {
      return NextResponse.json(
        {
          ok: false,
          status: "error",
          error: "Apps Script no devolvió JSON válido",
          raw: text,
        },
        { status: 500 }
      );
    }

    if (
      !res.ok ||
      json?.ok !== true ||
      json?.status !== "ok" ||
      !json?.numeroNV
    ) {
      return NextResponse.json(
        {
          ok: false,
          status: "error",
          error:
            json?.error ||
            json?.message ||
            "No fue posible obtener el correlativo",
          detalle: json,
        },
        { status: 500 }
      );
    }

    /* ------------------------------------------------------------------------
       Respuesta limpia para page.tsx
       ------------------------------------------------------------------------ */

    return NextResponse.json({
      ok: true,
      status: "ok",

      email: json.email || email,

      year: json.year,

      ultimoEnSheet:
        Number(json.ultimoEnSheet || 0),

      ultimoReservado:
        Number(json.ultimoReservado || 0),

      siguienteCorrelativo:
        Number(json.siguienteCorrelativo || 0),

      numeroNV: String(json.numeroNV),

      reservado:
        json.reservado === true,
    });
  } catch (err: any) {
    console.error(
      "❌ Error obteniendo correlativo NV:",
      err
    );

    return NextResponse.json(
      {
        ok: false,
        status: "error",
        error:
          err instanceof Error
            ? err.message
            : String(err),
      },
      { status: 500 }
    );
  }
}