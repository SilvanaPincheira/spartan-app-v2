"use client";

export default function HerramientasProductosPage() {
  return (
    <main className="p-6">
      <h1 className="text-3xl font-bold text-blue-700 mb-4">
        🧰 Productos Spartan – Recursos de Ventas
      </h1>

      <p className="text-gray-600 mb-6">
        Aquí encontrarás toda la documentación técnica, fichas, registros y
        material comercial compartido desde Google Drive. Cualquier cambio se
        refleja automáticamente.
      </p>

      <div className="bg-white rounded-2xl shadow border border-gray-200 overflow-hidden">
        <iframe
          src="https://drive.google.com/drive/folders/1Bv5yu08GDu9FAbxSEtA10Xzb-0MT3iyF?usp=sharing"
          style={{
            width: "100%",
            height: "85vh",
            border: "0",
          }}
        ></iframe>
      </div>
    </main>
  );
}
