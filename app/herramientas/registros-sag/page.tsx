"use client";

export default function RegistroSAGPage() {
  return (
    <div className="p-6 min-h-screen bg-zinc-50">
      <h1 className="text-2xl font-bold text-indigo-700 mb-4">
        🧾 Registro SAG – Spartan
      </h1>
      <p className="text-gray-600 text-sm mb-6">
        Consulta los registros de productos Spartan autorizados por el Servicio
        Agrícola y Ganadero (SAG) para su uso en distintas aplicaciones.
      </p>

      <div className="w-full h-[85vh] rounded-xl overflow-hidden shadow-lg border">
        <iframe
          src="https://drive.google.com/embeddedfolderview?id=1MGQBlDLpS8VmbIFGq_WseKGwRPxVnJTA#grid"
          className="w-full h-full"
          allowFullScreen
        />
      </div>
    </div>
  );
}
