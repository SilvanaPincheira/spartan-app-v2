import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

type SheetRow = Record<string, string>;

function num(value: unknown): number {
  if (typeof value === "string") {
    let cleaned = value.trim().replace(/\s/g, "");

    if (cleaned.includes(",")) {
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    }

    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizarTexto(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function parseCsv(text: string): SheetRow[] {
  const rows: string[][] = [];

  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  const pushCell = () => {
    currentRow.push(currentCell);
    currentCell = "";
  };

  const pushRow = () => {
    if (currentRow.length > 0) {
      rows.push(currentRow);
    }

    currentRow = [];
  };

  const content = String(text || "").replace(/\r/g, "");

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (inQuotes) {
      if (char === '"') {
        if (content[i + 1] === '"') {
          currentCell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentCell += char;
      }

      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      pushCell();
    } else if (char === "\n") {
      pushCell();
      pushRow();
    } else {
      currentCell += char;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    pushCell();
    pushRow();
  }

  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map((header) => header.trim());

  return rows
    .slice(1)
    .filter(
      (row) =>
        Array.isArray(row) &&
        !row.every((value) => String(value ?? "").trim() === "")
    )
    .map((row) => {
      const result: SheetRow = {};

      headers.forEach((header, index) => {
        result[header] = String(row[index] ?? "").trim();
      });

      return result;
    });
}

function parseFechaFlexible(value: unknown): Date | null {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return null;
  }

  // Fecha serial de Google Sheets o Excel
  const serial = Number(raw);

  if (
    Number.isFinite(serial) &&
    serial > 1000 &&
    !raw.includes("-") &&
    !raw.includes("/")
  ) {
    const base = new Date(1899, 11, 30).getTime();

    return new Date(base + serial * 86_400_000);
  }

  const clean = raw.replace(
    /[T ]\d{1,2}:\d{2}(:\d{2})?.*$/,
    ""
  );

  // Formato AAAA-MM-DD
  let match = clean.match(
    /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/
  );

  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    return new Date(year, month - 1, day);
  }

  // Formato DD-MM-AAAA
  match = clean.match(
    /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/
  );

  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]);

    let year = Number(match[3]);

    if (year < 100) {
      year += 2000;
    }

    return new Date(year, month - 1, day);
  }

  const timestamp = Date.parse(raw);

  if (Number.isNaN(timestamp)) {
    return null;
  }

  return new Date(timestamp);
}

function startOfDay(date: Date): number {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  ).getTime();
}

function diasHasta(fecha: Date): number {
  const hoy = startOfDay(new Date());
  const vencimiento = startOfDay(fecha);

  return Math.ceil(
    (vencimiento - hoy) / 86_400_000
  );
}

function formatFecha(date: Date): string {
  return date.toLocaleDateString("es-CL");
}

async function leerPreciosEspeciales(): Promise<SheetRow[]> {
  const spreadsheetId =
    "1UXVAxwzg-Kh7AWCPnPbxbEpzXnRPR2pDBKrRUFNZKZo";

  const gid = "2117069636";

  const url =
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}` +
    `/export?format=csv&gid=${gid}`;

  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `No se pudo leer la hoja de precios especiales: ${response.status}`
    );
  }

  return parseCsv(await response.text());
}

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({
      cookies,
    });

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const correoUsuario = String(
      session?.user?.email || ""
    )
      .trim()
      .toLowerCase();

    if (!correoUsuario) {
      return NextResponse.json(
        {
          ok: false,
          error: "Usuario no autenticado",
        },
        { status: 401 }
      );
    }

    /*
     * Busca el nombre del ejecutivo usando el correo
     * del usuario conectado.
     */
    const {
      data: ejecutivoData,
      error: ejecutivoError,
    } = await supabase
      .from("ejecutivos")
      .select("nombre, email")
      .ilike("email", correoUsuario)
      .maybeSingle();

    if (ejecutivoError) {
      throw new Error(
        `No se pudo consultar la tabla ejecutivos: ${ejecutivoError.message}`
      );
    }

    if (!ejecutivoData?.nombre) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "El usuario conectado no está registrado en la tabla ejecutivos",
        },
        { status: 404 }
      );
    }

    const nombreEjecutivo = normalizarTexto(
      ejecutivoData.nombre
    );

    const rows = await leerPreciosEspeciales();

    const registros = rows
      .map((row) => {
        const fecha = parseFechaFlexible(
          row["Fecha Vencimiento"] ??
            row["Fecha vencimiento"] ??
            row["Vencimiento"]
        );

        if (!fecha) {
          return null;
        }

        const diasRestantes = diasHasta(fecha);

        const ejecutivo = String(
          row["ejecutivo"] ??
            row["Ejecutivo"] ??
            ""
        ).trim();

        return {
          codigoSN: String(
            row["Código SN"] ??
              row["Codigo SN"] ??
              row["CódigoSN"] ??
              ""
          ).trim(),

          nombreSN: String(
            row["Nombre SN"] ??
              row["NombreSN"] ??
              ""
          ).trim(),

          articulo: String(
            row["Número de artículo"] ??
              row["Numero de articulo"] ??
              row["Número de articulo"] ??
              ""
          ).trim(),

          descripcion: String(
            row["Descripción del artículo"] ??
              row["Descripcion del articulo"] ??
              ""
          ).trim(),

          precioEspecial: num(
            row["Precio especial"]
          ),

          precioLista: num(
            row["precio lista"] ??
              row["Precio lista"] ??
              row["Precio Lista"]
          ),

          fechaVencimiento: formatFecha(fecha),
          fechaOrden: startOfDay(fecha),
          diasRestantes,
          ejecutivo,

          estado:
            diasRestantes < 0
              ? "VENCIDO"
              : diasRestantes <= 30
                ? "URGENTE"
                : "PROXIMO",
        };
      })
      .filter(
        (
          row
        ): row is NonNullable<typeof row> =>
          row !== null
      )
      .filter(
        (row) =>
          normalizarTexto(row.ejecutivo) ===
          nombreEjecutivo
      )
      /*
       * Conservamos:
       * - todos los vencidos;
       * - vigentes que vencen en máximo 60 días.
       *
       * Se ocultan los vigentes con más de 60 días.
       */
      .filter(
        (row) =>
          row.diasRestantes < 0 ||
          row.diasRestantes <= 60
      )
      .sort((a, b) => {
        /*
         * Primero los próximos a vencer.
         * Después los vencidos, comenzando por los más recientes.
         */
        const aVencido = a.diasRestantes < 0;
        const bVencido = b.diasRestantes < 0;

        if (aVencido !== bVencido) {
          return aVencido ? 1 : -1;
        }

        if (!aVencido) {
          return a.diasRestantes - b.diasRestantes;
        }

        return b.diasRestantes - a.diasRestantes;
      });

    const proximos30 = registros.filter(
      (row) =>
        row.diasRestantes >= 0 &&
        row.diasRestantes <= 30
    ).length;

    const proximos60 = registros.filter(
      (row) =>
        row.diasRestantes >= 31 &&
        row.diasRestantes <= 60
    ).length;

    const vencidos = registros.filter(
      (row) => row.diasRestantes < 0
    ).length;

    return NextResponse.json({
      ok: true,

      ejecutivo: ejecutivoData.nombre,
      correoUsuario,

      resumen: {
        total: registros.length,
        proximos30,
        proximos60,
        vencidos,
      },

      data: registros,
    });
  } catch (error: unknown) {
    console.error(
      "Error API vencimientos:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron consultar los vencimientos",
      },
      { status: 500 }
    );
  }
}