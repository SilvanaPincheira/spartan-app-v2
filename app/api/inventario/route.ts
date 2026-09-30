import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
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
      .order("codigo", { ascending: true });

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

    return NextResponse.json({
      ok: true,
      total: data?.length ?? 0,
      inventario: data ?? [],
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