"use client";
import React from "react";

export default function ContratoComodatoPage() {
  const driveUrl =
    "https://docs.google.com/document/d/1yqJK91XjyRl2273iDzRkgccVZ0ccacYi/edit";
  const pdfUrl =
    "https://docs.google.com/document/d/1yqJK91XjyRl2273iDzRkgccVZ0ccacYi/export?format=pdf";

  const descargarPdf = async () => {
    try {
      const res = await fetch(pdfUrl);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Contrato_Comodato_Spartan.pdf";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert("No se pudo descargar el contrato.");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 p-6">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-[#1f4ed8]">
          📄 Contrato de Comodato — Borrador
        </h1>
        <button
          onClick={descargarPdf}
          className="rounded bg-[#1f4ed8] px-3 py-2 text-white hover:bg-[#173db1]"
        >
          Descargar PDF
        </button>
      </header>

      <iframe
        src={`${driveUrl}?embedded=true`}
        width="100%"
        height="900"
        style={{ border: "1px solid #ddd", borderRadius: "12px" }}
        allowFullScreen
      ></iframe>
    </div>
  );
}
