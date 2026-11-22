
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const APPS_SCRIPT_URL =
  process.env.NV_APPS_SCRIPT_URL ||
  "https://script.google.com/macros/s/AKfycbzx33T5foTEYYXV-r8Rkib9z2Rm9DcJTakZft7Z_UmYX2ItBK8uLJwEgjarfU6HF13ALQ/exec";

const MAX_ANTIGUEDAD_MINUTOS = 15;

export async function POST(req: Request) {
  try {
    const payload = await req.json();

    if (!Array.isArray(payload) || payload.length === 0) {
      return NextResponse.json(
        { error: "No se recibieron registros para guardar" },
        { status: 400 }
      );
    }

    const numeroNV = String(payload[0]?.numeroNV || "").trim();
    const codigoCliente = String(
      payload[0]?.codigoCliente || ""
    ).trim();

    if (!numeroNV || !codigoCliente) {
      return NextResponse.json(
        { error: "Falta número de NV o código de cliente." },
        { status: 400 }
      );
    }

    // Todas las filas deben corresponder a la misma NV y cliente.
    const filasInvalidas = payload.some(
      (fila: any) =>
        String(fila?.numeroNV || "").trim() !== numeroNV ||
        String(fila?.codigoCliente || "").trim() !== codigoCliente
    );

    if (filasInvalidas) {
      return NextResponse.json(
        { error: "Las filas contienen distintas NV o clientes." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: "Falta configuración de Supabase en el servidor." },
        { status: 503 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // IMPORTANTE:
    // Esta tabla debe contener una fila por sincronización exitosa,
    // incluso cuando SAP no devuelve facturas vencidas.
    const { data: control, error: errorControl } = await supabase
      .from("control_sincronizaciones")
      .select("ultima_ejecucion_exitosa")
      .eq("proceso", "facturas_vencidas")
      .single();

    if (errorControl || !control?.ultima_ejecucion_exitosa) {
      return NextResponse.json(
        {
          error:
            "No se pudo verificar la última sincronización de cobranza.",
        },
        { status: 503 }
      );
    }

    const antiguedadMinutos =
      (Date.now() -
        new Date(control.ultima_ejecucion_exitosa).getTime()) /
      60000;

    if (
      !Number.isFinite(antiguedadMinutos) ||
      antiguedadMinutos < 0 ||
      antiguedadMinutos > MAX_ANTIGUEDAD_MINUTOS
    ) {
      return NextResponse.json(
        {
          error:
            "La información de cobranza no está actualizada. " +
            "No se puede autorizar automáticamente la integración.",
        },
        { status: 503 }
      );
    }

    const { data: facturas, error: errorFacturas } = await supabase
      .from("facturas_vencidas_sap")
      .select(
        "doc_entry_factura,dias_vencidos,saldo_vencido,moneda"
      )
      .eq("codigo_cliente", codigoCliente)
      .eq("vigente", true);

    if (errorFacturas) {
      return NextResponse.json(
        { error: "No se pudo consultar la morosidad del cliente." },
        { status: 503 }
      );
    }

    const moroso = (facturas || []).length > 0;

    // Nunca aceptar estos valores enviados por el navegador.
    const filasConControl = payload.map((fila: any) => ({
      ...fila,
      IntegrarSAP: moroso ? "NO" : "SI",
      EstadoCobranza: moroso ? "RETENIDA" : "LIBRE",
    }));

    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(filasConControl),
      cache: "no-store",
    });

    const text = await res.text();

    let json: any;

    try {
      json = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "Respuesta de Apps Script no es JSON." },
        { status: 502 }
      );
    }

    if (!res.ok || json?.status !== "ok") {
      return NextResponse.json(
        {
          error: "No se confirmó el guardado de la NV.",
          detalle: json,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ...json,
      integrarSAP: moroso ? "NO" : "SI",
      estadoCobranza: moroso ? "RETENIDA" : "LIBRE",
      moroso,
      facturasVencidas: new Set(
        (facturas || []).map((f) => f.doc_entry_factura)
      ).size,
      diasMaximoAtraso: Math.max(
        0,
        ...(facturas || []).map((f) => f.dias_vencidos || 0)
      ),
    });
  } catch (err) {
    console.error("Error en save-to-sheets:", err);

    return NextResponse.json(
      { error: "Error interno al guardar la Nota de Venta." },
      { status: 500 }
    );
  }
}
