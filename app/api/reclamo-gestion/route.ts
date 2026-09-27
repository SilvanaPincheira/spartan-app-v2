// app/api/reclamo-gestion/route.ts

import { NextRequest, NextResponse } from "next/server";

function getWebAppUrl() {
  const url = process.env.SHEET_RECLAMOS_WEBAPP_URL;

  if (!url) {
    throw new Error(
      "Falta SHEET_RECLAMOS_WEBAPP_URL en las variables de entorno."
    );
  }

  return url;
}

/* =========================================================
   GET
   Obtiene reclamo + investigación + acciones +
   seguimientos + historial
========================================================= */

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Falta el ID o N° de reclamo.",
        },
        { status: 400 }
      );
    }

    const WEBAPP_URL = getWebAppUrl();

    const url =
      `${WEBAPP_URL}?action=getGestion&id=${encodeURIComponent(id)}`;

    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
    });

    const text = await response.text();

    let data: any;

    try {
      data = JSON.parse(text);
    } catch {
      console.error(
        "Respuesta no JSON de Apps Script:",
        text
      );

      return NextResponse.json(
        {
          success: false,
          error: "Apps Script devolvió una respuesta no válida.",
        },
        { status: 502 }
      );
    }

    if (!response.ok || data.success === false) {
      return NextResponse.json(
        {
          success: false,
          error:
            data.error ||
            "No se pudo cargar la gestión del reclamo.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json(data, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error(
      "Error GET /api/reclamo-gestion:",
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
      { status: 500 }
    );
  }
}

/* =========================================================
   POST
   Guarda investigación, acciones, seguimiento,
   verificación o cierre.
========================================================= */

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.reclamoId && !body.numeroReclamo) {
      return NextResponse.json(
        {
          success: false,
          error: "Falta identificar el reclamo.",
        },
        { status: 400 }
      );
    }

    if (!body.etapa) {
      return NextResponse.json(
        {
          success: false,
          error: "Falta la etapa de gestión.",
        },
        { status: 400 }
      );
    }

    const WEBAPP_URL = getWebAppUrl();

    const response = await fetch(
      WEBAPP_URL,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          ...body,
          action: "guardarGestion",
        }),

        cache: "no-store",
      }
    );

    const text = await response.text();

    let data: any;

    try {
      data = JSON.parse(text);
    } catch {
      console.error(
        "Respuesta no JSON de Apps Script:",
        text
      );

      return NextResponse.json(
        {
          success: false,
          error: "Apps Script devolvió una respuesta no válida.",
        },
        { status: 502 }
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
            "No se pudo guardar la gestión.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json(data, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error(
      "Error POST /api/reclamo-gestion:",
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
      { status: 500 }
    );
  }
}