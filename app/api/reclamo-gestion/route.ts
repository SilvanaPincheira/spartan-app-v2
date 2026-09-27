// app/api/reclamo-gestion/route.ts

import {
    NextRequest,
    NextResponse,
  } from "next/server";
  
  import { cookies } from "next/headers";
  
  import {
    createRouteHandlerClient,
  } from "@supabase/auth-helpers-nextjs";
  
  /* =========================================================
     USUARIOS CONTROL DE CALIDAD
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
  
  /**
   * Normaliza email/texto.
   */
  function normalizar(
    valor: unknown
  ) {
    return String(
      valor || ""
    )
      .trim()
      .toLowerCase();
  }
  
  /**
   * Sirve principalmente para reclamos históricos
   * donde no existía todavía Correo Ejecutivo.
   *
   * jorge.beltran
   * JORGE BELTRAN
   *
   * ambos terminan como:
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
  
    const esCalidad =
      CORREOS_CONTROL_CALIDAD.includes(
        email
      );
  
    return {
      email,
      esCalidad,
    };
  }
  
  /* =========================================================
     VALIDAR PROPIEDAD DEL RECLAMO
  ========================================================= */
  
  function reclamoPerteneceAEjecutivo(
    reclamo: Record<
      string,
      any
    >,
    emailUsuario: string
  ) {
    const email =
      normalizar(
        emailUsuario
      );
  
    /*
     * RECLAMOS NUEVOS
     *
     * Esta es la validación principal.
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
     * RECLAMOS HISTÓRICOS
     *
     * Algunos registros antiguos
     * solamente tienen:
     *
     * Ejecutivo de ventas = jorge.beltran
     *
     * y no tienen Correo Ejecutivo.
     */
    const ejecutivo =
      normalizarNombre(
        reclamo[
          "Ejecutivo de ventas"
        ]
      );
  
    const usuarioCorreo =
      normalizarNombre(
        email.split("@")[0]
      );
  
    return Boolean(
      ejecutivo &&
      usuarioCorreo &&
      ejecutivo ===
        usuarioCorreo
    );
  }
  
  /* =========================================================
     GET
     Obtiene:
     - reclamo
     - investigación
     - acciones
     - seguimientos
     - cierre
     - historial
  
     CALIDAD:
     Puede consultar cualquier reclamo.
  
     EJECUTIVO:
     Solamente puede consultar sus propios reclamos.
  ========================================================= */
  
  export async function GET(
    req: NextRequest
  ) {
    try {
      /* ===============================================
         USUARIO
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
         ID / N° RECLAMO
      =============================================== */
  
      const id =
        req.nextUrl.searchParams.get(
          "id"
        );
  
      if (!id) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Falta el ID o N° de reclamo.",
          },
          {
            status: 400,
          }
        );
      }
  
      /* ===============================================
         APPS SCRIPT
      =============================================== */
  
      const WEBAPP_URL =
        getWebAppUrl();
  
      const url =
        `${WEBAPP_URL}?action=getGestion&id=${encodeURIComponent(
          id
        )}`;
  
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
          "Respuesta no JSON de Apps Script:",
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
              "No se pudo cargar la gestión del reclamo.",
          },
          {
            status: 502,
          }
        );
      }
  
      /* ===============================================
         RECLAMO
      =============================================== */
  
      const reclamo =
        data.reclamo || {};
  
      /* ===============================================
         CONTROL DE ACCESO
      =============================================== */
  
      if (
        !usuario.esCalidad &&
        !reclamoPerteneceAEjecutivo(
          reclamo,
          usuario.email
        )
      ) {
        return NextResponse.json(
          {
            success: false,
  
            error:
              "No tienes autorización para visualizar este reclamo.",
          },
          {
            status: 403,
          }
        );
      }
  
      /* ===============================================
         RESPUESTA
      =============================================== */
  
      return NextResponse.json(
        {
          ...data,
  
          /*
           * Información útil para la UI.
           */
          rol:
            usuario.esCalidad
              ? "calidad"
              : "ejecutivo",
  
          puedeGestionar:
            usuario.esCalidad,
  
          usuarioActual:
            usuario.email,
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
        {
          status: 500,
        }
      );
    }
  }
  
  /* =========================================================
     POST
  
     Investigación
     Acciones
     Seguimiento
     Verificación
     Cierre
  
     SOLO CONTROL DE CALIDAD PUEDE MODIFICAR.
  ========================================================= */
  
  export async function POST(
    req: Request
  ) {
    try {
      /* ===============================================
         USUARIO
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
         SOLO CALIDAD
      =============================================== */
  
      if (!usuario.esCalidad) {
        return NextResponse.json(
          {
            success: false,
  
            error:
              "Solo Control de Calidad puede gestionar este reclamo.",
          },
          {
            status: 403,
          }
        );
      }
  
      /* ===============================================
         BODY
      =============================================== */
  
      const body =
        await req.json();
  
      if (
        !body.reclamoId &&
        !body.numeroReclamo
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Falta identificar el reclamo.",
          },
          {
            status: 400,
          }
        );
      }
  
      if (!body.etapa) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Falta la etapa de gestión.",
          },
          {
            status: 400,
          }
        );
      }
  
      /* ===============================================
         APPS SCRIPT
      =============================================== */
  
      const WEBAPP_URL =
        getWebAppUrl();
  
      /*
       * MUY IMPORTANTE:
       *
       * No confiamos en:
       *
       * body.usuario
       *
       * porque viene desde el navegador.
       *
       * Utilizamos siempre el usuario
       * autenticado en Supabase.
       */
      const payload = {
        ...body,
  
        action:
          "guardarGestion",
  
        usuario:
          usuario.email,
      };
  
      const response =
        await fetch(
          WEBAPP_URL,
          {
            method: "POST",
  
            headers: {
              "Content-Type":
                "application/json",
            },
  
            body:
              JSON.stringify(
                payload
              ),
  
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
          "Respuesta no JSON de Apps Script:",
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
              "No se pudo guardar la gestión.",
          },
          {
            status: 502,
          }
        );
      }
  
      /* ===============================================
         RESPUESTA
      =============================================== */
  
      return NextResponse.json(
        {
          ...data,
  
          success: true,
  
          rol:
            "calidad",
  
          puedeGestionar:
            true,
  
          usuarioActual:
            usuario.email,
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
        {
          status: 500,
        }
      );
    }
  }