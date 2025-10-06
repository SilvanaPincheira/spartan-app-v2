import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Genera el PDF profesional de cotización Spartan de Chile.
 * Incluye encabezado con logo, introducción, tabla con totales y firma del ejecutivo.
 */
export function generarPdfCotizacion(data: {
  numero: string;
  fecha: string;
  cliente: {
    nombre: string;
    email?: string;
    rut?: string;
    direccion?: string;
    comuna?: string;
  };
  productos: {
    codigo: string;
    descripcion: string;
    cantidad: number;
    kilos?: number;
    precioVenta: number;
  }[];
  condiciones?: string;
  ejecutivo: {
    nombre: string;
    telefono: string;
    celular: string;
    email: string;
  };
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const azul = "#0033A0"; // color corporativo Spartan
  const gris = "#555";
  const startX = 20;
  let y = 20;

  // === ENCABEZADO ===
  const logoUrl =
    "https://images.jumpseller.com/store/spartan-de-chile/store/logo/Spartan_Logo_-_copia.jpg?0";
  doc.addImage(logoUrl, "JPEG", startX, y, 35, 15);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(azul);
  doc.text(`COTIZACIÓN N° ${data.numero}`, 200 - startX, y + 6, { align: "right" });

  doc.setFontSize(9);
  doc.setTextColor(gris);
  doc.text("Santiago, " + data.fecha, 200 - startX, y + 12, { align: "right" });

  y += 25;

  // === DATOS EMPRESA ===
  doc.setFont("helvetica", "bold");
  doc.setTextColor("#000");
  doc.text("SPARTAN DE CHILE LTDA.", startX, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setTextColor("#111");
  doc.text("RUT: 76.883.980-7", startX, y);
  y += 4;
  doc.text("Cerro Sarita Lucia #9873 – Quilicura – Santiago", startX, y);
  y += 4;
  doc.setTextColor(azul);
  doc.text("Teléfono: 227385150", startX, y);
  y += 4;
  doc.text("ventas@spartan.cl", startX, y);
  y += 10;

  // === CLIENTE ===
  doc.setTextColor("#000");
  doc.setFont("helvetica", "bold");
  doc.text("Señores", startX, y);
  y += 5;
  doc.text(data.cliente.nombre?.toUpperCase() || "", startX, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(azul);
  if (data.cliente.email) doc.text(data.cliente.email, startX, y);
  y += 10;

  // === INTRODUCCIÓN ===
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor("#000");
  const intro =
    "De acuerdo a lo solicitado, tenemos el agrado de cotizar algunos de los productos que Spartan de Chile Ltda., fabrica y distribuye en el país, y/o maquinaria / accesorios de limpieza industrial.";
  const splitIntro = doc.splitTextToSize(intro, 170);
  doc.text(splitIntro, startX, y, { align: "justify", maxWidth: 170 });
  y += splitIntro.length * 5 + 8;

  // === TABLA PRODUCTOS ===
  const body = data.productos.map((p) => {
    const precioPresentacion = p.precioVenta * (p.kilos || 1);
    const totalNeto = precioPresentacion * (p.cantidad || 1);

    return [
      p.codigo,
      p.descripcion,
      `${p.cantidad} unidad${p.cantidad > 1 ? "es" : ""}`,
      precioPresentacion.toLocaleString("es-CL", {
        style: "currency",
        currency: "CLP",
        maximumFractionDigits: 0,
      }),
      totalNeto.toLocaleString("es-CL", {
        style: "currency",
        currency: "CLP",
        maximumFractionDigits: 0,
      }),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [
      [
        "CÓDIGO",
        "PRODUCTO / DESCRIPCIÓN",
        "CANTIDAD SOLICITADA",
        "PRECIO PRESENTACIÓN",
        "PRECIO TOTAL NETO",
      ],
    ],
    body,
    styles: { fontSize: 9, valign: "middle", textColor: "#000" },
    headStyles: { fillColor: azul, textColor: "#fff", halign: "center", fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 75 },
      2: { cellWidth: 30, halign: "center" },
      3: { cellWidth: 30, halign: "right" },
      4: { cellWidth: 30, halign: "right" },
    },
    margin: { left: startX, right: startX },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // === TOTAL GENERAL ===
  const totalGeneral = data.productos.reduce((sum, p) => {
    const precioPres = p.precioVenta * (p.kilos || 1);
    return sum + precioPres * (p.cantidad || 1);
  }, 0);

  doc.setFont("helvetica", "bold");
  doc.text(
    `Total Neto Cotización: ${totalGeneral.toLocaleString("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    })}`,
    200 - startX,
    y,
    { align: "right" }
  );
  y += 10;

  // === CONDICIONES COMERCIALES ===
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor("#000");
  doc.text("CONDICIONES COMERCIALES:", startX, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  const condiciones = data.condiciones?.trim()
    ? data.condiciones
    : `Estos precios son unitarios netos y no incluyen I.V.A.
Despacho Mínimo: $50.000 + IVA, puesto en sus bodegas Región Metropolitana.
Cualquier pedido menor a este monto debe pagar despacho de $19.900 + IVA.
Plazo de entrega: Primera quincena de Diciembre (Máquinas marca Keeper).
Validez cotización: 10 días.
Forma de Pago: Contado - Transferencia.`;

  const splitCond = doc.splitTextToSize(condiciones.trim(), 170);
  doc.text(splitCond, startX, y);
  y += splitCond.length * 5 + 10;

  // === PIE DE ASESORÍA ===
  doc.setFont("helvetica", "bold");
  doc.text("Spartan de Chile Ltda.,", startX, y);
  doc.setFont("helvetica", "normal");
  doc.text(
    "presta asesoría técnica permanente, sin costo para el cliente, en el uso de su amplia gama de productos, solucionando cualquier duda o dificultad en su aplicación.",
    startX,
    y + 5,
    { maxWidth: 170 }
  );
  y += 22;

  // === FIRMA ===
  doc.setFont("helvetica", "normal");
  doc.text("Sin otro particular, le saluda muy atentamente,", startX, y);
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.text(data.ejecutivo.nombre, startX, y);
  y += 4;

  doc.setFont("helvetica", "bold");
  doc.text("SPARTAN DE CHILE LTDA.", startX, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.text(`Fono: ${data.ejecutivo.telefono}`, startX, y);
  y += 4;
  doc.text(`Cel.: ${data.ejecutivo.celular}`, startX, y);
  y += 4;
  doc.text(`E-mail: ${data.ejecutivo.email}`, startX, y);
  y += 10;

  // === RETORNAR PDF ===
  const filename = `Cotizacion_${data.numero}.pdf`;
  const base64 = doc.output("datauristring").split(",")[1];
  return { base64, filename };
}
