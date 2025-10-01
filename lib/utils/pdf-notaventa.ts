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

function money(n: number): string {
  return n.toLocaleString("es-CL", { style: "currency", currency: "CLP" });
}

// Función que genera PDF y retorna base64 y filename
export function generarPdfNotaVenta(data: NotaVentaPdf): { base64: string; filename: string } {
  const doc = new jsPDF();

  // Encabezado
  doc.setFontSize(16);
  doc.text("🧾 Nota de Venta", 14, 20);
  doc.setFontSize(10);
  doc.text(`N°: ${data.numeroNV}`, 170, 20, { align: "right" });
  doc.text(`Fecha: ${data.fecha}`, 170, 26, { align: "right" });

  // Cliente
  doc.setFontSize(12);
  doc.text("Cliente", 14, 36);
  doc.setFontSize(10);
  doc.text(`Nombre: ${data.cliente.nombre}`, 14, 42);
  doc.text(`RUT: ${data.cliente.rut}`, 14, 48);
  doc.text(`Código: ${data.cliente.codigo}`, 14, 54);
  doc.text(`Ejecutivo: ${data.cliente.ejecutivo}`, 14, 60);
  doc.text(`Dirección: ${data.cliente.direccion}`, 14, 66);
  doc.text(`Comuna: ${data.cliente.comuna}`, 14, 72);

  // Productos
  autoTable(doc, {
    startY: 80,
    head: [["Código", "Descripción", "Kg", "Cant", "Precio Base", "Precio Venta", "$ Presentación", "Total"]],
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
    headStyles: { fillColor: [43, 108, 255] },
  });

  // Comentarios
  const finalY = (doc as any).lastAutoTable?.finalY || 100;
  doc.setFontSize(12);
  doc.text("Comentarios", 14, finalY + 10);
  doc.setFontSize(10);
  doc.text(data.comentarios || "—", 14, finalY + 16);

  // Exportar como base64
  const base64 = doc.output("datauristring").split(",")[1];
  const filename = `Nota_Venta_${data.numeroNV}.pdf`;

  return { base64, filename };
}
