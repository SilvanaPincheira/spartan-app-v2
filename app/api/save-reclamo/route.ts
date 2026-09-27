// app/api/save-reclamo/route.ts

import { NextResponse } from "next/server";

/**
 * Recibe el nuevo reclamo desde SpartanOne
 * y lo reenvía al WebApp de Google Apps Script.
 *
 * El Apps Script será responsable de:
 * - generar N° de reclamo correlativo
 * - generar fecha/hora de ingreso
 * - guardar el reclamo
 * - devolver numeroReclamo y fechaIngreso
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const SHEET_WEBAPP_URL =
      process.env.SHEET_RECLAMOS_WEBAPP_URL;

    if (!SHEET_WEBAPP_URL) {
      throw new Error(
        "Falta SHEET_RECLAMOS_WEBAPP_URL en las variables de entorno."
      );
    }

    console.log(
      "📤 Enviando nuevo reclamo a Apps Script:",
      JSON.stringify(body, null, 2)
    );

    const res = await fetch(
      SHEET_WEBAPP_URL,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(body),

        cache: "no-store",
      }
    );

    const text = await res.text();

    let resultado: any;

    try {
      resultado = JSON.parse(text);
    } catch {
      console.error(
        "❌ Respuesta no válida de Apps Script:",
        text
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Apps Script devolvió una respuesta no válida.",
          raw: text,
        },
        {
          status: 502,
        }
      );
    }

    if (
      !res.ok ||
      resultado.success === false
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            resultado.error ||
            "No se pudo guardar el reclamo.",
        },
        {
          status: 502,
        }
      );
    }

    console.log(
      "✅ Reclamo guardado:",
      resultado
    );

    /*
     * Devuelve al frontend exactamente
     * la información generada por Apps Script.
     *
     * Esperamos principalmente:
     *
     * numeroReclamo
     * fechaIngreso
     * estado
     */
    return NextResponse.json(
      {
        success: true,

        numeroReclamo:
          resultado.numeroReclamo ||
          resultado.id ||
          "",

        fechaIngreso:
          resultado.fechaIngreso ||
          "",

        estado:
          resultado.estado ||
          "Ingresado",

        ...resultado,
      },
      {
        status: 200,

        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
        },
      }
    );

  } catch (error) {
    console.error(
      "❌ Error en /api/save-reclamo:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Error desconocido al guardar el reclamo.",
      },
      {
        status: 500,
      }
    );
  }
}