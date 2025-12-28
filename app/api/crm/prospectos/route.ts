import { NextResponse } from "next/server";

const APPS_SCRIPT_URL = process.env.CRM_APPS_SCRIPT_URL;

function pick(obj: any, ...keys: string[]) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

export async function POST(req: Request) {
  try {
    if (!APPS_SCRIPT_URL) {
      return NextResponse.json(
        { ok: false, error: "Falta env CRM_APPS_SCRIPT_URL en Vercel/.env" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const lead = body?.lead || {};

    const folio = pick(body, "folio") || pick(lead, "folio");
    const asignado_a = pick(body, "asignado_a").toLowerCase();
    const asignado_por = pick(body, "asignado_por").toLowerCase();

    if (!folio)
      return NextResponse.json({ ok: false, error: "Folio requerido" }, { status: 400 });
    if (!asignado_a)
      return NextResponse.json({ ok: false, error: "asignado_a requerido" }, { status: 400 });
    if (!asignado_por)
      return NextResponse.json({ ok: false, error: "asignado_por requerido" }, { status: 400 });

    const nowIso = new Date().toISOString();

    // 1) CREATE (si existe -> duplicated true)
    // Nota: puedes dejar PENDIENTE_ASIGNACION; yo lo dejo ASIGNADO para consistencia
    const createPayload = {
      action: "CREATE",
      created_at: pick(lead, "created_at") || nowIso,
      folio,

      fuente: pick(lead, "fuente") || "BD",
      source_id: pick(lead, "source_id") || pick(lead, "lead_key") || "",

      nombre_razon_social: pick(lead, "nombre_razon_social"),
      rut: pick(lead, "rut"),
      telefono: pick(lead, "telefono"),
      correo: pick(lead, "correo"),
      direccion: pick(lead, "direccion"),
      rubro: pick(lead, "rubro"),
      monto_proyectado: pick(lead, "monto_proyectado"),

      division: pick(lead, "division"),

      etapa_id: pick(lead, "etapa_id"),
      etapa_nombre: pick(lead, "etapa_nombre"),

      fecha_cierre_id: pick(lead, "fecha_cierre_id"),
      fecha_cierre_nombre: pick(lead, "fecha_cierre_nombre"),

      prob_cierre_id: pick(lead, "prob_cierre_id"),
      prob_cierre_nombre: pick(lead, "prob_cierre_nombre"),

      origen_prospecto: pick(lead, "origen_prospecto"),
      observacion: pick(lead, "observacion"),

      ejecutivo_email: pick(lead, "ejecutivo_email"),

      // 👇 consistente con asignación
      estado: "ASIGNADO",
      asignado_a,
      asignado_por,
      asignado_at: nowIso,
    };

    const respCreate = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(createPayload),
    });

    const textCreate = await respCreate.text();
    let dataCreate: any;
    try {
      dataCreate = JSON.parse(textCreate);
    } catch {
      dataCreate = { ok: false, error: "Respuesta no JSON (CREATE)", raw: textCreate.slice(0, 500) };
    }

    if (!respCreate.ok || dataCreate?.ok === false) {
      return NextResponse.json(
        {
          ok: false,
          step: "CREATE",
          error: dataCreate?.error || `Sheets error (CREATE ${respCreate.status})`,
          raw: dataCreate?.raw,
          debug: dataCreate?.debug_idx || dataCreate?.debug_cols || null,
        },
        { status: 500 }
      );
    }

    // 2) ASIGNAR (debe forzar update en la fila existente por folio)
    const respAssign = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        action: "ASIGNAR",
        folio,
        asignado_a,
        asignado_por,
      }),
    });

    const textAssign = await respAssign.text();
    let dataAssign: any;
    try {
      dataAssign = JSON.parse(textAssign);
    } catch {
      dataAssign = { ok: false, error: "Respuesta no JSON (ASIGNAR)", raw: textAssign.slice(0, 500) };
    }

    if (!respAssign.ok || !dataAssign?.ok) {
      return NextResponse.json(
        {
          ok: false,
          step: "ASIGNAR",
          error: dataAssign?.error || `Sheets error (ASIGNAR ${respAssign.status})`,
          raw: dataAssign?.raw,
          debug: dataAssign?.debug_idx || dataAssign?.debug_cols || null,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, duplicated: !!dataCreate?.duplicated });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
