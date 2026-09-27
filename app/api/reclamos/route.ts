import { NextResponse } from "next/server";

export async function GET() {
  try {
    const WEBAPP_URL =
      process.env.SHEET_RECLAMOS_WEBAPP_URL;

    if (!WEBAPP_URL) {
      throw new Error(
        "Falta SHEET_RECLAMOS_WEBAPP_URL en las variables de entorno."
      );
    }

    const url =
      `${WEBAPP_URL}?action=listar`;

    const response =
      await fetch(url, {
        method: "GET",
        cache: "no-store",
      });

    const text =
      await response.text();

    let data: any;

    try {
      data =
        JSON.parse(text);
    } catch {
      console.error(
        "Respuesta no válida de Apps Script:",
        text
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Apps Script devolvió una respuesta no válida.",
        },
        {
          status: 502,
        }
      );
    }

    if (
      !response.ok ||
      data.success === false
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            data.error ||
            "No se pudieron cargar los reclamos.",
        },
        {
          status: 502,
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        total:
          data.total || 0,
        reclamos:
          Array.isArray(
            data.reclamos
          )
            ? data.reclamos
            : [],
      },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
        },
      }
    );

  } catch (error) {
    console.error(
      "Error GET /api/reclamos:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Error desconocido.",
      },
      {
        status: 500,
      }
    );
  }
}