import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { logoBase64 } from "../logo64";

export type EquipoRetiroPdf = {
  codigo: string;
  descripcion: string;
  cantidad: number;
  valor: number;
  valorTotal: number;
};

export type SolicitudRetiroPdf = {
  fechaSolicitud: string;    // yyyy-mm-dd
  fechaRetiro: string;       // yyyy-mm-dd
  motivo: string;
  contacto: string;
  comentarios: string;

  cliente: {
    rut: string;             // sin puntos, con guión o como lo tengas
    codigo: string;
    nombre: string;
    direccion: string;
    ejecutivo: string;
  };

  equipos: EquipoRetiroPdf[];
  subtotal: number;
};

function money(n: number) {
  return (n || 0).toLocaleString("es-CL", { style: "currency", currency: "CLP" });
}

export function generarPdfSolicitudRetiro(data: SolicitudRetiroPdf): { base64: string; filename: string } {
  const doc = new jsPDF();
  const W = doc.internal.pageSize.getWidth();

  // Logo
  try { doc.addImage(logoBase64, "JPEG", 14, 10, 25, 25); } catch {}

  // Título centrado
  doc.setFontSize(16);
  doc.text("Solicitud de Retiro de Equipos", W / 2, 20, { align: "center" });

  // Datos a la derecha
  doc.setFontSize(10);
  doc.text(`Fecha sol.: ${data.fechaSolicitud}`, W - 14, 16, { align: "right" });
  doc.text(`Fecha retiro: ${data.fechaRetiro}`, W - 14, 22, { align: "right" });

  // ===== Cliente =====
  let y = 40;
  doc.setFontSize(12);
  doc.text("Datos del Cliente", 14, y);
  y += 4;

  const boxX = 14;
  const boxW = W - 28;
  let contentY = y + 8;

  doc.setFontSize(10);
  doc.text(`Nombre: ${data.cliente.nombre}`, boxX + 4, contentY); contentY += 6;
  doc.text(`RUT: ${data.cliente.rut}`, boxX + 4, contentY);       contentY += 6;
  doc.text(`Código: ${data.cliente.codigo}`, boxX + 4, contentY);  contentY += 6;
  doc.text(`Ejecutivo: ${data.cliente.ejecutivo}`, boxX + 4, contentY); contentY += 6;

  // Dirección con wrap
  const dirLines = doc.splitTextToSize(`Dirección (despacho): ${data.cliente.direccion || "—"}`, boxW - 8);
  doc.text(dirLines, boxX + 4, contentY); 
  contentY += dirLines.length * 6;

  const boxH = contentY - (y + 2) + 4;
  doc.setDrawColor(0);
  doc.rect(boxX, y + 2, boxW, boxH);

  // ===== Motivo / Contacto =====
  y = contentY + 10;
  doc.setFontSize(12);
  doc.text("Datos del Retiro", 14, y);
  y += 6;

  doc.setFontSize(10);
  doc.text(`Motivo: ${data.motivo}`, 14, y); 
  doc.text(`Contacto: ${data.contacto || "—"}`, W / 2, y);
  y += 8;

  // ===== Equipos =====
  autoTable(doc, {
    startY: y,
    head: [["Código", "Descripción", "Cant.", "Valor", "Total"]],
    body: data.equipos.map(e => [
      e.codigo,
      e.descripcion,
      String(e.cantidad),
      money(e.valor),
      money(e.valorTotal),
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [43, 108, 255], textColor: 255, halign: "center" },
    columnStyles: {
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || y + 10;

  // Total
  doc.setFontSize(12);
  doc.setTextColor(200, 0, 0);
  doc.text(`TOTAL: ${money(data.subtotal)}`, W - 14, finalY + 10, { align: "right" });
  doc.setTextColor(0, 0, 0);

  // Comentarios
  doc.setFontSize(12);
  doc.text("Comentarios", 14, finalY + 20);
  doc.setFontSize(10);
  const comLines = doc.splitTextToSize(data.comentarios || "—", W - 28);
  doc.text(comLines, 14, finalY + 26);

  const base64 = doc.output("datauristring").split(",")[1];
  const filename = `Solicitud_Retiro_${(data.cliente.rut || "cliente")}_${data.fechaSolicitud}.pdf`;

  return { base64, filename };
}
