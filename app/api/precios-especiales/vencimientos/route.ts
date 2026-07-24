import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

type SheetRow = Record<string, string>;

function num(value: unknown) {
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

function normalizarTexto(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function parseCsv(text: string): SheetRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  const pushCell = () => {
    row.push(cell);
    cell = "";
  };

  const pushRow = () => {
    if (row.length) rows.push(row);
    row = [];
  };

  const content = String(text || "").replace(/\r/g, "");

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (inQuotes) {
      if (char === '"') {
        if (content[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        pushCell();
      } else if (char === "\n") {
        pushCell();
        pushRow();
      } else {
        cell += char;
      }
    }
  }

  if (cell.length || row.length) {
    pushCell();
    pushRow();
  }

  if (!rows.length) return [];

  const headers = rows[0].map((header) => header.trim());

  return rows
    .slice(1)
    .filter(
      (currentRow) =>
        currentRow &&
        !currentRow.every((value) => value === "")
    )
    .map((currentRow) => {
      const result: SheetRow = {};

      headers.forEach((header, index) => {
        result[header] = String(currentRow[index] ?? "").trim();
      });

      return result;
    });
}

function parseFechaFlexible(value: unknown): Date | null {
  const raw = String(value ?? "").trim();

  if (!raw) return null;

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

  let match = clean.match(
    /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/
  );

  if (match) {
    return new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3])
    );
  }

  match = clean.match(
    /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/
  );

  if (match) {
    let year = Number(match[3]);

    if (year < 100) year += 2000;

    return new Date(
      year,
      Number(match[2]) - 1,
      Number(match[1])
    );
  }

  const timestamp = Date.parse(raw);

  return Number.isNaN(timestamp)
    ? null
    : new Date(timestamp);
}

function startOfDay(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  ).getTime();
}

function diasHasta(fecha: Date) {
  const hoy = startOfDay(new Date());
  const vencimiento = startOfDay(fecha);

  return Math.ceil(
    (vencimiento - hoy) / 86_400_000
  );
}

function formatFecha(date: Date) {
  return date.toLocaleDateString("es-CL");
}

async function leerPreciosEspeciales() {
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
      `No se pudo leer la hoja: ${response.status}`
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
      .toLowerCase()
      .trim();

    if (!correoUsuario) {
      return NextResponse.json(
        {
          ok: false,
          error: "Usuario no autenticado",
        },
        { status: 401 }
      );
    }

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

    const data = rows
      .map((row) => {
        const fecha = parseFechaFlexible(
          row["Fecha Vencimiento"] ??
            row["Fecha vencimiento"] ??
            row["Vencimiento"]
        );

        if (!fecha) return null;

        const diasRestantes = diasHasta(fecha);

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
          diasRestantes,

          ejecutivo: String(
            row["ejecutivo"] ??
              row["Ejecutivo"] ??
              ""
          ).trim(),
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
      .sort(
        (a, b) =>
          a.diasRestantes - b.diasRestantes
      );

    return NextResponse.json({
      ok: true,
      total: data.length,
      ejecutivo: ejecutivoData.nombre,
      correoUsuario,
      data,
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