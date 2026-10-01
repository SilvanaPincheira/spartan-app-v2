import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

export async function GET() {
  try {
    const TAMANO_BLOQUE = 1000;

    let desde = 0;
    let inventarioCompleto: any[] = [];

    while (true) {
      const { data, error } = await supabase
        .from("inventario")
        .select(`
          codigo,
          producto,
          bodega_produccion,
          stock,
          venta,
          disponible,
          stock_por_componentes,
          actualizado_en
        `)
        .order("codigo", { ascending: true })
        .range(
          desde,
          desde + TAMANO_BLOQUE - 1
        );

      if (error) {
        console.error(
          "Error Supabase inventario:",
          error
        );

        return NextResponse.json(
          {
            ok: false,
            error: error.message,
          },
          {
            status: 500,
            headers: {
              "Cache-Control":
                "no-store, no-cache, must-revalidate, max-age=0",
            },
          }
        );
      }

      const bloque = data ?? [];

      inventarioCompleto.push(...bloque);

      if (bloque.length < TAMANO_BLOQUE) {
        break;
      }

      desde += TAMANO_BLOQUE;
    }

    // Obtener última fecha directamente
    // desde los registros recibidos.
    const fechas = inventarioCompleto
      .map((item) =>
        item.actualizado_en
          ? new Date(
              item.actualizado_en
            ).getTime()
          : 0
      )
      .filter(
        (fecha) =>
          fecha > 0 &&
          !Number.isNaN(fecha)
      );

    const ultimaActualizacion =
      fechas.length > 0
        ? new Date(
            Math.max(...fechas)
          ).toISOString()
        : null;

    return NextResponse.json(
      {
        ok: true,
        total:
          inventarioCompleto.length,
        ultimaActualizacion,
        inventario:
          inventarioCompleto,
      },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error(
      "Error API inventario:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "Error interno obteniendo inventario",
      },
      {
        status: 500,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, max-age=0",
        },
      }
    );
  }
}