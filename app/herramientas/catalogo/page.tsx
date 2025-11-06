"use client";

export default function CatalogoPage() {
  return (
    <div className="p-6 min-h-screen bg-zinc-50">
      <h1 className="text-2xl font-bold text-blue-700 mb-3">
        📘 Catálogo de Productos Spartan
      </h1>
      <p className="text-gray-600 text-sm mb-6">
        Consulta el catálogo oficial de productos Spartan de Chile, actualizado.
      </p>

      <div className="w-full h-[85vh] rounded-xl overflow-hidden shadow-lg border">
        <iframe
          src="https://drive.google.com/file/d/11-W3OEupOvBx0FJWJyacO37Vmnux7vJh/preview"
          className="w-full h-full"
          allow="autoplay"
        />
      </div>
    </div>
  );
}

  