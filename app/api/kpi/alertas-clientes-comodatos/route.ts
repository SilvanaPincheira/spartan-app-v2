export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function GET() {
  try {
    // 1️⃣ Usuario logueado
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const email = user.email?.toLowerCase() ?? "";

    // 2️⃣ Consumir APIs base
    const ventasRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/ventas`, { cache: "no-store" });
    const comodatosRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/comodatos`, { cache: "no-store" });

    if (!ventasRes.ok || !comodatosRes.ok) {
      return NextResponse.json({ error: "Error al cargar datos base" }, { status: 500 });
    }

    const ventas = (await ventasRes.json()).data || [];
    const comodatos = (await comodatosRes.json()).data || [];

    // 3️⃣ Fecha de corte = últimos 6 meses desde septiembre 2025
    const cutoff = new Date("2025-09-01");
    cutoff.setMonth(cutoff.getMonth() - 6);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    // 4️⃣ Última venta PT por RUT
    const ventasMap = new Map<string, string>();
    for (const v of ventas) {
      if (!v.rut || !v.fecha) continue;
      if (!ventasMap.has(v.rut) || v.fecha > ventasMap.get(v.rut)!) {
        ventasMap.set(v.rut, v.fecha);
      }
    }

    // 5️⃣ Construir dataset KPI
    const resultado: any[] = [];
    for (const c of comodatos) {
      if (!c.rut) continue;
      const ultima = ventasMap.get(c.rut) || null;
      const sinVentas = !ultima || ultima < cutoffStr;

      if (sinVentas) {
        resultado.push({
          rut: c.rut,
          cliente: c.cliente,
          ejecutivo: c.ejecutivo,
          email: c.email,
          comodato: c.total,
          ultimaCompra: ultima || "—",
        });
      }
    }

    // 6️⃣ Filtrar por usuario logueado (excepto admins)
    const admins = ["silvana.pincheira@spartan.cl", "jorge.beltran@spartan.cl"];
    let filtrado = resultado;
    if (!admins.includes(email)) {
      filtrado = resultado.filter((r) => (r.email || "").toLowerCase() === email);
    }

    return NextResponse.json({ data: filtrado });
  } catch (err) {
    console.error("🔥 Error en KPI alertas-clientes-comodatos:", err);
    return NextResponse.json({ error: "Error en servidor" }, { status: 500 });
  }
}
