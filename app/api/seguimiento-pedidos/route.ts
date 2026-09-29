import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 1000;

export async function GET(req: Request) {
  try {
    const supabase = createRouteHandlerClient({
      cookies,
    });

    // ============================================================
    // 1. USUARIO AUTENTICADO
    // ============================================================

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          ok: false,
          error: "Usuario no autenticado",
        },
        { status: 401 }
      );
    }

    const emailUsuario = String(user.email || "")
      .toLowerCase()
      .trim();

    if (!emailUsuario) {
      return NextResponse.json(
        {
          ok: false,
          error: "El usuario autenticado no tiene correo",
        },
        { status: 400 }
      );
    }

    // ============================================================
    // 2. IDENTIFICAR EJECUTIVO
    // ============================================================

    const {
      data: ejecutivo,
      error: ejecutivoError,
    } = await supabase
      .from("ejecutivos")
      .select(`
        id,
        nombre,
        email,
        zona,
        gerencia
      `)
      .ilike("email", emailUsuario)
      .maybeSingle();

    if (ejecutivoError) {
      console.error(
        "Error buscando ejecutivo:",
        ejecutivoError
      );

      return NextResponse.json(
        {
          ok: false,
          error: "No se pudo identificar al ejecutivo",
          detalle: ejecutivoError.message,
        },
        { status: 500 }
      );
    }

    if (!ejecutivo) {
      return NextResponse.json(
        {
          ok: false,
          error:
            `El usuario ${emailUsuario} no está registrado en ejecutivos.`,
        },
        { status: 404 }
      );
    }

    const nombreEjecutivo =
      String(ejecutivo.nombre || "").trim();

    if (!nombreEjecutivo) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "El ejecutivo no tiene nombre configurado.",
        },
        { status: 400 }
      );
    }

    // ============================================================
    // 3. FILTROS
    // ============================================================

    const { searchParams } = new URL(req.url);

    const pedido =
      String(searchParams.get("pedido") || "").trim();

    const oc =
      String(searchParams.get("oc") || "").trim();

    const cliente =
      String(searchParams.get("cliente") || "").trim();

    const estado =
      String(searchParams.get("estado") || "").trim();

    const columnas = `
      pedido_docentry,
      linea_num,
      clave_seguimiento,

      empleado_ventas,
      numero_pedido,
      correo,
      fecha,

      estado_sac,
      estado_cobranza,
      estado_bodega,
      estado_detalle,

      folio_gdd,
      folio_fe,
      nro_ot,
      transporte,
      indicador,

      cardcode,
      cardname,
      direccion_despacho,
      oc,

      codigo_articulo,
      descripcion,

      cantidad_pedido,
      kilos_pedido,

      cantidad_entregada,
      cantidad_pendiente_entrega,

      cantidad_facturada,
      cantidad_pendiente_facturar,

      ultima_sincronizacion,
      activo
    `;

    // ============================================================
    // 4. LEER TODAS LAS FILAS POR BLOQUES DE 1000
    // ============================================================

    const todasLasFilas: any[] = [];

    let desde = 0;

    while (true) {
      let query = supabase
        .from("seguimiento_pedidos")
        .select(columnas)
        .eq("activo", true)
        .eq(
          "empleado_ventas",
          nombreEjecutivo
        )
        .order("fecha", {
          ascending: false,
        })
        .order("numero_pedido", {
          ascending: false,
        })
        .order("linea_num", {
          ascending: true,
        });

      // ----------------------------------------------------------
      // Filtros opcionales
      // ----------------------------------------------------------

      if (pedido) {
        const numeroPedido =
          Number(pedido);

        if (Number.isFinite(numeroPedido)) {
          query = query.eq(
            "numero_pedido",
            numeroPedido
          );
        }
      }

      if (oc) {
        query = query.ilike(
          "oc",
          `%${oc}%`
        );
      }

      if (cliente) {
        query = query.ilike(
          "cardname",
          `%${cliente}%`
        );
      }

      if (estado) {
        query = query.eq(
          "estado_detalle",
          estado
        );
      }

      const hasta =
        desde + PAGE_SIZE - 1;

      const {
        data,
        error,
      } = await query.range(
        desde,
        hasta
      );

      if (error) {
        console.error(
          "Error Supabase seguimiento:",
          error
        );

        return NextResponse.json(
          {
            ok: false,
            error:
              "No se pudo obtener el seguimiento de pedidos",
            detalle: error.message,
          },
          { status: 500 }
        );
      }

      const bloque =
        data || [];

      todasLasFilas.push(
        ...bloque
      );

      // Si llegaron menos de 1000,
      // ya no existe otra página.
      if (bloque.length < PAGE_SIZE) {
        break;
      }

      desde += PAGE_SIZE;
    }

    // ============================================================
    // 5. RESPUESTA
    // ============================================================

    return NextResponse.json(
      {
        ok: true,

        usuario: {
          email: emailUsuario,
          nombre: nombreEjecutivo,
          zona: ejecutivo.zona || "",
          gerencia: ejecutivo.gerencia || "",
        },

        totalLineas:
          todasLasFilas.length,

        data:
          todasLasFilas,
      },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error: any) {
    console.error(
      "Error /api/seguimiento-pedidos:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          "Error interno obteniendo seguimiento",
      },
      {
        status: 500,
      }
    );
  }
}