"use client";

export default function NuevoClientePage() {
  return (
    <div className="flex h-[calc(100vh-64px)] w-full flex-col bg-gray-100">
      <div className="border-b bg-white px-6 py-4">
        <h1 className="text-xl font-semibold text-gray-800">
          Nuevo cliente
        </h1>

        <p className="text-sm text-gray-500">
          Creación y registro de clientes
        </p>
      </div>

      <div className="min-h-0 flex-1 p-3">
        <iframe
          //src="https://app.spartan.cl/SpartanVentas/clientescrm/nuevo_cliente.html"//
          title="Nuevo cliente"
          className="h-full w-full rounded-lg border-0 bg-white shadow-sm"
          allow="clipboard-read; clipboard-write"
        />
      </div>
    </div>
  );
}