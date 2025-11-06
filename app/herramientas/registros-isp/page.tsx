"use client";

export default function RegistroISPPage() {
  return (
    <div className="p-6 min-h-screen bg-zinc-50">
      <h1 className="text-2xl font-bold text-indigo-700 mb-4">
        🧾 Registro ISP – Spartan
      </h1>
      <p className="text-gray-600 text-sm mb-6">
        Consulta los registros oficiales de productos Spartan certificados ante
        el Instituto de Salud Pública (ISP).
      </p>

      <div className="w-full h-[85vh] rounded-xl overflow-hidden shadow-lg border">
        <iframe
          src="https://drive.google.com/embeddedfolderview?id=1fOMikRmyQW1pRJ30Q6CZ7UXqzMCamh8q#grid"
          className="w-full h-full"
          allowFullScreen
        />
      </div>
    </div>
  );
}
