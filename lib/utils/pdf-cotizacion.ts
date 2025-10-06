import jsPDF from "jspdf";

/* ============================ Configuración ============================ */
const AZUL = "#0033A0";                 // Azul institucional
const GRIS_TEXTO = "#4A4A4A";
const GRIS_BORDE = "#D9D9D9";
const LOGO_URL =
  "https://assets.jumpseller.com/store/spartan-de-chile/themes/317202/options/27648963/Logo-spartan-white.png?1600810625";

type OpcionesPDF = {
  /** "auto" detecta PT → kilo; otros → presentación */
  modoPrecio?: "auto" | "kilo" | "presentacion";
  /** Muestra bloque Subtotal/IVA/Total */
  mostrarTotales?: boolean;
  /** Escribe “+IVA” en títulos/leyendas de precio */
  mostrarIva?: boolean;
  /** Muestra la columna TOTAL en la tabla */
  mostrarTotalColumna?: boolean;
  /** Inserta el bloque de condiciones comerciales */
  mostrarNotaTecnica?: boolean;
};

type ClientePDF = {
  nombre: string;
  rut?: string;
  direccion?: string;
  comuna?: string;
  email?: string;
  contacto?: string;
};

type ProductoPDF = {
  codigo: string;
  descripcion: string;
  cantidad: number;       // “1 unidad”, “2 x 20 Lts.” (puedes mandar el número y formateamos)
  precioUnitario: number; // por kg o por presentación (según modoPrecio)
  total: number;          // total del ítem (opcional si ocultas la columna)
};

type EjecutivoPDF = {
  nombre: string;
  correo: string;
  celular: string;
  cargo: string;
};

type DatosPDF = {
  numero: string;             // CTZ-2025-00001
  fecha: string;              // “Santiago, 06 de octubre de 2025”
  cliente: ClientePDF;
  productos: ProductoPDF[];
  /** Opcionales (para leyendas) */
  validez?: string;
  formaPago?: string;
  entrega?: string;
  observaciones?: string;
  /** Si no envías, se calculan desde productos */
  subtotal?: number;
  iva?: number;
  total?: number;
  opciones?: OpcionesPDF;
  ejecutivo: EjecutivoPDF;
};

/* ============================ Utilidades ============================ */
function moneyCL(n: number) {
  return (n || 0).toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}
function mm(n: number) {
  return n; // por legibilidad (todas las medidas están en mm)
}
function wrapText(
  doc: jsPDF,
  text: string,
  maxWidth: number
): string[] {
  if (!text) return [""];
  // jsPDF splitTextToSize hace la vida fácil
  return doc.splitTextToSize(text, maxWidth) as string[];
}
function isPT(code: string) {
  return (code || "").toUpperCase().startsWith("PT");
}

/* ============================ Header de tabla ============================ */
function drawTableHeader(
  doc: jsPDF,
  y: number,
  x: number,
  widths: number[],
  headers: string[]
) {
  const totalWidth = widths.reduce((a, b) => a + b, 0);
  doc.setFillColor(0, 51, 160); // #0033A0
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.rect(x, y, totalWidth, mm(8), "F");

  let cursorX = x;
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i], cursorX + mm(2), y + mm(5));
    cursorX += widths[i];
  }

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
}

/* ============================ Fila de tabla ============================ */
function drawRow(
  doc: jsPDF,
  y: number,
  x: number,
  widths: number[],
  cells: (string | number)[],
  lineHeight: number,
  withBorder = true
) {
  const totalWidth = widths.reduce((a, b) => a + b, 0);

  // Altura dinámica: la descripción puede traer múltiples líneas
  // Calculamos la altura máxima entre celdas envueltas
  const wrapped: string[][] = cells.map((c, idx) => {
    const text = typeof c === "number" ? String(c) : c || "";
    const w = widths[idx] - mm(4);
    return wrapText(doc, text, w);
  });
  const lines = Math.max(...wrapped.map((arr) => arr.length));
  const height = Math.max(lineHeight * lines, lineHeight);

  // Contenedor y bordes
  if (withBorder) {
    doc.setDrawColor(GRIS_BORDE);
    doc.rect(x, y, totalWidth, height);
  }

  // Imprimir celdas
  let cursorX = x;
  for (let i = 0; i < cells.length; i++) {
    const linesArr = wrapped[i];
    let innerY = y + mm(4);
    for (const ln of linesArr) {
      doc.text(ln, cursorX + mm(2), innerY);
      innerY += lineHeight - 1;
    }
    cursorX += widths[i];
  }

  return height;
}

/* ============================ Salto de página ============================ */
function ensureSpace(doc: jsPDF, y: number, needed: number) {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + needed > pageH - mm(15)) {
    doc.addPage();
    return mm(15); // top margin
  }
  return y;
}

/* ============================ Export principal ============================ */
export function generarPdfCotizacion(data: DatosPDF) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const {
    numero,
    fecha,
    cliente,
    productos,
    ejecutivo,
    opciones: optsIn,
  } = data;

  const opts: Required<OpcionesPDF> = {
    modoPrecio: optsIn?.modoPrecio ?? "auto",
    mostrarTotales: optsIn?.mostrarTotales ?? true,
    mostrarIva: optsIn?.mostrarIva ?? true,
    mostrarTotalColumna: optsIn?.mostrarTotalColumna ?? true,
    mostrarNotaTecnica: optsIn?.mostrarNotaTecnica ?? true,
  };

  const marginX = mm(15);
  let y = mm(15);

  /* -------------------- 1) Encabezado: Logo + Título + Fecha -------------------- */
  // Franja azul suave para que el logo blanco se vea
  const pageW = doc.internal.pageSize.getWidth();
  const logoBandH = mm(18);
  doc.setFillColor(0, 51, 160);
  doc.rect(0, 0, pageW, logoBandH, "F");

  // Logo centrado (blanco)
  try {
    const logoW = mm(60);
    const logoH = mm(14);
    const logoX = (pageW - logoW) / 2;
    doc.addImage(LOGO_URL, "PNG", logoX, mm(2), logoW, logoH);
  } catch {
    // Si falla la carga remota del logo, seguimos sin interrumpir la generación
  }

  y = mm(22);

  // Título centrado
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`COTIZACIÓN N° ${numero}`, pageW / 2, y, { align: "center" });

  // Fecha a la derecha (azul)
  doc.setFontSize(10);
  doc.setTextColor(0, 51, 160);
  doc.setFont("helvetica", "normal");
  doc.text(fecha, pageW - marginX, y, { align: "right" });
  doc.setTextColor(0, 0, 0);

  y += mm(8);

  /* -------------------- 2) Datos del cliente -------------------- */
  doc.setFontSize(10);
  doc.setTextColor(GRIS_TEXTO);
  doc.text("Señores", marginX, y);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.text(cliente.nombre || "", marginX + mm(20), y);
  y += mm(5);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(GRIS_TEXTO);
  if (cliente.contacto) {
    doc.text(`Att.: ${cliente.contacto}`, marginX + mm(20), y);
    y += mm(5);
  }
  if (cliente.email) {
    doc.text(`E-mail: ${cliente.email}`, marginX + mm(20), y);
    y += mm(5);
  }
  if (cliente.rut) {
    doc.text(`RUT: ${cliente.rut}`, marginX + mm(20), y);
    y += mm(5);
  }
  if (cliente.direccion) {
    const dir = `Dirección: ${cliente.direccion}${cliente.comuna ? `, ${cliente.comuna}` : ""}`;
    doc.text(dir, marginX + mm(20), y);
    y += mm(6);
  }
  y += mm(2);

  /* -------------------- 3) Texto introductorio -------------------- */
  doc.setTextColor(0, 0, 0);
  const intro =
    "De acuerdo a lo solicitado, tenemos el agrado de cotizar algunos de los productos que Spartan de Chile Ltda., fabrica y distribuye en el país, y/o maquinaria / accesorios de limpieza industrial.";
  const introWrapped = wrapText(doc, intro, pageW - marginX * 2);
  introWrapped.forEach((ln) => {
    doc.text(ln, marginX, y);
    y += mm(4);
  });
  y += mm(4);

  /* -------------------- 4) Tabla de productos -------------------- */
  // Calcular columnas según configuración
  const showTotalCol = opts.mostrarTotalColumna;
  const colCod = mm(32);
  const colDesc = showTotalCol ? mm(78) : mm(110);
  const colCant = mm(30);
  const colPrecio = mm(30);
  const colTotal = showTotalCol ? mm(30) : 0;

  const widths = showTotalCol
    ? [colCod, colDesc, colCant, colPrecio, colTotal]
    : [colCod, colDesc, colCant, colPrecio];

  // Encabezados dinámicos
  let precioHeader = "PRECIO NETO";
  if (opts.modoPrecio === "kilo") precioHeader = "PRECIO x KG NETO";
  if (opts.modoPrecio === "presentacion") precioHeader = "PRECIO PRESENTACIÓN NETO";
  if (opts.modoPrecio === "auto") precioHeader = "PRECIO NETO";

  if (opts.mostrarIva) precioHeader += " + IVA";

  const headers = showTotalCol
    ? ["CÓDIGO", "PRODUCTO / DESCRIPCIÓN", "CANTIDAD SOLICITADA", precioHeader, "TOTAL S/IVA"]
    : ["CÓDIGO", "PRODUCTO / DESCRIPCIÓN", "CANTIDAD SOLICITADA", precioHeader];

  y = ensureSpace(doc, y, mm(10));
  drawTableHeader(doc, y, marginX, widths, headers);
  y += mm(9);

  doc.setFontSize(9);
  doc.setDrawColor(GRIS_BORDE);

  const lineH = mm(7);

  // Acumuladores si no vienen en data
  let accSubtotal = 0;

  for (const p of productos) {
    // Determinar modo de precio (auto → PT es kilo)
    let modo = opts.modoPrecio;
    if (modo === "auto") {
      modo = isPT(p.codigo) ? "kilo" : "presentacion";
    }

    // Armar celdas
    const cantTxt = String(p.cantidad) + " " + (p.cantidad === 1 ? "unidad" : "unidades");
    const cells = showTotalCol
      ? [
          p.codigo || "",
          p.descripcion || "",
          cantTxt,
          moneyCL(p.precioUnitario),
          moneyCL(p.total || 0),
        ]
      : [p.codigo || "", p.descripcion || "", cantTxt, moneyCL(p.precioUnitario)];

    // Altura necesaria (puede saltar de página)
    const needed = mm(10) + lineH; // margen + fila aprox
    y = ensureSpace(doc, y, needed);

    const h = drawRow(doc, y, marginX, widths, cells, lineH, true);
    y += h;

    accSubtotal += Math.round(p.total || 0);
  }

  /* -------------------- 5) Totales (opcional) -------------------- */
  const useSubtotal = Number.isFinite(data.subtotal!) ? (data.subtotal as number) : accSubtotal;
  const useIva = Number.isFinite(data.iva!)
    ? (data.iva as number)
    : Math.round(useSubtotal * 0.19);
  const useTotal = Number.isFinite(data.total!) ? (data.total as number) : useSubtotal + useIva;

  if (opts.mostrarTotales) {
    y += mm(6);
    y = ensureSpace(doc, y, mm(22));

    const boxW = mm(80);
    const boxX = pageW - marginX - boxW;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    const labelIva = opts.mostrarIva ? "IVA 19 %" : "IVA (informativo)";
    const rows = [
      ["Subtotal", moneyCL(useSubtotal)],
      [labelIva, moneyCL(useIva)],
      ["Total Neto + IVA", moneyCL(useTotal)],
    ];

    // Marco
    doc.setDrawColor(GRIS_BORDE);
    doc.roundedRect(boxX, y, boxW, mm(18), 3, 3);
    let ry = y + mm(6);
    rows.forEach(([label, val], idx) => {
      doc.setFont("helvetica", idx === 2 ? "bold" : "normal");
      doc.text(label, boxX + mm(6), ry, { align: "left" });
      doc.text(val, boxX + boxW - mm(6), ry, { align: "right" });
      ry += mm(6);
    });

    y += mm(22);
  } else {
    y += mm(6);
  }

  /* -------------------- 6) Observaciones (si vienen) -------------------- */
  if (data.observaciones) {
    y = ensureSpace(doc, y, mm(14));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Observaciones", marginX, y);
    y += mm(5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    const obsWrapped = wrapText(doc, data.observaciones, pageW - marginX * 2);
    obsWrapped.forEach((ln) => {
      doc.text(ln, marginX, y);
      y += mm(4);
    });
    y += mm(4);
  }

  /* -------------------- 7) Condiciones comerciales (opcional) -------------------- */
  if (opts.mostrarNotaTecnica) {
    y = ensureSpace(doc, y, mm(40));
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);

    const condiciones: string[] = [
      `Estos precios son unitarios netos y ${opts.mostrarIva ? "no incluyen I.V.A." : "no incluyen I.V.A. (si aplica)"} `,
      "Despacho Mínimo: $50.000 + IVA, puesto en sus bodegas Región Metropolitana, cualquier pedido",
      "menor a este monto debe pagar despacho de $19.900 + IVA",
      `Plazo de entrega: ${data.entrega || "A convenir"}`,
      `Validez cotización: ${data.validez || "10 días"}`,
      `Forma de pago: ${data.formaPago || "Contado - Transferencia"}`,
      "",
      "Spartan de Chile Ltda. presta asesoría técnica permanente, sin costo para el cliente, en el uso de",
      "su amplia gama de productos, solucionando cualquier duda o dificultad en su aplicación.",
    ];

    condiciones.forEach((linea) => {
      const wrapped = wrapText(doc, linea, pageW - marginX * 2);
      wrapped.forEach((ln) => {
        doc.text(ln, marginX, y);
        y += mm(4);
      });
    });

    y += mm(4);
  }

  /* -------------------- 8) Firma del ejecutivo -------------------- */
  y = ensureSpace(doc, y, mm(28));
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const firmaX = pageW - mm(80);

  doc.text("Sin otro particular, les saluda muy atentamente.", firmaX, y, { align: "left" });
  y += mm(10);
  doc.setFont("helvetica", "bold");
  doc.text(ejecutivo.nombre || "", firmaX, y, { align: "left" });
  doc.setFont("helvetica", "bold");
  y += mm(5);
  doc.text("SPARTAN DE CHILE LTDA.", firmaX, y, { align: "left" });
  doc.setFont("helvetica", "normal");
  y += mm(5);
  doc.text("Fono: 2 2738-5150", firmaX, y, { align: "left" });
  y += mm(5);
  if (ejecutivo.celular) {
    doc.text(`Cel.: ${ejecutivo.celular}`, firmaX, y, { align: "left" });
    y += mm(5);
  }
  if (ejecutivo.correo) {
    doc.text(`E-mail: ${ejecutivo.correo}`, firmaX, y, { align: "left" });
    y += mm(5);
  }

  /* -------------------- 9) Output -------------------- */
  const filename = `Cotizacion_${numero}.pdf`;
  const base64 = btoa(doc.output("datauristring").split(",")[1]);
  return { filename, base64 };
}
