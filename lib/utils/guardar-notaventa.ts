export async function guardarPdfYEnviarSinEstado({
    numeroNV,
    clientName,
    clientRut,
    clientCode,
    ejecutivo,
    direccion,
    direccionNueva,
    comuna,
    emailEjecutivo,
    comentarios,
    lines,
  }: any): Promise<{ ok: boolean; message: string }> {
    try {
      const subtotal = lines.reduce((a: number, r: any) => a + (Number.isFinite(r.total) ? r.total : 0), 0);
  
      if (!clientName || !clientRut || !clientCode)
        throw new Error("Faltan datos del cliente (Nombre, RUT y Código Cliente).");
      if (lines.length === 0) throw new Error("Agrega al menos un ítem antes de guardar.");
      if (lines.some((l: any) => l.isBloqueado))
        throw new Error("No puedes guardar: hay precios especiales vencidos en la tabla.");
  
      // Guardar en Google Sheets
      const fecha = new Date().toLocaleDateString("es-CL");
      const payload = lines.map((item: any) => ({
        numeroNV,
        fecha,
        cliente: clientName,
        rut: clientRut,
        codigoCliente: clientCode,
        ejecutivo,
        direccionDespacho: direccion,
        direccionNueva,
        comuna,
        correoEjecutivo: emailEjecutivo,
        comentarios,
        subtotal,
        total: subtotal,
        codigo: item.code,
        descripcion: item.name,
        kilos: item.kilos,
        cantidad: item.qty,
        precioBase: Math.round(item.priceBase || 0),
        descuento: item.isEspecial ? 0 : item.descuento,
        precioVenta: Math.round(item.precioVenta || 0),
        precioPresentacion: Math.round((item.precioVenta || 0) * (item.kilos || 1)),
        totalItem: Math.round(item.total || 0),
        especialVigente: !!item.isEspecial,
        especialBloqueado: !!item.isBloqueado,
      }));
  
      const resSave = await fetch("/api/save-to-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
  
      if (!resSave.ok) throw new Error("Error al guardar en Google Sheets.");
      await resSave.json();
  
      // Generar PDF (importa tu util)
      const { generarPdfNotaVenta } = await import("./pdf-notaventa");
      const { filename, base64 } = generarPdfNotaVenta({
        numeroNV,
        fecha,
        cliente: { nombre: clientName, rut: clientRut, codigo: clientCode, ejecutivo, direccion, comuna },
        productos: lines,
        comentarios,
      });
  
      // Enviar correo
      const destinatarios = [emailEjecutivo, "silvana.pincheira@spartan.cl"].filter(Boolean);
      const subject = `Nota de Venta ${numeroNV}`;
  
      const resMail = await fetch("/api/send-notaventa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: destinatarios,
          subject,
          message: `<p>Se ha generado la Nota de Venta <b>${numeroNV}</b></p>`,
          attachment: { filename, content: base64 },
        }),
      });
  
      if (!resMail.ok) throw new Error("Error al enviar correo.");
  
      return { ok: true, message: "✅ Nota guardada y correo enviado." };
    } catch (error: any) {
      console.error("❌ Error:", error);
      return { ok: false, message: error?.message || "Error inesperado." };
    }
  }
  