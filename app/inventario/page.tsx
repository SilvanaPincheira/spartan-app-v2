"use client";

import { useEffect, useMemo, useState } from "react";

type InventarioItem = {
  codigo: string;
  producto: string;
  bodega_produccion: string;
  stock: number;
  venta: number;
  disponible: number;
  actualizado_en: string;
};

export default function InventarioPage() {
  const [inventario, setInventario] = useState<InventarioItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    cargarInventario();
  }, []);

  async function cargarInventario() {
    try {
      setCargando(true);

      const response = await fetch("/api/inventario", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Error cargando inventario");
      }

      setInventario(data.inventario || []);
    } catch (error) {
      console.error("Error cargando inventario:", error);
    } finally {
      setCargando(false);
    }
  }

  const inventarioFiltrado = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    if (!texto) return inventario;

    return inventario.filter(
      (item) =>
        item.codigo.toLowerCase().includes(texto) ||
        item.producto.toLowerCase().includes(texto)
    );
  }, [inventario, busqueda]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Inventario
        </h1>

        <p className="text-sm text-gray-500 mt-1">
          Stock disponible en bodega de producción BP02
        </p>
      </div>

      <div className="mb-5">
        <input
          type="text"
          placeholder="Buscar por código o producto..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full max-w-md border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="mb-4 text-sm text-gray-600">
        Productos encontrados:{" "}
        <span className="font-semibold">
          {inventarioFiltrado.length}
        </span>
      </div>

      <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">
                Código
              </th>

              <th className="text-left px-4 py-3 font-semibold">
                Producto
              </th>

              <th className="text-center px-4 py-3 font-semibold">
                Bodega
              </th>

              <th className="text-right px-4 py-3 font-semibold">
                Stock
              </th>

              <th className="text-right px-4 py-3 font-semibold">
                Venta
              </th>

              <th className="text-right px-4 py-3 font-semibold">
                Disponible
              </th>
            </tr>
          </thead>

          <tbody>
            {cargando ? (
              <tr>
                <td
                  colSpan={6}
                  className="text-center py-10 text-gray-500"
                >
                  Cargando inventario...
                </td>
              </tr>
            ) : inventarioFiltrado.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="text-center py-10 text-gray-500"
                >
                  No se encontraron productos.
                </td>
              </tr>
            ) : (
              inventarioFiltrado.map((item) => (
                <tr
                  key={item.codigo}
                  className="border-t border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-4 py-3 font-medium">
                    {item.codigo}
                  </td>

                  <td className="px-4 py-3">
                    {item.producto}
                  </td>

                  <td className="px-4 py-3 text-center">
                    {item.bodega_produccion}
                  </td>

                  <td className="px-4 py-3 text-right">
                    {Number(item.stock).toLocaleString("es-CL", {
                      maximumFractionDigits: 2,
                    })}
                  </td>

                  <td className="px-4 py-3 text-right">
                    {Number(item.venta).toLocaleString("es-CL", {
                      maximumFractionDigits: 2,
                    })}
                  </td>

                  <td className="px-4 py-3 text-right font-semibold">
                    {Number(item.disponible).toLocaleString("es-CL", {
                      maximumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}