// app/api/reclamos/route.ts

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  createRouteHandlerClient,
} from "@supabase/auth-helpers-nextjs";

/* =========================================================
   USUARIOS DE CONTROL DE CALIDAD
========================================================= */

const CORREOS_CONTROL_CALIDAD = [
  "control.calidad@spartan.cl",
  "alexandra.morales@spartan.cl",
];

/* =========================================================
   HELPERS
========================================================= */

function getWebAppUrl() {
  const url =
    process.env.SHEET_RECLAMOS_WEBAPP_URL;

  if (!url) {
    throw new Error(
      "Falta SHEET_RECLAMOS_WEBAPP_URL en las variables de entorno."
    );
  }

  return url;
}

function normalizar(
  valor: unknown
) {
  return String(valor || "")
    .trim()
    .toLowerCase();
}

/*
 * Sirve como respaldo para reclamos antiguos
 * que no tienen todavía "Correo Ejecutivo".
 *
 * jorge.beltran
 * JORGE BELTRAN
 *
 * ambos quedan:
 * jorgebeltran
 */
function normalizarNombre(
  valor: unknown
) {
  return normalizar(valor)
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /[^a-z0-9]/g,
      ""
    );
}

/* =========================================================
   USUARIO AUTENTICADO
========================================================= */

async function obtenerUsuarioActual() {
  const cookieStore =
    await cookies();

  const supabase =
    createRouteHandlerClient({
      cookies: () =>
        cookieStore,
    });

  const {
    data: {
      user,
    },
    error,
  } =
    await supabase.auth.getUser();

  if (
    error ||
    !user ||
    !user.email
  ) {
    return null;
  }

  const email =
    user.email
      .trim()
      .toLowerCase();

  return {
    email,

    esCalidad:
      CORREOS_CONTROL_CALIDAD.includes(
        email
      ),
  };
}

/* =========================================================
   VALIDAR SI EL RECLAMO PERTENECE AL EJECUTIVO
========================================================= */

function reclamoPerteneceAEjecutivo(
  reclamo: Record<string, any>,
  emailUsuario: string
) {
  const email =
    normalizar(
      emailUsuario
    );

  /*
   * =====================================================
   * RECLAMOS NUEVOS
   *
   * Esta es la validación principal.
   * =====================================================
   */

  const correoEjecutivo =
    normalizar(
      reclamo[
        "Correo Ejecutivo"
      ]
    );

  if (correoEjecutivo) {
    return (
      correoEjecutivo ===
      email
    );
  }

  /*
   * =====================================================
   * RECLAMOS HISTÓRICOS
   *
   * Antes no existía Correo Ejecutivo.
   *
   * Intentamos comparar:
   *
   * Ejecutivo de ventas:
   * jorge.beltran
   *
   * con:
   * jorge.beltran@spartan.cl
   * =====================================================
   */

  const ejecutivoHistorico =
    normalizarNombre(
      reclamo[
        "Ejecutivo de ventas"
      ]
    );

  const usuarioDesdeCorreo =
    normalizarNombre(
      email.split("@")[0]
    );

  return Boolean(
    ejecutivoHistorico &&
    usuarioDesdeCorreo &&
    ejecutivoHistorico ===
      usuarioDesdeCorreo
  );
}

/* =========================================================
   GET
========================================================= */

export async function GET() {
  try {
    /* ===============================================
       USUARIO ACTUAL
    =============================================== */

    const usuario =
      await obtenerUsuarioActual();

    if (!usuario) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Sesión no válida.",
        },
        {
          status: 401,
        }
      );
    }

    /* ===============================================
       APPS SCRIPT
    =============================================== */

    const WEBAPP_URL =
      getWebAppUrl();

    const url =
      `${WEBAPP_URL}?action=listar`;

    const response =
      await fetch(
        url,
        {
          method: "GET",
          cache: "no-store",
        }
      );

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

    /* ===============================================
       TODOS LOS RECLAMOS
    =============================================== */

    const todosLosReclamos =
      Array.isArray(
        data.reclamos
      )
        ? data.reclamos
        : [];

    /* ===============================================
       CONTROL DE ACCESO
    =============================================== */

    const reclamosVisibles =
      usuario.esCalidad
        /*
         * CONTROL DE CALIDAD
         * VE TODO.
         */
        ? todosLosReclamos

        /*
         * EJECUTIVOS
         * SOLO VEN LOS PROPIOS.
         */
        : todosLosReclamos.filter(
            (
              reclamo:
                Record<
                  string,
                  any
                >
            ) =>
              reclamoPerteneceAEjecutivo(
                reclamo,
                usuario.email
              )
          );

    /* ===============================================
       RESPUESTA
    =============================================== */

    return NextResponse.json(
      {
        success: true,

        usuarioActual:
          usuario.email,

        rol:
          usuario.esCalidad
            ? "calidad"
            : "ejecutivo",

        puedeGestionar:
          usuario.esCalidad,

        /*
         * Importante:
         * total corresponde a lo que
         * realmente puede visualizar
         * este usuario.
         */
        total:
          reclamosVisibles.length,

        reclamos:
          reclamosVisibles,
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