"use client";

import { useState } from "react";

export default function ReclamosPage() {
  const [form, setForm] = useState({
    ejecutivo: "",
    cliente: "",
    correo: "",
    rut: "",
    documento: "",
    producto: "",
    lote: "",
    dosis: "",
    superficie: "",
    tiempoAccion: "",
    aplicacion: "",
    accionMecanica: "",
    herramienta: "",
    residuo: "",
    temperatura: "",
    descripcion: "",
    adjunto: null as File | null, // 👈 nuevo
  });

  const [enviando, setEnviando] = useState(false);
  const [ok, setOk] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setForm((f) => ({ ...f, adjunto: file }));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setOk(false);

    try {
      // === 1️⃣ Generar PDF con jsPDF ===
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "a4" });

      const AZUL: [number, number, number] = [31, 78, 216];
      const GRIS: [number, number, number] = [245, 245, 245];
      const W = doc.internal.pageSize.getWidth();
      const M = 40;
      let y = 60;

      doc.setFillColor(...AZUL);
      doc.rect(0, 0, W, 70, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("Formulario de Reclamos — Spartan", M, 45);

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.setFillColor(...GRIS);
      doc.rect(M, y, W - 2 * M, 26, "F");
      doc.text("Datos del Reclamo", M + 10, y + 18);
      y += 42;

      const writeLine = (label: string, value: string) => {
        if (!value) return;
        const maxWidth = W - 2 * M - 140;
        const lines = doc.splitTextToSize(value, maxWidth);
        const lineHeight = 14 + (lines.length - 1) * 10;
        doc.setFillColor(255, 255, 255);
        doc.rect(M, y - 8, W - 2 * M, lineHeight + 12, "F");
        doc.setFont("helvetica", "bold");
        doc.text(`${label}:`, M + 4, y + 4);
        doc.setFont("helvetica", "normal");
        doc.text(lines, M + 160, y + 4);
        y += lineHeight + 16;
        if (y > 760) {
          doc.addPage();
          y = 60;
        }
      };

      const labelOf: Record<string, string> = {
        ejecutivo: "Ejecutivo de ventas",
        cliente: "Cliente",
        correo: "Correo de contacto",
        rut: "RUT empresa",
        documento: "Factura o guía",
        producto: "Producto",
        lote: "Lote",
        dosis: "Dosis de uso",
        superficie: "Superficie donde se aplica",
        tiempoAccion: "Tiempo de acción",
        aplicacion: "Aplicación",
        accionMecanica: "¿Acción mecánica?",
        herramienta: "Herramienta usada",
        residuo: "Residuo a eliminar",
        temperatura: "Temperatura de solución",
        descripcion: "Descripción del problema",
      };

      const bloque1 = [
        "ejecutivo",
        "cliente",
        "correo",
        "rut",
        "documento",
        "producto",
        "lote",
        "dosis",
        "superficie",
        "tiempoAccion",
      ];
      bloque1.forEach((k) => writeLine(labelOf[k], (form as any)[k]));

      doc.setFillColor(...GRIS);
      doc.rect(M, y, W - 2 * M, 24, "F");
      doc.text("Condiciones de aplicación", M + 10, y + 16);
      y += 36;
      ["aplicacion", "accionMecanica", "herramienta", "residuo", "temperatura"].forEach((k) =>
        writeLine(labelOf[k], (form as any)[k])
      );

      doc.setFillColor(...GRIS);
      doc.rect(M, y, W - 2 * M, 24, "F");
      doc.text("Descripción", M + 10, y + 16);
      y += 36;
      writeLine(labelOf["descripcion"], form.descripcion);

      const pdfBase64 = doc.output("datauristring").split(",")[1];
      const filename = `Reclamo_${(form.cliente || "Cliente").replace(/[^A-Za-z0-9_-]+/g, "_")}.pdf`;

      // === 2️⃣ Guardar en Google Sheets ===
      const saveRes = await fetch("/api/save-reclamo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      // === 3️⃣ Preparar adjuntos ===
      const attachments: { filename: string; content: string }[] = [];
      attachments.push({ filename, content: pdfBase64 });

      if (form.adjunto && form.adjunto instanceof File) {
        const base64Adjunto = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(form.adjunto as Blob); // ✅ ya no da error
        });
        attachments.push({
          filename: form.adjunto.name,
          content: base64Adjunto,
        });
      }
      

      // === 4️⃣ Enviar correo ===
      const emailRes = await fetch("/api/send-reclamo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: `🧾 Nuevo Reclamo — ${form.cliente}`,
          body: "Se ha recibido un nuevo reclamo. Se adjunta PDF con el detalle.",
          to: "alexandra.morales@spartan.cl",
          attachments,
        }),
      });

      const emailData = await emailRes.json();
      if (emailData.success && saveRes.ok) {
        setOk(true);
        setForm({
          ejecutivo: "",
          cliente: "",
          correo: "",
          rut: "",
          documento: "",
          producto: "",
          lote: "",
          dosis: "",
          superficie: "",
          tiempoAccion: "",
          aplicacion: "",
          accionMecanica: "",
          herramienta: "",
          residuo: "",
          temperatura: "",
          descripcion: "",
          adjunto: null,
        });
      } else {
        alert("❌ Error al guardar o enviar correo.");
      }
    } catch (err) {
      console.error("Error en Reclamos:", err);
      alert("❌ Fallo al procesar el reclamo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-4xl p-8 bg-white shadow-sm rounded-2xl mt-8">
        <h1 className="text-2xl font-bold text-[#2B6CFF] mb-4">🧾 Formulario de Reclamos</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            ["ejecutivo", "Ejecutivo de ventas *"],
            ["cliente", "Cliente *"],
            ["correo", "Correo de contacto *"],
            ["rut", "RUT empresa *"],
            ["documento", "Factura o guía *"],
            ["producto", "Producto *"],
            ["lote", "Lote *"],
            ["dosis", "Dosis de uso"],
            ["superficie", "Superficie donde se aplica"],
            ["tiempoAccion", "Tiempo de acción"],
          ].map(([name, label]) => (
            <label key={name} className="block">
              <span className="text-sm font-medium">{label}</span>
              <input
                required={label.includes("*")}
                type={name === "correo" ? "email" : "text"}
                name={name}
                value={(form as any)[name]}
                onChange={handleChange}
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
              />
            </label>
          ))}

          {/* 🗂️ Subir archivo adjunto */}
          <label className="block">
            <span className="text-sm font-medium">Adjuntar archivo (opcional)</span>
            <input
              type="file"
              onChange={handleFileChange}
              className="mt-1 w-full text-sm"
            />
          </label>

          {/* Selects */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label>
              <span className="text-sm font-medium">Aplicación</span>
              <select
                name="aplicacion"
                value={form.aplicacion}
                onChange={handleChange}
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
              >
                <option value="">Seleccione...</option>
                <option>Manual</option>
                <option>Dilutor</option>
              </select>
            </label>

            <label>
              <span className="text-sm font-medium">¿Acción mecánica?</span>
              <select
                name="accionMecanica"
                value={form.accionMecanica}
                onChange={handleChange}
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
              >
                <option value="">Seleccione...</option>
                <option>Sí</option>
                <option>No</option>
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium">Descripción del problema *</span>
            <textarea
              required
              name="descripcion"
              value={form.descripcion}
              onChange={handleChange}
              rows={5}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            />
          </label>

          <button
            disabled={enviando}
            className="rounded bg-[#2B6CFF] px-4 py-2 text-white font-semibold hover:bg-[#1F4ED8] disabled:bg-zinc-400"
          >
            {enviando ? "Enviando..." : "Enviar Reclamo"}
          </button>

          {ok && (
            <p className="text-green-600 text-sm mt-2">
              ✅ Reclamo guardado y enviado correctamente.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
