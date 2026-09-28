 // app/api/save-to-sheets/route.ts

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/*
 * Web App de Google Apps Script.
 *
 * IMPORTANTE:
 * Esta URL debe corresponder a la implementación /exec
 * actualmente publicada.
 */
const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyezzTCryZi1tKc8Tr7cJjSQ4FVxvnC6ucC-5wcDa-enUCDhsFT0hZYbXGg03oPTX2x9A/exec";

/* ============================================================
   HELPERS
============================================================ */

function sleep(ms: number) {
  return new Promise((resolve) =>
    setTimeout(resolve, ms)
  );
}

function textoCorto(
  texto: string,
  max = 1000
) {
  const limpio = String(
    texto || ""
  ).trim();

  if (limpio.length <= max) {
    return limpio;
  }

  return (
    limpio.slice(0, max) +
    "... [truncado]"
  );
}

function parseJsonSeguro(
  texto: string
) {
  try {
    return {
      ok: true as const,
      data: JSON.parse(texto),
    };
  } catch {
    return {
      ok: false as const,
      data: null,
    };
  }
}

/* ============================================================
   VERIFICAR NV EN GOOGLE SHEETS
============================================================ */

/*
 * Después de enviar una NV a Apps Script,
 * verificamos que realmente exista.
 *
 * Apps Script debe tener:
 *
 * doGet(e)
 *
 * que responda a:
 *
 * ?action=verificarNV&numeroNV=NV-XXXX
 */
async function verificarNV(
  numeroNV: string
): Promise<{
  existe: boolean;
  detalle?: any;
}> {
  if (!numeroNV) {
    return {
      existe: false,
    };
  }

  const url =
    `${APPS_SCRIPT_URL}` +
    `?action=verificarNV` +
    `&numeroNV=${encodeURIComponent(
      numeroNV
    )}` +
    `&_=${Date.now()}`;

  /*
   * Hacemos varios intentos porque Google Sheets
   * puede demorarse brevemente en reflejar
   * la escritura recién realizada.
   */
  for (
    let intento = 1;
    intento <= 5;
    intento++
  ) {
    try {
      if (intento > 1) {
        await sleep(700);
      }

      console.log(
        `🔎 Verificando ${numeroNV} en Sheets. Intento ${intento}/5`
      );

      const res =
        await fetch(
          url,
          {
            method: "GET",

            cache:
              "no-store",

            redirect:
              "follow",

            headers: {
              Accept:
                "application/json",
            },
          }
        );

      const texto =
        await res.text();

      const parsed =
        parseJsonSeguro(
          texto
        );

      console.log(
        "RESPUESTA VERIFICAR NV:",
        {
          numeroNV,
          intento,
          status:
            res.status,
          okHttp:
            res.ok,
          respuesta:
            textoCorto(
              texto
            ),
        }
      );

      if (
        res.ok &&
        parsed.ok &&
        parsed.data?.ok ===
          true &&
        parsed.data?.existe ===
          true
      ) {
        return {
          existe: true,
          detalle:
            parsed.data,
        };
      }
    } catch (
      error
    ) {
      console.error(
        `❌ Error verificando NV ${numeroNV}. Intento ${intento}:`,
        error
      );
    }
  }

  return {
    existe: false,
  };
}

/* ============================================================
   POST
============================================================ */

export async function POST(
  req: Request
) {
  try {
    /* --------------------------------------------------------
       1. LEER PAYLOAD
    -------------------------------------------------------- */

    const payload =
      await req.json();

    /*
     * Compatibilidad actual:
     *
     * NOTA DE VENTA:
     *
     * [
     *   {...},
     *   {...}
     * ]
     *
     *
     * COTIZACIÓN:
     *
     * {
     *   tipo: "Cotizacion",
     *   datos: [...]
     * }
     */

    const tipo =
      Array.isArray(
        payload
      )
        ? "NV"
        : String(
            payload?.tipo ||
              "NV"
          ).trim();

    const filas =
      Array.isArray(
        payload
      )
        ? payload
        : Array.isArray(
            payload?.datos
          )
        ? payload.datos
        : [];

    /* --------------------------------------------------------
       2. VALIDAR FILAS
    -------------------------------------------------------- */

    if (
      !Array.isArray(
        filas
      ) ||
      filas.length === 0
    ) {
      return NextResponse.json(
        {
          ok: false,

          error:
            "No se recibieron registros para guardar",
        },
        {
          status: 400,
        }
      );
    }

    /* --------------------------------------------------------
       3. VALIDACIONES ESPECIALES NV
    -------------------------------------------------------- */

    const esNV =
      tipo
        .trim()
        .toLowerCase() ===
      "nv";

    let numeroNV =
      "";

    if (esNV) {
      numeroNV =
        String(
          filas[0]
            ?.numeroNV ||
            ""
        ).trim();

      if (!numeroNV) {
        return NextResponse.json(
          {
            ok: false,

            error:
              "La Nota de Venta no contiene numeroNV",

            cliente:
              filas[0]
                ?.cliente ||
              "",
          },
          {
            status:
              400,
          }
        );
      }

      /*
       * Todas las líneas deben corresponder
       * a la misma Nota de Venta.
       */
      const filaInconsistente =
        filas.find(
          (
            fila: any
          ) =>
            String(
              fila
                ?.numeroNV ||
                ""
            ).trim() !==
            numeroNV
        );

      if (
        filaInconsistente
      ) {
        return NextResponse.json(
          {
            ok: false,

            error:
              "El payload contiene líneas con distintos números de Nota de Venta.",
          },
          {
            status:
              400,
          }
        );
      }
    }

    /* --------------------------------------------------------
       4. LOG DEL ENVÍO
    -------------------------------------------------------- */

    console.log(
      "===== ENVÍO A APPS SCRIPT ====="
    );

    console.log({
      tipo,
      numeroNV,
      filas:
        filas.length,
    });

    console.log(
      "==============================="
    );

    /* --------------------------------------------------------
       5. ENVIAR A APPS SCRIPT
    -------------------------------------------------------- */

    const res =
      await fetch(
        APPS_SCRIPT_URL,
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json",
          },

          body:
            JSON.stringify(
              payload
            ),

          cache:
            "no-store",

          redirect:
            "follow",
        }
      );

    /*
     * Siempre leemos primero como texto.
     *
     * Google Apps Script puede devolver HTML,
     * redirects o respuestas que no sean JSON.
     */
    const text =
      await res.text();

    const contentType =
      res.headers.get(
        "content-type"
      ) || "";

    console.log(
      "===== RESPUESTA APPS SCRIPT ====="
    );

    console.log({
      status:
        res.status,

      ok:
        res.ok,

      contentType,

      tipo,

      numeroNV,

      respuesta:
        textoCorto(
          text
        ),
    });

    console.log(
      "================================"
    );

    const parsed =
      parseJsonSeguro(
        text
      );

    /* ========================================================
       6. APPS SCRIPT DEVOLVIÓ JSON
    ======================================================== */

    if (
      parsed.ok
    ) {
      const json =
        parsed.data ||
        {};

      /*
       * Apps Script informó explícitamente
       * un error.
       */
      if (
        !res.ok ||
        json?.ok ===
          false ||
        json?.success ===
          false ||
        json?.status ===
          "error" ||
        json?.error
      ) {
        console.error(
          "❌ Apps Script informó error:",
          json
        );

        return NextResponse.json(
          {
            ok: false,

            error:
              json?.error ||
              json?.message ||
              `Apps Script respondió HTTP ${res.status}`,

            detalle:
              json,

            numeroNV:
              numeroNV ||
              undefined,
          },
          {
            status:
              res.status >=
              400
                ? res.status
                : 502,
          }
        );
      }

      /* ======================================================
         7. SI ES NV, NO CONFIAMOS SOLO EN "status: ok"

         Verificamos que realmente haya quedado escrita.
      ====================================================== */

      if (esNV) {
        /*
         * Espera inicial para que Sheets
         * termine de reflejar la escritura.
         */
        await sleep(
          500
        );

        const verificacion =
          await verificarNV(
            numeroNV
          );

        if (
          !verificacion.existe
        ) {
          console.error(
            `❌ Apps Script respondió éxito, pero ${numeroNV} NO fue encontrada en Google Sheets.`
          );

          return NextResponse.json(
            {
              ok: false,

              status:
                "error",

              numeroNV,

              error:
                `Apps Script respondió correctamente, pero la Nota de Venta ${numeroNV} no pudo ser confirmada en Google Sheets.`,

              detalleAppsScript:
                json,

              advertencia:
                "No se continuará con PDF/correo porque no fue posible confirmar el guardado.",
            },
            {
              status:
                502,
            }
          );
        }

        console.log(
          `✅ ${numeroNV} confirmada físicamente en Google Sheets.`
        );

        return NextResponse.json(
          {
            ...json,

            ok: true,

            status:
              "ok",

            numeroNV,

            rows:
              Number(
                json?.rows ??
                  filas.length
              ) ||
              filas.length,

            verificado:
              true,

            verificacion:
              verificacion.detalle,
          }
        );
      }

      /* ======================================================
         8. COTIZACIÓN

         Para Cotización seguimos utilizando
         la respuesta normal de Apps Script.
      ====================================================== */

      return NextResponse.json(
        {
          ...json,

          ok: true,

          status:
            json?.status ||
            "ok",

          rows:
            Number(
              json?.rows ??
                filas.length
            ) ||
            filas.length,
        }
      );
    }

    /* ========================================================
       9. APPS SCRIPT NO DEVOLVIÓ JSON
    ======================================================== */

    console.error(
      "❌ Apps Script no devolvió JSON:",
      textoCorto(
        text
      )
    );

    /*
     * Para NV todavía podemos comprobar
     * directamente si quedó escrita.
     */
    if (esNV) {
      await sleep(
        500
      );

      const verificacion =
        await verificarNV(
          numeroNV
        );

      /*
       * Aunque la respuesta de Apps Script haya sido
       * incorrecta, si la NV existe físicamente,
       * consideramos el guardado confirmado.
       */
      if (
        verificacion.existe
      ) {
        console.warn(
          `⚠️ ${numeroNV} fue guardada aunque Apps Script no devolvió JSON válido.`
        );

        return NextResponse.json(
          {
            ok: true,

            status:
              "ok",

            numeroNV,

            rows:
              filas.length,

            verificado:
              true,

            recuperado:
              true,

            verificacion:
              verificacion.detalle,

            warning:
              "Apps Script no devolvió una respuesta JSON válida, pero la Nota de Venta fue confirmada en Google Sheets.",
          }
        );
      }
    }

    /* ========================================================
       10. NO SE PUDO CONFIRMAR
    ======================================================== */

    return NextResponse.json(
      {
        ok: false,

        status:
          "error",

        error:
          esNV
            ? `No fue posible confirmar que la Nota de Venta ${numeroNV} haya quedado guardada en Google Sheets.`
            : "Apps Script no devolvió una respuesta válida.",

        numeroNV:
          numeroNV ||
          undefined,

        httpStatusAppsScript:
          res.status,

        contentType,

        raw:
          textoCorto(
            text
          ),
      },
      {
        status: 502,
      }
    );
  } catch (
    err: any
  ) {
    console.error(
      "❌ Error en save-to-sheets:",
      err
    );

    return NextResponse.json(
      {
        ok: false,

        status:
          "error",

        error:
          "Excepción en save-to-sheets",

        message:
          err instanceof
          Error
            ? err.message
            : String(
                err
              ),
      },
      {
        status: 500,
      }
    );
  }
}