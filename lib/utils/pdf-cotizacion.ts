import jsPDF from "jspdf";

/* ============================ CONFIGURACIÓN ============================ */
const AZUL = "#0033A0"; // azul institucional
const GRIS_TEXTO = "#4A4A4A";
const GRIS_BORDE = "#D9D9D9";
const LOGO_URL =
  "https://assets.jumpseller.com/store/spartan-de-chile/themes/317202/options/27648963/Logo-spartan-white.png?1600810625";

/* ============================ TIPOS ============================ */
type OpcionesPDF = {
  modoPrecio?: "auto" | "kilo" | "presentacion";
  mostrarTotales?: boolean;
  mostrarIva?: boolean;
  mostrarTotalColumna?: boolean;
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
  cantidad: number;
  precioUnitario: number;
  total: number;
};

type EjecutivoPDF = {
  nombre: string;
  correo: string;
  celular: string;
  cargo: string;
};

type DatosPDF = {
  numero: string;
  fecha: string;
  cliente: ClientePDF;
  productos: ProductoPDF[];
  validez?: string;
  formaPago?: string;
  entrega?: string;
  observaciones?: string;
  subtotal?: number;
  iva?: number;
  total?: number;
  opciones?: OpcionesPDF;
  ejecutivo: EjecutivoPDF;
};

/* ============================ UTILIDADES ============================ */
function moneyCL(n: number) {
  return (n || 0).toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}
function mm(n: number) {
  return n;
}
function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  if (!text) return [""];
  return doc.splitTextToSize(text, maxWidth) as string[];
}
function isPT(code: string) {
  return (code || "").toUpperCase().startsWith("PT");
}

/* ============================ COMPONENTES ============================ */
function drawTableHeader(doc: jsPDF, y: number, x: number, widths: number[], headers: string[]) {
  const totalWidth = widths.reduce((a, b) => a + b, 0);
  doc.setFillColor(0, 51, 160);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.rect(x, y, totalWidth, mm(7), "F");

  let cursorX = x;
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i], cursorX + mm(2), y + mm(5));
    cursorX += widths[i];
  }

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
}

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

  const wrapped: string[][] = cells.map((c, idx) => {
    const text = typeof c === "number" ? String(c) : c || "";
    const w = widths[idx] - mm(4);
    return wrapText(doc, text, w);
  });
  const lines = Math.max(...wrapped.map((arr) => arr.length));
  const height = Math.max(lineHeight * lines, lineHeight);

  if (withBorder) {
    doc.setDrawColor(GRIS_BORDE);
    doc.rect(x, y, totalWidth, height);
  }

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

function ensureSpace(doc: jsPDF, y: number, needed: number) {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + needed > pageH - mm(15)) {
    doc.addPage();
    return mm(15);
  }
  return y;
}

/* ============================ FUNCIÓN PRINCIPAL ============================ */
export function generarPdfCotizacion(data: DatosPDF) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const { numero, fecha, cliente, productos, ejecutivo, opciones: optsIn } = data;

  const opts: Required<OpcionesPDF> = {
    modoPrecio: optsIn?.modoPrecio ?? "auto",
    mostrarTotales: optsIn?.mostrarTotales ?? true,
    mostrarIva: optsIn?.mostrarIva ?? true,
    mostrarTotalColumna: optsIn?.mostrarTotalColumna ?? true,
    mostrarNotaTecnica: optsIn?.mostrarNotaTecnica ?? true,
  };

  const pageW = doc.internal.pageSize.getWidth();
  const marginX = mm(15);
  let y = mm(15);

  /* ---------- ENCABEZADO LIMPIO ---------- */
  try {
    const logoW = mm(55);
    const logoH = mm(13);
    const logoX = (pageW - logoW) / 2;
    doc.addImage(LOGO_URL, "PNG", logoX, y, logoW, logoH);
    y += mm(22);
  } catch {
    y += mm(22);
  }

  // Título y número
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(AZUL);
  doc.text("COTIZACIÓN", pageW / 2, y, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(GRIS_TEXTO);
  doc.text(`CTZ N° ${numero}`, pageW - marginX, y - 1, { align: "right" });

  y += mm(5);
  doc.text(fecha, pageW - marginX, y, { align: "right" });
  y += mm(10);

  /* ---------- DATOS CLIENTE ---------- */
  doc.setFontSize(10);
  doc.setTextColor(GRIS_TEXTO);
  doc.text("Señores", marginX, y);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(cliente.nombre || "", marginX + mm(20), y);
  y += mm(5);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(GRIS_TEXTO);
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

  /* ---------- TEXTO INTRODUCTORIO ---------- */
  doc.setTextColor(0, 0, 0);
  const intro =
    "De acuerdo a lo solicitado, tenemos el agrado de cotizar algunos de los productos que Spartan de Chile Ltda., fabrica y distribuye en el país, y/o maquinaria / accesorios de limpieza industrial.";
  const introWrapped = wrapText(doc, intro, pageW - marginX * 2);
  introWrapped.forEach((ln) => {
    doc.text(ln, marginX, y);
    y += mm(4);
  });
  y += mm(4);

  /* ---------- TABLA ---------- */
  const showTotalCol = opts.mostrarTotalColumna;
  const widths = showTotalCol
    ? [mm(32), mm(76), mm(30), mm(30), mm(30)]
    : [mm(32), mm(100), mm(30), mm(35)];

  const headers = showTotalCol
    ? ["CÓDIGO", "PRODUCTO / DESCRIPCIÓN", "CANTIDAD SOLICITADA", "PRECIO NETO", "TOTAL S/IVA"]
    : ["CÓDIGO", "PRODUCTO / DESCRIPCIÓN", "CANTIDAD", "PRECIO NETO"];

  y = ensureSpace(doc, y, mm(10));
  drawTableHeader(doc, y, marginX, widths, headers);
  y += mm(8);
  doc.setFontSize(9);

  let accSubtotal = 0;
  for (const p of productos) {
    const cantTxt = String(p.cantidad) + " unidad" + (p.cantidad > 1 ? "es" : "");
    const cells = showTotalCol
      ? [p.codigo, p.descripcion, cantTxt, moneyCL(p.precioUnitario), moneyCL(p.total)]
      : [p.codigo, p.descripcion, cantTxt, moneyCL(p.precioUnitario)];
    const h = drawRow(doc, y, marginX, widths, cells, mm(6.5), true);
    y += h;
    accSubtotal += Math.round(p.total || 0);
  }

  /* ---------- CONDICIONES COMERCIALES ---------- */
  y += mm(8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const condiciones: string[] = [
    "Estos precios son unitarios netos y no incluyen I.V.A.",
    "Despacho Mínimo: $50.000 + IVA, puesto en sus bodegas Región Metropolitana, cualquier pedido menor a este monto debe pagar despacho de $19.900 + IVA",
    `Plazo de entrega: ${data.entrega || "A convenir"}`,
    `Validez cotización: ${data.validez || "10 días"}`,
    `Forma de pago: ${data.formaPago || "Contado - Transferencia"}`,
    "",
    "Spartan de Chile Ltda. presta asesoría técnica permanente, sin costo para el cliente, en el uso de su amplia gama de productos, solucionando cualquier duda o dificultad en su aplicación.",
  ];
  condiciones.forEach((linea) => {
    const wrapped = wrapText(doc, linea, pageW - marginX * 2);
    wrapped.forEach((ln) => {
      doc.text(ln, marginX, y);
      y += mm(4);
    });
  });

  /* ---------- FIRMA ---------- */
  y += mm(8);
  const firmaX = marginX + mm(90);
  doc.setFont("helvetica", "normal");
  doc.text("Sin otro particular, les saluda muy atentamente.", firmaX, y, { align: "left" });
  y += mm(10);
  doc.setFont("helvetica", "bold");
  doc.text(ejecutivo.nombre, firmaX, y);
  y += mm(5);
  doc.text("SPARTAN DE CHILE LTDA.", firmaX, y);
  y += mm(5);
  doc.setFont("helvetica", "normal");
  doc.text("Fono: 2 2738-5150", firmaX, y);
  y += mm(5);
  doc.text(`Cel.: ${ejecutivo.celular}`, firmaX, y);
  y += mm(5);
  doc.text(`E-mail: ${ejecutivo.correo}`, firmaX, y);

  /* ---------- OUTPUT ---------- */
  const filename = `Cotizacion_${numero}.pdf`;
  const base64 = btoa(doc.output("datauristring").split(",")[1]);
  return { filename, base64 };
}
