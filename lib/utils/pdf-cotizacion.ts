// /lib/utils/pdf-cotizacion.ts
import jsPDF from "jspdf";

export function generarPdfCotizacion(data: {
  numero: string;
  fecha: string;
  ciudad?: string;
  cliente: {
    nombre: string;
    rut?: string;
    direccion?: string;
    comuna?: string;
    contacto?: string;
    email?: string;
  };
  productos: {
    codigo: string;
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    total: number;
  }[];
  validez?: string;
  formaPago?: string;
  entrega?: string;
  observaciones?: string;
  subtotal?: number;
  iva?: number;
  total?: number;
  ejecutivo: {
    nombre: string;
    correo: string;
    celular: string;
    cargo: string;
  };
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const azulSpartan = "#2B6CFF";
  const startX = 20;
  let y = 25;

  /* =========================================================
     ENCABEZADO SPARTAN
  ========================================================= */
  const logoUrl =
    "https://images.jumpseller.com/store/spartan-de-chile/store/logo/Spartan_Logo_-_copia.jpg?0";

  doc.addImage(logoUrl, "JPEG", 20, 12, 35, 12);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text("SPARTAN DE CHILE LTDA.", 20, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("RUT: 76.883.980-7", 20, y);
  y += 4;
  doc.text("Cerro Sarita Lucía #9873 – Quilicura – Santiago", 20, y);
  y += 4;
  doc.setTextColor(azulSpartan);
  doc.text("Teléfono: 2 2738 5150 – ventas@spartan.cl", 20, y);
  doc.setTextColor(0, 0, 0);

  // Fecha + número cotización
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(azulSpartan);
  doc.text(`COTIZACIÓN Nº ${data.numero}`, 150, 25);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`${data.ciudad || "Santiago"}, ${data.fecha}`, 150, 30, {
    align: "right",
  });

  y += 10;

  /* =========================================================
     DATOS DEL CLIENTE
  ========================================================= */
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  doc.text("Señores", startX, y);
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.text(`${data.cliente.nombre || ""}`, startX, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  if (data.cliente.email) {
    doc.setTextColor(azulSpartan);
    doc.text(`${data.cliente.email}`, startX, y);
    doc.setTextColor(0, 0, 0);
    y += 6;
  }

  if (data.cliente.rut) {
    doc.text(`RUT: ${data.cliente.rut}`, startX, y);
    y += 4;
  }
  if (data.cliente.direccion) {
    doc.text(`Dirección: ${data.cliente.direccion}`, startX, y);
    y += 4;
  }
  if (data.cliente.comuna) {
    doc.text(`Comuna: ${data.cliente.comuna}`, startX, y);
    y += 4;
  }

  y += 4;

  /* =========================================================
     INTRODUCCIÓN
  ========================================================= */
  const textoIntro =
    "De acuerdo a lo solicitado, tenemos el agrado de cotizar algunos de los productos que Spartan de Chile Ltda., fabrica y distribuye en el país, y/o maquinaria / accesorios de limpieza industrial.";
  const splitIntro = doc.splitTextToSize(textoIntro, 170);
  doc.text(splitIntro, startX, y);
  y += splitIntro.length * 4 + 6;

  /* =========================================================
     TABLA DE PRODUCTOS
  ========================================================= */
  const tableTop = y;
  const colX = [20, 55, 130, 165];
  const colW = [35, 75, 35, 30];

  // Encabezado
  doc.setFillColor(43, 108, 255);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.rect(20, tableTop, 175, 8, "F");
  doc.text("CÓDIGO", colX[0] + 1, tableTop + 5);
  doc.text("PRODUCTO / DESCRIPCIÓN", colX[1] + 1, tableTop + 5);
  doc.text("CANTIDAD", colX[2] + 1, tableTop + 5);
  doc.text("PRECIO UNITARIO", colX[3], tableTop + 5, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);

  y = tableTop + 10;

  for (const p of data.productos) {
    if (y > 260) {
      doc.addPage();
      y = 20;
    }

    doc.text(p.codigo || "", colX[0] + 1, y);
    const desc = doc.splitTextToSize(p.descripcion || "", 70);
    doc.text(desc, colX[1] + 1, y);

    doc.text(`${p.cantidad} unidad`, colX[2] + 5, y);
    const precio = (p.precioUnitario || 0).toLocaleString("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    });
    doc.text(precio, colX[3] + 5, y, { align: "right" });

    y += desc.length * 4 + 2;
  }

  y += 8;

  /* =========================================================
     CONDICIONES / PIE DE PÁGINA
  ========================================================= */
  const condiciones = [
    "Estos precios son unitarios netos y no incluyen I.V.A.",
    "Despacho mínimo: $50.000 + IVA, puesto en sus bodegas Región Metropolitana. Cualquier pedido menor a este monto debe pagar despacho de $19.900 + IVA.",
    "Plazo de entrega: Primera quincena de Diciembre (Máquinas marca Keeper).",
    "Validez cotización: 10 días.",
    "Forma de pago: Contado – Transferencia.",
  ];

  for (const linea of condiciones) {
    const split = doc.splitTextToSize(linea, 175);
    doc.text(split, startX, y);
    y += split.length * 4;
  }

  y += 6;
  const textoSpartan =
    "Spartan de Chile Ltda., presta asesoría técnica permanente, sin costo para el cliente, en el uso de su amplia gama de productos, solucionando cualquier duda o dificultad en su aplicación.";
  const splitSpartan = doc.splitTextToSize(textoSpartan, 175);
  doc.text(splitSpartan, startX, y);
  y += splitSpartan.length * 4 + 6;

  doc.text(
    "Sin otro particular, les saluda muy atentamente,",
    startX,
    y
  );
  y += 10;

  /* =========================================================
     FIRMA EJECUTIVO
  ========================================================= */
  doc.setFont("helvetica", "bold");
  doc.text(data.ejecutivo.nombre, startX, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.text("SPARTAN DE CHILE LTDA.", startX, y);
  y += 4;
  doc.text(`Cel.: ${data.ejecutivo.celular}`, startX, y);
  y += 4;
  doc.text(`E-mail: ${data.ejecutivo.correo}`, startX, y);
  y += 10;

  /* =========================================================
     PIE AZUL INSTITUCIONAL
  ========================================================= */
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFillColor(43, 108, 255);
  doc.rect(0, pageHeight - 12, 210, 12, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text("Ficha / cotización", 105, pageHeight - 4, { align: "center" });

  /* =========================================================
     SALIDA
  ========================================================= */
  const filename = `Cotizacion_${data.numero}.pdf`;
  const base64 = btoa(
    new Uint8Array(doc.output("arraybuffer"))
      .reduce((acc, byte) => acc + String.fromCharCode(byte), "")
  );

  return { base64, filename };
}
