// app/api/cobranzas/morosidad/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // Autenticación de la sesión del usuario en SpartanOne.
    const auth = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await auth.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ ok: false, error: "Sesión no autorizada" }, { status: 401 });
    }

    const codigoCliente = (req.nextUrl.searchParams.get("codigoCliente") ?? "").trim();
    if (!codigoCliente || codigoCliente.length > 50) {
      return NextResponse.json({ ok: false, error: "Código de cliente inválido" }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Falta configurar Supabase en el servidor");

    // El service role se usa exclusivamente en el servidor, nunca en el navegador.
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

    // Solo una sincronización exitosa y reciente permite declarar un cliente LIBRE.
    const { data: sync, error: syncError } = await db
      .from("sincronizaciones")
      .select("ultima_ejecucion_exitosa, estado")
      .eq("proceso", "facturas_vencidas")
      .maybeSingle();
    if (syncError) throw syncError;
    const fecha = sync?.ultima_ejecucion_exitosa ? Date.parse(sync.ultima_ejecucion_exitosa) : NaN;
    if (sync?.estado !== "OK" || !Number.isFinite(fecha) || Date.now() - fecha > 15 * 60_000 || fecha > Date.now() + 60_000) {
      return NextResponse.json({ ok: false, error: "La sincronización de facturas vencidas no está actualizada" }, { status: 503 });
    }

    const { data: cuotas, error } = await db
      .from("facturas_vencidas_sap")
      .select("dias_vencidos, saldo_vencido, moneda")
      .eq("codigo_cliente", codigoCliente)
      .eq("vigente", true);
    if (error) throw error;

    const saldosPorMoneda: Record<string, number> = {};
    let diasMaximoAtraso = 0;
    for (const cuota of cuotas ?? []) {
      const moneda = String(cuota.moneda || "SIN_MONEDA");
      saldosPorMoneda[moneda] = (saldosPorMoneda[moneda] || 0) + Number(cuota.saldo_vencido || 0);
      diasMaximoAtraso = Math.max(diasMaximoAtraso, Number(cuota.dias_vencidos || 0));
    }

    return NextResponse.json({
      ok: true,
      codigoCliente,
      moroso: (cuotas?.length || 0) > 0,
      facturasVencidas: cuotas?.length || 0, // Número de cuotas, no facturas distintas.
      diasMaximoAtraso,
      saldosPorMoneda,
      ultimaActualizacion: sync.ultima_ejecucion_exitosa,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("Error consultando morosidad:", err);
    return NextResponse.json({ ok: false, error: "No se pudo verificar la morosidad" }, { status: 503 });
  }
}
