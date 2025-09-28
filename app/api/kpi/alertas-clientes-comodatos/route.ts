export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

/* 🔹 Parser de fechas */
function parseFecha(v: string): string {
  if (!v) return "";
  const s = v.trim();

  // mm/dd/yy o mm/dd/yyyy
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const mm = m[1].padStart(2, "0");
    const dd = m[2].padStart(2, "0");
    const yyyy = m[3].length === 2 ? "20" + m[3] : m[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);

  return "";
}

export async function GET() {
  try {
    // 1️⃣ Usuario logueado
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const me = (user.email || "").trim().toLowerCase();

    // 2️⃣ Base URL dinámica (Vercel o Localhost)
    const baseUrl =
      process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";

    // 3️⃣ Consumir APIs base
    const ventasRes = await fetch(`${baseUrl}/api/ventas`, { cache: "no-store" });
    const comodatosRes = await fetch(`${baseUrl}/api/comodatos`, { cache: "no-store" });

    if (!ventasRes.ok || !comodatosRes.ok) {
      return NextResponse.json({ error: "Error al cargar datos base" }, { status: 500 });
    }

    const ventasRaw = (await ventasRes.json()).data || [];
    const comodatosRaw = (await comodatosRes.json()).data || [];

    // 4️⃣ Normalizar datos
    const ventas = ventasRaw.map((v: any) => ({
      rut: v.rut_cliente,
      fecha: parseFecha(v.docdate),
      itemcode: v.itemcode,
    }));

    const comodatos = comodatosRaw.map((c: any) => ({
      rut: c.rut_cliente,
      cliente: c.nombre_cliente,
      ejecutivo: c.empleado_ventas,
      email: c.email_col,
      total: Number(c.total || 0),
      fecha: parseFecha(c.fecha_contab),
    }));

    // 5️⃣ Fecha de corte (6M atrás desde septiembre 2025)
    const cutoff = new Date("2025-09-01");
    cutoff.setMonth(cutoff.getMonth() - 6);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    // 6️⃣ Última venta PT por RUT
    const ventasMap = new Map<string, string>();
    for (const v of ventas) {
      if (!v.rut || !v.fecha) continue;
      if (!v.itemcode?.toUpperCase().startsWith("PT")) continue;
      if (!ventasMap.has(v.rut) || v.fecha > ventasMap.get(v.rut)!) {
        ventasMap.set(v.rut, v.fecha);
      }
    }

    // 7️⃣ Consolidar
    const resultado: any[] = [];
    for (const c of comodatos) {
      if (!c.rut) continue;
      if (c.fecha && c.fecha < "2023-01-01") continue;

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

    // 8️⃣ Filtro admins
    const admins = ["silvana.pincheira@spartan.cl", "jorge.beltran@spartan.cl"];
    let filtrado = resultado;

    if (!admins.includes(me)) {
      filtrado = resultado.filter(
        (r) => (r.email || "").trim().toLowerCase() === me
      );
    }

    return NextResponse.json({ data: filtrado });
  } catch (err) {
    console.error("🔥 Error en KPI alertas-clientes-comodatos:", err);
    return NextResponse.json({ error: "Error en servidor" }, { status: 500 });
  }
}
