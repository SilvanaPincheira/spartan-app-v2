import jsPDF from "jspdf";
import { logoBase64 } from "@/lib/logo64";

/* ============================ CONFIGURACIÓN ============================ */
const AZUL = "#0033A0";
const GRIS_TEXTO = "#4A4A4A";
const GRIS_BORDE = "#D9D9D9";

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
  region?: string;
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
  const { numero, fecha, cliente, productos, ejecutivo, region, opciones: optsIn } = data;

  const opts: Required<OpcionesPDF> = {
    modoPrecio: optsIn?.modoPrecio ?? "auto",
    mostrarTotales: optsIn?.mostrarTotales ?? true,
    mostrarIva: optsIn?.mostrarIva ?? true,
    mostrarTotalColumna: optsIn?.mostrarTotalColumna ?? true,
    mostrarNotaTecnica: optsIn?.mostrarNotaTecnica ?? true,
  };

  const pageW = doc.internal.pageSize.getWidth();
  const marginX = mm(15);

  /* ----------- LOGO EN ESQUINA ----------- */
try {
  const logoX = mm(15);
  const logoY = mm(10);

  // Obtener proporciones reales del logo
  const imgProps = doc.getImageProperties(logoBase64);

  // Mantener proporción original (ajusta el ancho deseado)
  const logoW = mm(22); // ancho fijo deseado
  const logoH = (logoW * imgProps.height) / imgProps.width; // alto proporcional

  doc.addImage(logoBase64, "PNG", logoX, logoY, logoW, logoH);
} catch {}


  /* ---------- TÍTULO Y NÚMERO ---------- */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(AZUL);
  doc.text("COTIZACIÓN", pageW / 2, mm(25), { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(GRIS_TEXTO);
  const numeroLimpio = numero.replace(/^CTZ-?/i, ""); // elimina prefijo duplicado
  doc.text(`CTZ N° ${numeroLimpio}`, pageW - marginX, mm(22), { align: "right" });
  doc.text(fecha, pageW - marginX, mm(27), { align: "right" });

  let y = mm(42);

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
  if (region) {
    doc.text(`Región: ${region}`, marginX + mm(20), y);
    y += mm(5);
  }
  y += mm(2);

  /* ---------- INTRODUCCIÓN ---------- */
  const intro =
    "De acuerdo a lo solicitado, tenemos el agrado de cotizar algunos de los productos que Spartan de Chile Ltda., fabrica y distribuye en el país, y/o maquinaria / accesorios de limpieza industrial.";
  const introWrapped = wrapText(doc, intro, pageW - marginX * 2);
  doc.setTextColor(0, 0, 0);
  introWrapped.forEach((ln) => {
    doc.text(ln, marginX, y);
    y += mm(4);
  });
  y += mm(4);

  /* ---------- TABLA ---------- */
  const showTotalCol = opts.mostrarTotalColumna;
  const widths = showTotalCol
    ? [mm(25), mm(85), mm(25), mm(22), mm(23)]
    : [mm(25), mm(100), mm(28), mm(27)];

  const headers = showTotalCol
    ? ["Código", "Producto / Descripción", "Cantidad", "Precio Neto", "Total S/IVA"]
    : ["Código", "Producto / Descripción", "Cantidad", "Precio Neto"];

  y = ensureSpace(doc, y, mm(10));
  doc.setFontSize(9);
  drawTableHeader(doc, y, marginX, widths, headers);
  y += mm(7);
  doc.setFontSize(8.5);

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

  /* ---------- TOTALES ---------- */
  if (opts.mostrarTotales) {
    y += mm(6);
    const xTot = pageW - marginX - mm(60);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Totales", xTot, y);
    y += mm(5);
    doc.setFont("helvetica", "normal");

    doc.text("Subtotal:", xTot, y);
    doc.text(moneyCL(data.subtotal || 0), pageW - marginX, y, { align: "right" });
    y += mm(5);

    if (opts.mostrarIva) {
      doc.text("IVA (19%):", xTot, y);
      doc.text(moneyCL(data.iva || 0), pageW - marginX, y, { align: "right" });
      y += mm(5);

      doc.setFont("helvetica", "bold");
      doc.text("TOTAL:", xTot, y);
      doc.text(moneyCL(data.total || 0), pageW - marginX, y, { align: "right" });
      doc.setFont("helvetica", "normal");
    }
  }

  /* ---------- CONDICIONES ---------- */
  y += mm(10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const condiciones: string[] = [
    "Estos precios son unitarios netos y no incluyen I.V.A.",
    "Despacho Mínimo: $50.000 + IVA, puesto en sus bodegas Región Metropolitana, cualquier pedido menor a este monto debe pagar despacho de $19.900 + IVA",
    `Plazo de entrega: ${data.entrega || "A convenir"}`,
    `Validez cotización: ${data.validez || "10 días"}`,
    `Forma de pago: ${data.formaPago || "Contado - Transferencia"}`,
    "",
    "Spartan de Chile Ltda. presta asesoría técnica permanente, sin costo para el cliente, en el uso de su amplia gama de productos.",
  ];
  condiciones.forEach((linea) => {
    const wrapped = wrapText(doc, linea, pageW - marginX * 2);
    wrapped.forEach((ln) => {
      doc.text(ln, marginX, y);
      y += mm(4);
    });
  });
  /* ---------- DATOS DE TRANSFERENCIA ---------- */
y += mm(8);
doc.setFont("helvetica", "bold");
doc.setFontSize(11);
doc.setTextColor(30, 64, 175); // Azul BCI
doc.text("Datos de Transferencia", marginX, y);
y += mm(5);

doc.setFont("helvetica", "normal");
doc.setFontSize(9);
doc.setTextColor(0, 0, 0);

const transferencia = [
  "Banco: Crédito e Inversiones (BCI)",
  "Titular: Spartan de Chile Ltda.",
  "RUT: 76.333.980-7",
  "N° Cuenta: 25013084",
  "Tipo de cuenta: Cuenta Corriente",
  "Email comprobantes: pagos@spartan.cl",
];

transferencia.forEach((linea) => {
  doc.text(linea, marginX + mm(4), y);
  y += mm(5);
});


  /* ---------- FIRMA ---------- */
  y += mm(10);
  const firmaX = marginX + mm(90);
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
  const pdfBytes = doc.output("arraybuffer");
  const base64 = btoa(
    new Uint8Array(pdfBytes).reduce((data, byte) => data + String.fromCharCode(byte), "")
  );
  return { filename, base64 };
}
