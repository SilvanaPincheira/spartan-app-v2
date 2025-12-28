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

function upper(s: string) {
  return (s || "").trim().toUpperCase();
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
    if (!folio) {
      return NextResponse.json({ ok: false, error: "Folio requerido" }, { status: 400 });
    }

    const nowIso = new Date().toISOString();

    // ✅ fuente correcta (evita que quede "BD")
    const fuente = pick(lead, "fuente") || "MANUAL";

    // ✅ emails base
    const ejecutivo_email = lowerEmail(pick(lead, "ejecutivo_email"));
    const asignado_a_in = lowerEmail(pick(lead, "asignado_a"));

    // ✅ Regla CLAVE:
    // si viene ejecutivo_email (BD_PIA) y no viene asignado_a, entonces asignado_a = ejecutivo_email
    const asignado_a_final = asignado_a_in || ejecutivo_email;

    // ✅ estado:
    // - si hay asignado_a_final => ASIGNADO (aunque venga PENDIENTE_ASIGNACION desde PIA)
    // - si NO hay asignado => PENDIENTE_ASIGNACION
    const estado_in = upper(pick(lead, "estado"));
    const estado_final = asignado_a_final
      ? "ASIGNADO"
      : (estado_in || "PENDIENTE_ASIGNACION");

    const requiereAsignacion = estado_final !== "PENDIENTE_ASIGNACION";

    // ✅ asignado_por:
    // - respeta el payload si viene
    // - si no viene y está asignado:
    //   - para imports, usamos ejecutivo_email o asignado_a_final
    const asignado_por_in = lowerEmail(pick(lead, "asignado_por"));
    const asignado_por_final = requiereAsignacion
      ? (asignado_por_in || ejecutivo_email || asignado_a_final)
      : "";

    if (requiereAsignacion && !asignado_a_final) {
      return NextResponse.json({ ok: false, error: "asignado_a requerido" }, { status: 400 });
    }
    if (requiereAsignacion && !asignado_por_final) {
      return NextResponse.json({ ok: false, error: "asignado_por requerido" }, { status: 400 });
    }

    const createPayload = {
      action: "CREATE",
      created_at: pick(lead, "created_at") || nowIso,
      folio,

      fuente,
      source_id: pick(lead, "source_id") || pick(lead, "lead_key") || "",

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

      ejecutivo_email,

      // ✅ estado corregido
      estado: estado_final,

      // ✅ asignación corregida
      asignado_a: requiereAsignacion ? asignado_a_final : "",
      asignado_por: requiereAsignacion ? asignado_por_final : "",
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
          sent: {
            folio,
            fuente,
            ejecutivo_email,
            estado_final,
            asignado_a_final,
            asignado_por_final,
          },
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
