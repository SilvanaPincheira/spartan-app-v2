"use client";

export default function HojasSeguridadPage() {
  return (
    <div className="p-6 min-h-screen bg-zinc-50">
      <h1 className="text-2xl font-bold text-red-700 mb-4">
        🧯 HDS – Hojas de Seguridad Spartan
      </h1>
      <p className="text-gray-600 text-sm mb-6">
        Consulta aquí las Hojas de Seguridad actualizadas para todos los productos.
      </p>

      <div className="w-full h-[85vh] rounded-xl overflow-hidden shadow-lg border">
        <iframe
          src="https://drive.google.com/embeddedfolderview?id=1HTw3hPpBENo4c-0LfCfPd7QjLjt0VOQU#grid"
          className="w-full h-full"
          allowFullScreen
        />
      </div>
    </div>
  );
}
