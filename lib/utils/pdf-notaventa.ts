import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Tipos de datos
export type ProductoPdf = {
  codigo: string;
  descripcion: string;
  kilos: number;
  cantidad: number;
  precioBase: number;
  precioVenta: number;
  precioPresentacion: number;
  total: number;
};

export type NotaVentaPdf = {
  numeroNV: string;
  fecha: string;
  cliente: {
    nombre: string;
    rut: string;
    codigo: string;
    ejecutivo: string;
    direccion: string;
    comuna: string;
  };
  productos: ProductoPdf[];
  comentarios: string;
};

// Helper para CLP
function money(n: number): string {
  return n.toLocaleString("es-CL", { style: "currency", currency: "CLP" });
}

// === Generador PDF ===
export function generarPdfNotaVenta(
  data: NotaVentaPdf
): { base64: string; filename: string } {
  const doc = new jsPDF();

  // === Logo (si está en /public/logo.png) ===
  const logo = new Image();
  logo.src = "/logo.png";
  try {
    doc.addImage(logo, "PNG", 14, 10, 25, 25);
  } catch {
    // si no existe el logo, no pasa nada
  }

  // === Encabezado ===
  doc.setFontSize(16);
  doc.text("🧾 Nota de Venta", 50, 20);
  doc.setFontSize(10);
  doc.text(`N°: ${data.numeroNV}`, 200, 20, { align: "right" });
  doc.text(`Fecha: ${data.fecha}`, 200, 26, { align: "right" });

  // === Bloque Cliente ===
  doc.setFontSize(12);
  doc.text("Datos del Cliente", 14, 42);
  doc.setDrawColor(0);
  doc.rect(14, 44, 180, 40); // borde del bloque

  doc.setFontSize(10);
  doc.text(`Nombre: ${data.cliente.nombre}`, 18, 50);
  doc.text(`RUT: ${data.cliente.rut}`, 18, 56);
  doc.text(`Código: ${data.cliente.codigo}`, 18, 62);
  doc.text(`Ejecutivo: ${data.cliente.ejecutivo}`, 18, 68);
  doc.text(`Dirección: ${data.cliente.direccion}`, 18, 74);
  doc.text(`Comuna: ${data.cliente.comuna}`, 18, 80);

  // === Tabla de productos ===
  autoTable(doc, {
    startY: 90,
    head: [
      [
        "Código",
        "Descripción",
        "Kg",
        "Cant",
        "Precio Base",
        "Precio Venta",
        "$ Presentación",
        "Total",
      ],
    ],
    body: data.productos.map((p) => [
      p.codigo,
      p.descripcion,
      p.kilos.toString(),
      p.cantidad.toString(),
      money(p.precioBase),
      money(p.precioVenta),
      money(p.precioPresentacion),
      money(p.total),
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [43, 108, 255], textColor: 255, halign: "center" },
    columnStyles: {
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
    },
  });

  // === Totales destacados ===
  const finalY = (doc as any).lastAutoTable?.finalY || 100;
  const total = data.productos.reduce((acc, p) => acc + p.total, 0);
  doc.setFontSize(12);
  doc.setTextColor(200, 0, 0);
  doc.text(`TOTAL: ${money(total)}`, 200, finalY + 10, { align: "right" });
  doc.setTextColor(0, 0, 0);

  // === Comentarios ===
  doc.setFontSize(12);
  doc.text("Comentarios", 14, finalY + 20);
  doc.setFontSize(10);
  doc.text(data.comentarios || "—", 14, finalY + 26);

  // === Exportar ===
  const base64 = doc.output("datauristring").split(",")[1];
  const filename = `Nota_Venta_${data.numeroNV}.pdf`;

  return { base64, filename };
}
