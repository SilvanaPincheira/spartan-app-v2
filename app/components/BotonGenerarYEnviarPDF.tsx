"use client";

import { useState } from "react";
import { generarPdfNotaVenta, NotaVentaPdf } from "@/lib/utils/pdf-notaventa";

type Props = {
  nota: NotaVentaPdf;
  destinatarios: string[];
};

export default function BotonGenerarYEnviarPDF({ nota, destinatarios }: Props) {
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const handleClick = async () => {
    try {
      setProcesando(true);
      setMensaje("Generando PDF...");

      const { base64, filename } = generarPdfNotaVenta(nota);

      setMensaje("Enviando correo...");

      const res = await fetch("/api/send-notaventa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: destinatarios,
          subject: `Nota de Venta ${nota.numeroNV}`,
          message: `<p>Se adjunta la nota de venta ${nota.numeroNV}.</p>`,
          attachment: { filename, content: base64 },
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Error al enviar: ${errorText}`);
      }

      setMensaje("✅ PDF enviado por correo.");
    } catch (err: any) {
      console.error(err);
      setMensaje(`❌ Error: ${err.message}`);
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div style={{ marginTop: "1rem" }}>
      <button onClick={handleClick} disabled={procesando}>
        {procesando ? "Procesando..." : "📤 Generar y enviar PDF"}
      </button>
      {mensaje && <p>{mensaje}</p>}
    </div>
  );
}
