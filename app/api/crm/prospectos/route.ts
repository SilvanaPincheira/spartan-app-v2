import { NextResponse } from "next/server";

const APPS_SCRIPT_URL = process.env.CRM_APPS_SCRIPT_URL;

function pick(obj: any, ...keys: string[]) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function lowerEmail(s: string) {
  return (s || "").trim().toLowerCase();
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

    // ✅ Soporta ambos formatos:
    // - payload plano (recomendado)
    // - { lead: payload }
    const lead = body?.lead && typeof body.lead === "object" ? body.lead : body;

    const folio = pick(lead, "folio");
    if (!folio)
      return NextResponse.json({ ok: false, error: "Folio requerido" }, { status: 400 });

    const nowIso = new Date().toISOString();

    // ✅ fuente correcta (evita que quede "BD")
    // page manda "MANUAL" o "CSV_PIA"
    const fuente = pick(lead, "fuente") || "MANUAL";

    // ✅ estado: respeta lo que mande el front
    // (ej: PENDIENTE_ASIGNACION / ASIGNADO / etc.)
    const estado = pick(lead, "estado") || "ASIGNADO";

    // ✅ asignación:
    // - si es PENDIENTE_ASIGNACION, permitimos vacío
    // - si NO, exigimos asignado_a y asignado_por
    const asignado_a = lowerEmail(pick(lead, "asignado_a"));
    const asignado_por = lowerEmail(pick(lead, "asignado_por"));

    const requiereAsignacion = estado !== "PENDIENTE_ASIGNACION";

    if (requiereAsignacion && !asignado_a)
      return NextResponse.json({ ok: false, error: "asignado_a requerido" }, { status: 400 });
    if (requiereAsignacion && !asignado_por)
      return NextResponse.json({ ok: false, error: "asignado_por requerido" }, { status: 400 });

    // ✅ CREATE (si existe -> duplicated true)
    const createPayload = {
      action: "CREATE",
      created_at: pick(lead, "created_at") || nowIso,
      folio,

      fuente,
      source_id: pick(lead, "source_id") || pick(lead, "lead_key") || "",

      // ✅ datos del prospecto (ahora sí vienen del payload plano)
      nombre_razon_social: pick(lead, "nombre_razon_social"),
      rut: pick(lead, "rut"),
      contacto: pick(lead, "contacto"),
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

      ejecutivo_email: lowerEmail(pick(lead, "ejecutivo_email")),

      // ✅ NO forzar ASIGNADO
      estado,

      // ✅ asignación (solo si corresponde)
      asignado_a: requiereAsignacion ? asignado_a : "",
      asignado_por: requiereAsignacion ? asignado_por : "",
      // ✅ OJO: si tu hoja no tiene header "asignado_at", esto puede romper en Apps Script.
      // Si tu sheet NO tiene la columna, deja esto como "" o elimina el campo.
      asignado_at: requiereAsignacion ? (pick(lead, "asignado_at") || nowIso) : "",
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

    // ✅ Eliminamos el paso ASIGNAR: ya estás mandando asignado_a/asignado_por en CREATE
    // y este paso fue el que te arrojó el error de headers (asignado_at).
    return NextResponse.json({ ok: true, duplicated: !!dataCreate?.duplicated });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
