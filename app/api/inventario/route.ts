import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
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
          actualizado_en
        `)
        .order("codigo", { ascending: true })
        .range(desde, desde + TAMANO_BLOQUE - 1);

      if (error) {
        console.error("Error Supabase inventario:", error);

        return NextResponse.json(
          {
            ok: false,
            error: error.message,
          },
          { status: 500 }
        );
      }

      const bloque = data ?? [];

      inventarioCompleto = [
        ...inventarioCompleto,
        ...bloque,
      ];

      if (bloque.length < TAMANO_BLOQUE) {
        break;
      }

      desde += TAMANO_BLOQUE;
    }

    return NextResponse.json({
      ok: true,
      total: inventarioCompleto.length,
      inventario: inventarioCompleto,
    });
  } catch (error) {
    console.error("Error API inventario:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Error interno obteniendo inventario",
      },
      { status: 500 }
    );
  }
}