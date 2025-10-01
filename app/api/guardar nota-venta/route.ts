// app/api/guardar-notaventa/route.ts
import { NextResponse } from "next/server";
import { guardarYEnviarNotaVenta } from "@/lib/notaventa";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await guardarYEnviarNotaVenta(body);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: err?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}
