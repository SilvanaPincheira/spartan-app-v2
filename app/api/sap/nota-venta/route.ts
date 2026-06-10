import { NextResponse } from "next/server";
import { guardarYEnviarNotaVenta } from "@/lib/notaventa";

function validarApiKey(req: Request) {
  const apiKey = req.headers.get("x-api-key")?.trim();
  const expected = process.env.SPARTANONE_API_KEY?.trim();

  return apiKey === expected;
}

export async function POST(req: Request) {
  try {
    if (!validarApiKey(req)) {
      return NextResponse.json(
        { ok: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const body = await req.json();

    if (!body.numeroNV) {
      return NextResponse.json(
        { ok: false, error: "Falta numeroNV" },
        { status: 400 }
      );
    }

    if (!body.cliente?.codigo) {
      return NextResponse.json(
        { ok: false, error: "Falta cliente.codigo" },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.productos) || body.productos.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Faltan productos" },
        { status: 400 }
      );
    }

    const result = await guardarYEnviarNotaVenta(body);

    return NextResponse.json({
      ok: result.ok,
      endpoint: "nota-venta",
      source: "spartanone",
      message: result.message,
    });
  } catch (err: any) {
    console.error("❌ Error /api/sap/nota-venta:", err);

    return NextResponse.json(
      {
        ok: false,
        error: "No se pudo crear Nota de Venta",
        details: err?.message || "Error inesperado",
      },
      { status: 500 }
    );
  }
}