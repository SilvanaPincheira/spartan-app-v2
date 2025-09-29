// app/api/metas/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Papa from "papaparse";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

/* =========================
   Helpers
   ========================= */
function normalize(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita tildes
    .replace(/[^a-z0-9%$]+/g, "_")   // deja letras/números/%/$ como separadores _
    .replace(/^_+|_+$/g, "");
}

// CLP: "$30.000" -> 30000
function toCLP(val: any): number {
  if (val == null) return 0;
  const s = String(val);
  const n = s.replace(/[^\d-]/g, ""); // quita todo salvo dígitos y -
  return n ? Number(n) : 0;
}

// porcentaje: "85%" -> 85
function toPct(val: any): number {
  if (val == null) return 0;
  const s = String(val);
  const m = s.match(/-?\d+([.,]\d+)?/);
  return m ? Number(m[0].replace(",", ".")) : 0;
}

/* =========================
   GET
   ========================= */
export async function GET() {
  try {
    // 1) Usuario autenticado
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const email = user.email.toLowerCase();

    // 2) CSV de Google Sheets
    //    (Hoja "meta"; si tu hoja cambia, ajusta el parámetro `sheet=...`)
    const url =
      "https://docs.google.com/spreadsheets/d/1GASOV0vl85q5STfvDn5hdZFD0Mwcj2SzXM6IqvgI50A/gviz/tq?tqx=out:csv&sheet=meta";

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.error("❌ Error al leer hoja:", t);
      return NextResponse.json(
        { error: "No se pudo leer la hoja" },
        { status: 500 }
      );
    }

    const text = await res.text();
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });

    const originals = parsed.meta.fields || [];
    if (!originals.length) {
      return NextResponse.json({ data: [] });
    }

    // 3) Detectar columnas importantes por nombre original
    //    - email col
    //    - meta del mes (ej: "META SEPTIEMBRE 2025")
    //    - cumplimiento $ / %
    //    - total químicos / no son equipo / pedido / entrega, etc.
    const findHeader = (fn: (h: string) => boolean) =>
      originals.find(fn) || "";

    const emailHeader =
      findHeader((h) => normalize(h) === "email_col") ||
      findHeader((h) => normalize(h) === "email") ||
      "";

    // Tomamos la PRIMERA cabecera que empiece por "meta" (suele ser "META <MES> <AÑO>")
    // Si en tu hoja hay varias "META ...", podrías tomar la última.
    const metaHeader =
      findHeader((h) => /^meta\b/i.test(h)) ||
      findHeader((h) => /meta/i.test(h)) ||
      "";

    const cumplimientoMontoHeader = findHeader(
      (h) => /cumplimiento/i.test(h) && /\$/i.test(h)
    );
    const cumplimientoPctHeader = findHeader(
      (h) => /cumplimiento/i.test(h) && /%/.test(h)
    );

    const totalQuimicosHeader = findHeader((h) =>
      /total.*quimic/i.test(h)
    );
    const noEquipoHeader = findHeader((h) =>
      /no.*equipo.*venta/i.test(h)
    );
    const pedidoHeader = findHeader((h) => /^pedido$/i.test(normalize(h)));
    const entregaHeader = findHeader((h) => /^entrega$/i.test(normalize(h)));

    const zonaHeader = findHeader((h) => /zona.*chile/i.test(h));
    const gerenciaHeader = findHeader((h) => /gerencia/i.test(h));
    const supervisorHeader = findHeader((h) => /supervisor/i.test(h));
    const vendedorHeader = findHeader((h) => /vendedor/i.test(h));

    // 4) Armar dataset normalizado con nombres consistentes
    const rows = (parsed.data as any[]).map((row) => {
      const obj: any = {};

      obj.email = String(row[emailHeader] || "").toLowerCase();

      // Campos de texto directos
      obj.zona_chile = row[zonaHeader] ?? "";
      obj.gerencia = row[gerenciaHeader] ?? "";
      obj.supervisor = row[supervisorHeader] ?? "";
      obj.vendedor = row[vendedorHeader] ?? "";

      // Campos numéricos & CLP
      obj.pedido = toCLP(row[pedidoHeader]);
      obj.entrega = toCLP(row[entregaHeader]);
      obj.total_quimicos = toCLP(row[totalQuimicosHeader]);
      obj.no_son_equipo_venta = toCLP(row[noEquipoHeader]);

      // Meta del mes -> la exponemos como `meta_mes`
      obj.meta_mes = toCLP(row[metaHeader]);
      // además exponemos cuál es la cabecera original por si quieres mostrarla
      obj.meta_label = metaHeader;
      // y exponemos el nombre de la propiedad que deben usar los consumidores (compatibilidad)
      obj.meta_columna = "meta_mes";

      // Cumplimientos
      obj.cumplimiento_monto = toCLP(row[cumplimientoMontoHeader]);
      obj.cumplimiento_pct = toPct(row[cumplimientoPctHeader]);

      return obj;
    });

    // 5) Filtrar por usuario logueado (EMAIL_COL)
    const filtered = rows.filter((r) => r.email === email);

    // 6) Respuesta: sólo lo necesario (y consistente con tu tabla)
    const cleaned = filtered.map((r) => ({
      zona_chile: r.zona_chile,
      gerencia: r.gerencia,
      supervisor: r.supervisor,
      vendedor: r.vendedor,
      pedido: r.pedido,
      entrega: r.entrega,
      total_quimicos: r.total_quimicos,
      no_son_equipo_venta: r.no_son_equipo_venta,
      meta_mes: r.meta_mes,
      cumplimiento_monto: r.cumplimiento_monto,
      cumplimiento_pct: r.cumplimiento_pct,
      meta_label: r.meta_label,       // ej: "META SEPTIEMBRE 2025"
      meta_columna: r.meta_columna,   // "meta_mes" (para que el front sepa qué propiedad leer)
    }));

    return NextResponse.json({ data: cleaned });
  } catch (err) {
    console.error("🔥 Error en API Metas:", err);
    return NextResponse.json({ error: "Error en servidor" }, { status: 500 });
  }
}
