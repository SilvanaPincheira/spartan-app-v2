import { NextResponse } from "next/server";

/* ============================================================================
   ⚙️ CONFIGURACIÓN GOOGLE SHEET
   ============================================================================ */

// URL pública CSV del historial de Notas de Venta
const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR2dwvhSGvvFFPBiRxUgF8Q99HkWJlyoFKLDo6Mmu4HvCH_hJtdyV_7WTrOjkUp6u0pMyAOf543M1UE/pub?gid=0&single=true&output=csv";

/* ============================================================================
   🧩 Parser CSV seguro
   Respeta comas dentro de campos entre comillas
   ============================================================================ */

function parseCsv(text: string): Record<string, string>[] {
  const lines = text
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "");

  if (lines.length === 0) {
    return [];
  }

  const headers = lines[0]
    .split(",")
    .map((h) => h.trim());

  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(
      /,(?=(?:(?:[^"]*"){2})*[^"]*$)/
    );

    const row: Record<string, string> = {};

    headers.forEach((h, j) => {
      row[h] = (cols[j] || "")
        .replace(/^"|"$/g, "")
        .trim();
    });

    rows.push(row);
  }

  return rows;
}

/* ============================================================================
   🔧 Helpers
   ============================================================================ */

function obtenerNumeroNV(
  fila: Record<string, string>
): string {
  return (
    fila["Número NV"] ||
    fila["Numero NV"] ||
    fila["N° NV"] ||
    fila["Nº NV"] ||
    ""
  ).trim();
}

function obtenerCorreo(
  fila: Record<string, string>
): string {
  return (
    fila["EMAIL_COL"] ||
    fila["Correo Ejecutivo"] ||
    ""
  )
    .toLowerCase()
    .trim();
}

/* ============================================================================
   🚀 GET
   - Historial NV
   - Buscar NV específica
   - Obtener siguiente correlativo por ejecutivo
   ============================================================================ */

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const nvParam = (
      searchParams.get("nv") || ""
    ).trim();

    const emailParam = (
      searchParams.get("email") || ""
    )
      .toLowerCase()
      .trim();

    const correlativoParam =
      searchParams.get("correlativo") === "1";

    /* ========================================================================
       📥 Leer hoja pública
       ======================================================================== */

    const res = await fetch(CSV_URL, {
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(
        "No se pudo acceder al Sheet público (revisa permisos)."
      );
    }

    const csv = await res.text();

    const filas = parseCsv(csv);

    /* ========================================================================
       🧩 Propagar Número NV hacia abajo

       Esto se mantiene porque algunas hojas pueden mostrar el número solamente
       en la primera línea de una NV y dejar las siguientes vacías.
       ======================================================================== */

    let ultimoNumero = "";

    for (const f of filas) {
      const num = obtenerNumeroNV(f);

      if (num) {
        ultimoNumero = num;
      } else if (ultimoNumero) {
        f["Número NV"] = ultimoNumero;
      }
    }

    /* ========================================================================
       🔍 Filtrar por ejecutivo logueado
       ======================================================================== */

    let filtradas = filas;

    if (emailParam) {
      filtradas = filtradas.filter((f) => {
        return obtenerCorreo(f) === emailParam;
      });
    }

    /* ========================================================================
       🔢 OBTENER SIGUIENTE CORRELATIVO

       Ejemplo:

       /api/historial-notaventa
         ?email=eduardo.rios@spartan.cl
         &correlativo=1

       Devuelve:
       {
         ok: true,
         ultimoCorrelativo: 358,
         siguienteCorrelativo: 359,
         numeroNV: "NV-2026-00359"
       }

       El correlativo se calcula SOLO sobre las NV del ejecutivo filtrado.
       ======================================================================== */

    if (correlativoParam) {
      if (!emailParam) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Se requiere el email del ejecutivo para obtener el correlativo",
          },
          {
            status: 400,
          }
        );
      }

      const year = new Date().getFullYear();

      let mayorCorrelativo = 0;

      for (const fila of filtradas) {
        const numeroNV = obtenerNumeroNV(fila);

        /*
         * Solo considera formatos:
         *
         * NV-2026-00001
         * NV-2026-00358
         * etc.
         */

        const match = numeroNV.match(
          new RegExp(
            `^NV-${year}-(\\d+)$`,
            "i"
          )
        );

        if (!match) {
          continue;
        }

        const correlativo = Number(match[1]);

        if (
          Number.isFinite(correlativo) &&
          correlativo > mayorCorrelativo
        ) {
          mayorCorrelativo = correlativo;
        }
      }

      const siguienteCorrelativo =
        mayorCorrelativo + 1;

      const numeroNV =
        `NV-${year}-${String(
          siguienteCorrelativo
        ).padStart(5, "0")}`;

      console.log(
        "===== CORRELATIVO NV ====="
      );
      console.log("Email:", emailParam);
      console.log(
        "Último correlativo:",
        mayorCorrelativo
      );
      console.log(
        "Siguiente correlativo:",
        siguienteCorrelativo
      );
      console.log("Número NV:", numeroNV);
      console.log(
        "=========================="
      );

      return NextResponse.json({
        ok: true,
        email: emailParam,
        year,
        ultimoCorrelativo:
          mayorCorrelativo,
        siguienteCorrelativo,
        numeroNV,
      });
    }

    /* ========================================================================
       🔍 Si llega ?nv=..., buscar una NV específica
       ======================================================================== */

    if (nvParam) {
      filtradas = filtradas.filter((f) => {
        const nv = obtenerNumeroNV(f);
        const correo = obtenerCorreo(f);

        return (
          nv === nvParam &&
          (!emailParam ||
            correo === emailParam)
        );
      });
    }

    /* ========================================================================
       🧱 Agrupar por Número NV
       ======================================================================== */

    const agrupadas: Record<string, any> =
      {};

    for (const r of filtradas) {
      const numeroNV = obtenerNumeroNV(r);

      if (!numeroNV) {
        continue;
      }

      if (!agrupadas[numeroNV]) {
        agrupadas[numeroNV] = {
          numeroNV,

          fecha:
            r["Fecha"] || "",

          cliente:
            r["Cliente"] || "",

          rut:
            r["RUT"] || "",

          codigoCliente:
            r["Codigo Cliente"] ||
            r["Código Cliente"] ||
            "",

          ejecutivo:
            r["Ejecutivo"] ||
            r["Empleado Ventas"] ||
            "",

          correoEjecutivo:
            r["EMAIL_COL"] ||
            r["Correo Ejecutivo"] ||
            "",

          direccion:
            r["Direccion"] ||
            r["Dirección"] ||
            r["Direccion Despacho"] ||
            "",

          comentarios:
            r["Comentarios"] || "",

          subtotal: Number(
            r["Subtotal"] || 0
          ),

          total: Number(
            r["Total"] || 0
          ),

          items: [],
        };
      }

      /* ======================================================================
         ⚙️ Agregar ítems válidos
         ====================================================================== */

      const codigo =
        r["Código"] ||
        r["Codigo Producto"] ||
        r["ItemCode"] ||
        "";

      const descripcion =
        r["Descripción"] ||
        r["Producto"] ||
        r["Dscription"] ||
        "";

      if (!codigo && !descripcion) {
        continue;
      }

      agrupadas[numeroNV].items.push({
        numeroNV,

        codigo,

        descripcion,

        cantidad: Number(
          r["Cantidad"] ||
          r["Quantity"] ||
          0
        ),

        kilos: Number(
          r["Kg"] ||
          r["Kilos"] ||
          r["Cantidad Kilos"] ||
          0
        ),

        precioBase: Number(
          r["Precio base"] ||
          r["Precio Base"] ||
          r["Precio Unitario"] ||
          r["Precio Por Linea"] ||
          0
        ),

        descuento: Number(
          r["% Desc"] ||
          r["% Descuento"] ||
          r["Descuento"] ||
          0
        ),

        precioVenta: Number(
          r["Precio venta"] ||
          r["Precio Venta"] ||
          r["Precio Por Linea"] ||
          r["Precio Unitario"] ||
          0
        ),

        totalItem: Number(
          r["Total Item"] ||
          r["Total Línea"] ||
          r["Total Linea"] ||
          r["Total"] ||
          0
        ),
      });
    }

    const data =
      Object.values(agrupadas);

    /* ========================================================================
       🚫 NV solicitada no encontrada
       ======================================================================== */

    if (
      nvParam &&
      data.length === 0
    ) {
      return NextResponse.json({
        ok: false,
        error:
          `No se encontró la Nota de Venta ${nvParam} para ` +
          `${emailParam || "usuario"}`,
      });
    }

    /* ========================================================================
       ✅ Respuesta normal historial
       ======================================================================== */

    return NextResponse.json({
      ok: true,
      totalNotas: data.length,
      data,
    });
  } catch (err: any) {
    console.error(
      "❌ Error en historial-notaventa:",
      err
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : String(err),
      },
      {
        status: 500,
      }
    );
  }
}