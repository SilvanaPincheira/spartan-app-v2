// app/api/save-to-sheets/route.ts

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/*
 * Web App de Google Apps Script.
 */
const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyezzTCryZi1tKc8Tr7cJjSQ4FVxvnC6ucC-5wcDa-enUCDhsFT0hZYbXGg03oPTX2x9A/exec";

/* =========================================================
   HELPERS
========================================================= */

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

/*
 * Intenta interpretar una respuesta
 * como JSON.
 */
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

/*
 * Consulta a Apps Script para confirmar
 * si una NV ya existe en la hoja.
 *
 * Se usa solamente cuando el POST
 * guardó aparentemente la información
 * pero la respuesta no llegó como JSON.
 */
async function verificarNV(
  numeroNV: string
) {
  if (!numeroNV) {
    return false;
  }

  const url =
    `${APPS_SCRIPT_URL}` +
    `?action=verificarNV` +
    `&numeroNV=${encodeURIComponent(
      numeroNV
    )}`;

  /*
   * Hacemos hasta 3 intentos porque
   * Sheets puede tardar unos milisegundos
   * en reflejar el dato recién escrito.
   */
  for (
    let intento = 1;
    intento <= 3;
    intento++
  ) {
    try {
      if (intento > 1) {
        await sleep(600);
      }

      const res = await fetch(
        url,
        {
          method: "GET",
          cache: "no-store",
          redirect: "follow",
        }
      );

      const texto =
        await res.text();

      const parsed =
        parseJsonSeguro(texto);

      if (
        res.ok &&
        parsed.ok &&
        parsed.data?.ok === true &&
        parsed.data?.existe === true
      ) {
        return true;
      }
    } catch (error) {
      console.error(
        `Error verificando NV intento ${intento}:`,
        error
      );
    }
  }

  return false;
}

/* =========================================================
   POST
========================================================= */

export async function POST(
  req: Request
) {
  try {
    const payload =
      await req.json();

    /*
     * Compatibilidad:
     *
     * NV:
     * [
     *   {...},
     *   {...}
     * ]
     *
     * Cotización:
     * {
     *   tipo: "Cotizacion",
     *   datos: [...]
     * }
     */

    const tipo =
      Array.isArray(payload)
        ? "NV"
        : String(
            payload?.tipo || "NV"
          );

    const filas =
      Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.datos)
        ? payload.datos
        : [];

    if (
      !Array.isArray(filas) ||
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

    /*
     * Para NV exigimos numeroNV.
     */
    let numeroNV = "";

    if (
      tipo
        .trim()
        .toLowerCase() === "nv"
    ) {
      numeroNV = String(
        filas[0]?.numeroNV || ""
      ).trim();

      if (!numeroNV) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "La Nota de Venta no contiene numeroNV",
            cliente:
              filas[0]?.cliente || "",
          },
          {
            status: 400,
          }
        );
      }

      /*
       * Todas las líneas deben
       * pertenecer a la misma NV.
       */
      const filaInconsistente =
        filas.find(
          (fila: any) =>
            String(
              fila?.numeroNV || ""
            ).trim() !==
            numeroNV
        );

      if (filaInconsistente) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "El payload contiene líneas con distintos números de Nota de Venta.",
          },
          {
            status: 400,
          }
        );
      }
    }

    /* =====================================================
       ENVIAR A APPS SCRIPT
    ===================================================== */

    const res =
      await fetch(
        APPS_SCRIPT_URL,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify(
            payload
          ),

          cache: "no-store",

          redirect: "follow",
        }
      );

    /*
     * Siempre leemos como texto primero.
     * Nunca usamos res.json() directamente,
     * porque Google a veces devuelve HTML.
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
      status: res.status,
      ok: res.ok,
      contentType,
      numeroNV,
      respuesta:
        textoCorto(text),
    });

    console.log(
      "================================"
    );

    const parsed =
      parseJsonSeguro(text);

    /* =====================================================
       RESPUESTA JSON NORMAL
    ===================================================== */

    if (parsed.ok) {
      const json =
        parsed.data || {};

      if (
        !res.ok ||
        json?.ok === false ||
        json?.success === false ||
        json?.status ===
          "error" ||
        json?.error
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              json?.error ||
              json?.message ||
              `Apps Script respondió HTTP ${res.status}`,
            detalle: json,
          },
          {
            status:
              res.status >= 400
                ? res.status
                : 502,
          }
        );
      }

      return NextResponse.json({
        ...json,

        /*
         * Estandarizamos siempre ok=true
         * para facilitar el frontend.
         */
        ok: true,
      });
    }

    /* =====================================================
       GOOGLE DEVOLVIÓ ALGO QUE NO ES JSON
    ===================================================== */

    console.error(
      "Apps Script no devolvió JSON:",
      textoCorto(text)
    );

    /*
     * Si es una NV, antes de declarar
     * error comprobamos si realmente
     * quedó guardada.
     */
    if (numeroNV) {
      /*
       * Pequeña espera antes
       * de consultar la hoja.
       */
      await sleep(500);

      const guardada =
        await verificarNV(
          numeroNV
        );

      if (guardada) {
        console.warn(
          `⚠️ ${numeroNV} fue guardada, aunque Apps Script no devolvió JSON. Se continúa el proceso.`
        );

        /*
         * IMPORTANTE:
         *
         * Respondemos éxito.
         * Así page.tsx continúa con:
         *
         * PDF
         * ↓
         * correo
         */
        return NextResponse.json({
          ok: true,
          status: "ok",
          numeroNV,
          rows: filas.length,

          recuperado: true,

          warning:
            "Apps Script no devolvió una respuesta JSON válida, pero la Nota de Venta fue verificada en Google Sheets.",
        });
      }
    }

    /* =====================================================
       NO PUDIMOS CONFIRMAR EL GUARDADO
    ===================================================== */

    return NextResponse.json(
      {
        ok: false,

        error:
          "Apps Script no devolvió una respuesta válida y no fue posible confirmar el guardado.",

        numeroNV,

        httpStatusAppsScript:
          res.status,

        contentType,

        raw: textoCorto(text),
      },
      {
        status: 502,
      }
    );

  } catch (err: any) {
    console.error(
      "Error en save-to-sheets:",
      err
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          "Excepción en save-to-sheets",

        message:
          err instanceof Error
            ? err.message
            : String(err),
      },
      {
        status: 500,
      }
    );
  }
}