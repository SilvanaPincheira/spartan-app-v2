const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyVxMfOG8pygsQn86LrFvtN_yyRep7-_bbiCiHDSAD4_CiEpMzAFZVl_onEjseSb2BIOA/exec";


/****************************************************
 * GET: LEER HISTORIAL PARA LA REPORTERÍA
 ****************************************************/

export async function GET() {
  try {
    const url = `${SCRIPT_URL}?action=listar`;

    console.log("📥 Consultando historial de evaluaciones...");

    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
    });

    const text = await res.text();

    let jsonResponse: any;

    try {
      jsonResponse = JSON.parse(text);
    } catch {
      console.error(
        "❌ Respuesta no válida de Apps Script:",
        text
      );

      return Response.json(
        {
          success: false,
          error:
            "Apps Script devolvió una respuesta no válida.",
        },
        { status: 502 }
      );
    }

    if (
      !res.ok ||
      jsonResponse.success === false
    ) {
      return Response.json(
        {
          success: false,
          error:
            jsonResponse.error ||
            "No se pudo obtener el historial.",
        },
        { status: 502 }
      );
    }

    console.log(
      `✅ Evaluaciones obtenidas: ${
        jsonResponse.total || 0
      }`
    );

    return Response.json(jsonResponse, {
      status: 200,
      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate",
      },
    });

  } catch (error) {
    console.error(
      "❌ Error en GET /api/historial-evaluaciones:",
      error
    );

    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Error interno al obtener las evaluaciones.",
      },
      { status: 500 }
    );
  }
}


/****************************************************
 * POST: GUARDAR UNA EVALUACIÓN
 ****************************************************/

export async function POST(req: Request) {
  try {
    const data = await req.json();

    console.log(
      "📤 Enviando datos al Apps Script..."
    );
    console.log(
      JSON.stringify(data, null, 2)
    );

    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
      cache: "no-store",
    });

    const text = await res.text();

    /*
     * Apps Script puede devolver JSON o texto plano.
     */
    let jsonResponse: any = {};

    try {
      jsonResponse = JSON.parse(text);
    } catch {
      jsonResponse = {
        success:
          res.ok &&
          text.includes("OK"),
        raw: text,
      };
    }

    console.log(
      "✅ Respuesta Apps Script:",
      jsonResponse
    );

    if (
      !res.ok ||
      jsonResponse.success === false
    ) {
      return Response.json(
        {
          success: false,
          error:
            jsonResponse.error ||
            "No se pudo guardar la evaluación.",
        },
        { status: 502 }
      );
    }

    return Response.json(
      jsonResponse,
      { status: 200 }
    );

  } catch (error) {
    console.error(
      "❌ Error en POST /api/historial-evaluaciones:",
      error
    );

    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Internal Server Error",
      },
      { status: 500 }
    );
  }
}