// /lib/utils/pdf-cotizacion.ts
import jsPDF from "jspdf";
import autoTable, { RowInput } from "jspdf-autotable";

// Opcionalmente puedes mover esto a un archivo de "branding"
const SPARTAN_BLUE = "#2B6CFF";
const TEXT_GRAY = "#3A3A3A";
const LIGHT_BORDER = "#D9E1F2";

type CotizacionInput = {
  numeroCTZ: string;
  fecha: string;               // ej: "Santiago, 24 de abril de 2024" o "24-04-2024"
  cliente: {
    nombre: string;
    rut: string;
    codigo: string;
    direccion: string;
    comuna?: string;
    contacto?: string;
    emailCliente: string;
  };
  productos: {
    codigo: string;
    descripcion: string;
    kilos?: number;            // solo informativo; NO se muestra (como el ejemplo)
    cantidad: number;
    precioUnitario: number;    // $ unitario (o $/presentación si es PT)
    total: number;
  }[];
  validez: string;
  formaPago: string;
  entrega: string;             // "Plazo de entrega"
  observaciones?: string;
  subtotal: number;
  iva: number;
  total: number;

  // Firma dinámica del ejecutivo
  ejecutivo: {
    nombre: string;
    correo?: string;
    celular?: string;
    cargo?: string;            // por defecto "Ejecutivo Comercial"
  };

  // Branding
  ciudad?: string;             // para la línea de fecha “Santiago, …” (opcional)
  logoUrl?: string;            // URL del logo (por defecto el tuyo)
};

async function imageUrlToDataUrl(url: string): Promise<string | null> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    await new Promise((res, rej) => {
      img.onload = () => res(true);
      img.onerror = rej;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

function moneyCL(n: number) {
  return (n || 0).toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
}

export async function generarPdfCotizacion(data: CotizacionInput): Promise<{ filename: string; base64: string }> {
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const marginX = 20;
  let cursorY = 16;

  // ===== HEADER: logo + título derecha =====
  // Logo
  const logoUrl =
    data.logoUrl ||
    "https://images.jumpseller.com/store/spartan-de-chile/store/logo/Spartan_Logo_-_copia.jpg?0";

  const logoDataUrl = await imageUrlToDataUrl(logoUrl);
  if (logoDataUrl) {
    pdf.addImage(logoDataUrl, "PNG", marginX, cursorY - 2, 32, 12);
  } else {
    // fallback: nombre textual si no se pudo cargar el logo
    pdf.setTextColor(0);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text("SPARTAN", marginX, cursorY + 6);
  }

  // Título
  pdf.setTextColor(SPARTAN_BLUE);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  const title = `COTIZACIÓN No ${data.numeroCTZ.replace(/^CTZ-/, "")}`;
  pdf.text(title, pageWidth - marginX, cursorY + 2, { align: "right" });

  pdf.setTextColor(100);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text("page.tsx / app/ventas/cotizacion", pageWidth - marginX, cursorY + 8, { align: "right" });

  cursorY += 18;

  // ===== BLOQUE EMPRESA / FECHA =====
  pdf.setTextColor(0);
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  pdf.text("SPARTAN DE CHILE LTDA.", marginX, cursorY);

  pdf.setTextColor(SPARTAN_BLUE);
  pdf.setFont("helvetica", "normal");
  const fechaLinea = data.fecha || "";
  pdf.text(fechaLinea, pageWidth - marginX, cursorY, { align: "right" });

  cursorY += 6;
  pdf.setTextColor(TEXT_GRAY);
  pdf.setFontSize(9);
  pdf.text("RUT: 76 883-980-7", marginX, cursorY);
  cursorY += 5;
  pdf.text("Cerro Sarita Lucia #9873 - Quilicura - Santiago", marginX, cursorY);
  cursorY += 5;
  pdf.setTextColor(SPARTAN_BLUE);
  pdf.text("Teléfono: 227385150", marginX, cursorY);
  cursorY += 5;
  pdf.text("ventas@spartan.cl", marginX, cursorY);

  // Separador tenue
  cursorY += 6;
  pdf.setDrawColor(LIGHT_BORDER);
  pdf.setLineWidth(0.3);
  pdf.line(marginX, cursorY, pageWidth - marginX, cursorY);
  cursorY += 6;

  // ===== CLIENTE =====
  pdf.setTextColor(0);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text("Señores", marginX, cursorY);
  cursorY += 6;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text((data.cliente.nombre || "").toUpperCase(), marginX, cursorY);
  cursorY += 6;

  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(SPARTAN_BLUE);
  const mailCliente = data.cliente.emailCliente || "";
  if (mailCliente) pdf.text(mailCliente, marginX, cursorY);
  cursorY += 8;

  // ===== TABLA DE PRODUCTOS =====
  // Encabezado azul como en el ejemplo
  const headStyles = {
    fillColor: SPARTAN_BLUE,
    textColor: "#FFFFFF",
    halign: "center" as const,
    valign: "middle" as const,
    fontStyle: "bold" as const,
    lineColor: LIGHT_BORDER,
  };
  const bodyStyles = {
    textColor: 20,
    halign: "left" as const,
    valign: "middle" as const,
    lineColor: LIGHT_BORDER,
  };

  // Mapeo de filas
  const bodyRows: RowInput[] = data.productos.map((p) => [
    p.codigo || "",
    p.descripcion || "",
    `${p.cantidad} ${p.cantidad === 1 ? "unidad" : "unidades"}`,
    moneyCL(p.precioUnitario),
    moneyCL(p.total),
  ]);

  autoTable(pdf, {
    startY: cursorY,
    head: [["CÓDIGO", "PRODUCTO / DESCRIPCIÓN", "CANTIDAD", "PRECIO UNITARIO", "TOTAL"]],
    body: bodyRows,
    styles: { ...bodyStyles, fontSize: 9 },
    headStyles: { ...headStyles, fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 36 },         // Código
      1: { cellWidth: 88 },         // Descripción
      2: { cellWidth: 26, halign: "center" },
      3: { cellWidth: 26, halign: "right" },
      4: { cellWidth: 26, halign: "right" },
    },
    tableLineWidth: 0.2,
    theme: "grid",
    willDrawCell: (dataCell) => {
      // subtítulo azul para código (como link visual)
      if (dataCell.section === "body" && dataCell.column.index === 0) {
        pdf.setTextColor(SPARTAN_BLUE);
      } else {
        pdf.setTextColor(20);
      }
    },
  });

  cursorY = (pdf as any).lastAutoTable.finalY + 2;

  // Subtotales (alineados a la derecha en dos columnas)
  const rightX = pageWidth - marginX;
  const labelX = rightX - 52;
  const valueX = rightX;

  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(40);
  pdf.setFontSize(10);

  cursorY += 6;
  pdf.text("Subtotal", labelX, cursorY, { align: "right" });
  pdf.text(moneyCL(data.subtotal), valueX, cursorY, { align: "right" });

  cursorY += 6;
  pdf.text("IVA 19 %", labelX, cursorY, { align: "right" });
  pdf.text(moneyCL(data.iva), valueX, cursorY, { align: "right" });

  pdf.setDrawColor(LIGHT_BORDER);
  pdf.setLineWidth(0.4);
  pdf.line(labelX - 2, cursorY + 2, valueX, cursorY + 2);

  cursorY += 8;
  pdf.setFont("helvetica", "bold");
  pdf.text("Total Neto + IVA", labelX, cursorY, { align: "right" });
  pdf.text(moneyCL(data.total), valueX, cursorY, { align: "right" });

  // Caja alrededor de totales (ligera)
  pdf.setDrawColor(LIGHT_BORDER);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(labelX - 56, (pdf as any).lastAutoTable.finalY + 4, 58, cursorY - ((pdf as any).lastAutoTable.finalY + 4) + 4, 2, 2);

  cursorY += 10;

  // ===== CONDICIONES (viñetas) =====
  pdf.setTextColor(0);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);

  const bullets: string[] = [
    `Mínimo de despacho: $50.000.`,
    `Término: ${data.entrega || "A convenir"}.`,
    `Vigencia: ${data.validez || "10 días"}.`,
    `Forma de pago: ${data.formaPago || "Contado - Transferencia"}.`,
  ];
  if (data.observaciones) bullets.push(data.observaciones);

  const bulletX = marginX + 2;
  bullets.forEach((t) => {
    pdf.circle(bulletX - 2.2, cursorY - 2.2, 0.6, "F");
    pdf.text(t, bulletX, cursorY);
    cursorY += 6;
  });

  // Texto institucional
  cursorY += 2;
  pdf.setTextColor(90);
  pdf.setFontSize(9);
  const parrafo =
    "Spartan de Chile Ltda. presta asesoría técnica permanente, sin costo para el cliente, " +
    "en el uso de su amplia gama de productos, solucionando cualquier duda o dificultad en su aplicación.";
  // Wrap manual
  const maxWidth = pageWidth / 2 - 8;
  const lines = pdf.splitTextToSize(parrafo, maxWidth);
  pdf.text(lines, marginX, cursorY);

  // ===== FIRMA (derecha) =====
  const firmaTopY = cursorY;
  let firmaX = pageWidth - marginX;
  let firmaY = firmaTopY;

  pdf.setTextColor(0);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text("Atentamente,", firmaX, firmaY, { align: "right" });
  firmaY += 6;

  pdf.setFont("helvetica", "bold");
  pdf.text(data.ejecutivo.nombre || "Ejecutivo de Ventas", firmaX, firmaY, { align: "right" });
  firmaY += 5;

  pdf.setFont("helvetica", "normal");
  pdf.text("SPARTAN DE CHILE LTDA.", firmaX, firmaY, { align: "right" });
  firmaY += 5;

  const cargo = data.ejecutivo.cargo || "Ejecutivo Comercial";
  pdf.text(cargo, firmaX, firmaY, { align: "right" });
  firmaY += 5;

  if (data.ejecutivo.celular) {
    pdf.text(`Cel.: ${data.ejecutivo.celular}`, firmaX, firmaY, { align: "right" });
    firmaY += 5;
  }
  if (data.ejecutivo.correo) {
    pdf.text(`${data.ejecutivo.correo}`, firmaX, firmaY, { align: "right" });
    firmaY += 5;
  }

  // ===== FOOTER BARRA AZUL (opcional, como el ejemplo) =====
  const footerH = 12;
  pdf.setFillColor(SPARTAN_BLUE);
  pdf.rect(0, 297 - footerH, pageWidth, footerH, "F");
  pdf.setTextColor("#FFFFFF");
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text("Ficha / cotización", pageWidth / 2, 297 - footerH / 2 + 2, { align: "center" });

  // ===== OUTPUT =====
  const filename = `Cotizacion_${data.numeroCTZ}.pdf`;
  const base64 = pdf.output("datauristring").split(",")[1];

  return { filename, base64 };
}
