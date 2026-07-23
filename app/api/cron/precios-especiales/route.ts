import { NextRequest, NextResponse } from "next/server";

type SheetRow = Record<string, string>;

type RegistroVencimiento = {
  codigoSN: string;
  nombreSN: string;
  articulo: string;
  descripcion: string;
  precioEspecial: number;
  fechaVencimiento: string;
  diasRestantes: number;
  ejecutivo: string;
  correoEjecutivo: string;
};

function num(value: unknown) {
  if (typeof value === "string") {
    let cleaned = value.trim().replace(/\s/g, "");

    if (cleaned.includes(",")) {
      cleaned = cleaned
        .replace(/\./g, "")
        .replace(",", ".");
    }

    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number) {
  return Number(value || 0).toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 2,
  });
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

  const headers = rows[0].map((header) =>
    header.trim()
  );

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
        result[header] = String(
          currentRow[index] ?? ""
        ).trim();
      });

      return result;
    });
}

function parseFechaFlexible(value: unknown): Date | null {
  const raw = String(value ?? "").trim();

  if (!raw) return null;

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
  return Math.ceil(
    (startOfDay(fecha) - startOfDay(new Date())) /
      86_400_000
  );
}

async function leerPreciosEspeciales() {
  const spreadsheetId =
    "1UXVAxwzg-Kh7AWCPnPbxbEpzXnRPR2pDBKrRUFNZKZo";

  const gid = "2117069636";

  const url =
    `https://docs.google.com/spreadsheets/d/` +
    `${spreadsheetId}/export?format=csv&gid=${gid}`;

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

function construirHtml(
  ejecutivo: string,
  registros: RegistroVencimiento[]
) {
  const filas = registros
    .map(
      (registro) => `
        <tr>
          <td style="padding:8px;border:1px solid #ddd;">
            ${registro.nombreSN}
          </td>

          <td style="padding:8px;border:1px solid #ddd;">
            ${registro.codigoSN}
          </td>

          <td style="padding:8px;border:1px solid #ddd;">
            ${registro.articulo}
          </td>

          <td style="padding:8px;border:1px solid #ddd;">
            ${registro.descripcion}
          </td>

          <td style="padding:8px;border:1px solid #ddd;text-align:right;">
            ${money(registro.precioEspecial)}
          </td>

          <td style="padding:8px;border:1px solid #ddd;text-align:center;">
            ${registro.fechaVencimiento}
          </td>

          <td style="padding:8px;border:1px solid #ddd;text-align:center;">
            ${registro.diasRestantes}
          </td>
        </tr>
      `
    )
    .join("");

  return `
    <div style="font-family:Arial,sans-serif;color:#222;">
      <p>Hola ${ejecutivo || "Ejecutivo"},</p>

      <p>
        Tienes <strong>${registros.length}</strong>
        precio(s) especial(es) que vencen dentro de los
        próximos 60 días.
      </p>

      <p>
        Debes revisarlos y solicitar su regularización antes
        de la fecha de vencimiento.
      </p>

      <p>
        Una vez vencidos, la Nota de Venta dejará de aplicar
        el precio especial y utilizará el precio base
        correspondiente.
      </p>

      <table
        style="border-collapse:collapse;width:100%;font-size:12px;"
      >
        <thead>
          <tr style="background:#f4f4f5;">
            <th style="padding:8px;border:1px solid #ddd;text-align:left;">
              Cliente
            </th>

            <th style="padding:8px;border:1px solid #ddd;text-align:left;">
              Código SN
            </th>

            <th style="padding:8px;border:1px solid #ddd;text-align:left;">
              Artículo
            </th>

            <th style="padding:8px;border:1px solid #ddd;text-align:left;">
              Descripción
            </th>

            <th style="padding:8px;border:1px solid #ddd;text-align:right;">
              Precio especial
            </th>

            <th style="padding:8px;border:1px solid #ddd;text-align:center;">
              Vencimiento
            </th>

            <th style="padding:8px;border:1px solid #ddd;text-align:center;">
              Días
            </th>
          </tr>
        </thead>

        <tbody>
          ${filas}
        </tbody>
      </table>

      <p style="margin-top:20px;color:#666;font-size:12px;">
        Mensaje automático de SpartanOne.
      </p>
    </div>
  `;
}

export async function GET(request: NextRequest) {
  try {
    const secret =
      request.headers.get("authorization");

    if (
      secret !==
      `Bearer ${process.env.CRON_SECRET}`
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "No autorizado",
        },
        { status: 401 }
      );
    }

    const rows = await leerPreciosEspeciales();

    const registros: RegistroVencimiento[] = rows
      .map((row) => {
        const fecha = parseFechaFlexible(
          row["Fecha Vencimiento"] ??
            row["Fecha vencimiento"] ??
            row["Vencimiento"]
        );

        if (!fecha) return null;

        const diasRestantes = diasHasta(fecha);

        const correoEjecutivo = String(
          row["correo_ejecutivo"] ??
            row["Correo Ejecutivo"] ??
            row["Email Ejecutivo"] ??
            ""
        )
          .toLowerCase()
          .trim();

        return {
          codigoSN: String(
            row["Código SN"] ??
              row["Codigo SN"] ??
              ""
          ).trim(),

          nombreSN: String(
            row["Nombre SN"] ?? ""
          ).trim(),

          articulo: String(
            row["Número de artículo"] ??
              row["Numero de articulo"] ??
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

          fechaVencimiento:
            fecha.toLocaleDateString("es-CL"),

          diasRestantes,

          ejecutivo: String(
            row["ejecutivo"] ??
              row["Ejecutivo"] ??
              ""
          ).trim(),

          correoEjecutivo,
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
          Boolean(row.correoEjecutivo) &&
          row.diasRestantes >= 0 &&
          row.diasRestantes <= 60
      );

    const agrupados = registros.reduce<
      Record<string, RegistroVencimiento[]>
    >((acc, registro) => {
      if (!acc[registro.correoEjecutivo]) {
        acc[registro.correoEjecutivo] = [];
      }

      acc[registro.correoEjecutivo].push(
        registro
      );

      return acc;
    }, {});

    const resultados = [];

    for (const [
      correo,
      registrosEjecutivo,
    ] of Object.entries(agrupados)) {
      const ejecutivo =
        registrosEjecutivo[0]?.ejecutivo ||
        "Ejecutivo";

      const response = await fetch(
        new URL(
          "/api/send-notaventa",
          request.url
        ),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            subject:
              "Precios especiales próximos a vencer",

            message: construirHtml(
              ejecutivo,
              registrosEjecutivo
            ),

            to: correo,
            cc: undefined,
            attachments: [],

            replyTo:
              "no-reply@spartan.cl",

            fromName:
              "SpartanOne — Alertas de precios",
          }),
        }
      );

      resultados.push({
        correo,
        total: registrosEjecutivo.length,
        enviado: response.ok,
        detalle: response.ok
          ? "OK"
          : await response.text(),
      });
    }

    return NextResponse.json({
      ok: true,
      ejecutivos: resultados.length,
      resultados,
    });
  } catch (error: any) {
    console.error(
      "Error cron precios especiales:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          "No se pudo ejecutar el proceso",
      },
      { status: 500 }
    );
  }
}