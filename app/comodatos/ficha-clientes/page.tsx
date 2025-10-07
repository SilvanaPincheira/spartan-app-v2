"use client";
import React from "react";

export default function FichaClientesComodatoPage() {
  const sheetUrl =
    "https://docs.google.com/spreadsheets/d/1aKFz0hXv85KKmxeY2fOEj-3loARRHKdQ/edit?gid=2081762737#gid=2081762737";
  const exportUrl =
    "https://docs.google.com/spreadsheets/d/1aKFz0hXv85KKmxeY2fOEj-3loARRHKdQ/export?format=xlsx&gid=2081762737";

  const descargarExcel = async () => {
    try {
      const res = await fetch(exportUrl);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Ficha_Clientes_Comodato.xlsx";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("No se pudo descargar la ficha.");
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 p-6">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-[#1f4ed8]">
          📘 Ficha Clientes Comodato
        </h1>
        <button
          onClick={descargarExcel}
          className="rounded bg-[#1f4ed8] px-3 py-2 text-white hover:bg-[#173db1]"
        >
          Descargar Excel
        </button>
      </header>

      <iframe
        src={`${sheetUrl}&rm=minimal`}
        width="100%"
        height="850"
        style={{ border: "1px solid #ddd", borderRadius: "12px" }}
      ></iframe>

      <p className="mt-4 text-sm text-zinc-500">
        Esta ficha se actualiza automáticamente desde Google Sheets.
      </p>
    </div>
  );
}
