"use client";

import { useEffect, useMemo, useState } from "react";

type InventarioItem = {
  codigo: string;
  producto: string;
  bodega_produccion: string;
  stock: number;
  venta: number;
  disponible: number;
  stock_por_componentes: boolean;
  actualizado_en: string;
};

export default function InventarioPage() {
  const [inventario, setInventario] = useState<InventarioItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    cargarInventario();
  }, []);

  async function cargarInventario() {
    try {
      setCargando(true);
      setError("");

      const response = await fetch("/api/inventario", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Error cargando inventario");
      }

      setInventario(data.inventario || []);
    } catch (err) {
      console.error("Error cargando inventario:", err);
      setError("No fue posible cargar el inventario.");
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

  const resumen = useMemo(() => {
    const total = inventario.length;

    const conStock = inventario.filter(
      (item) =>
        !item.stock_por_componentes &&
        Number(item.disponible) > 0
    ).length;

    const sinStock = inventario.filter(
      (item) =>
        !item.stock_por_componentes &&
        Number(item.disponible) <= 0
    ).length;

    const porComponentes = inventario.filter(
      (item) => item.stock_por_componentes
    ).length;

    const comprometido = inventario.reduce(
      (total, item) => total + Number(item.venta || 0),
      0
    );

    return {
      total,
      conStock,
      sinStock,
      porComponentes,
      comprometido,
    };
  }, [inventario]);

  const ultimaActualizacion = useMemo(() => {
    if (inventario.length === 0) return null;

    const fechas = inventario
      .map((item) => new Date(item.actualizado_en).getTime())
      .filter((fecha) => !Number.isNaN(fecha));

    if (fechas.length === 0) return null;

    return new Date(Math.max(...fechas));
  }, [inventario]);

  function formatearNumero(valor: number) {
    return Number(valor || 0).toLocaleString("es-CL", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }

  function estadoDisponible(
    disponible: number,
    stockPorComponentes: boolean
  ) {
    if (stockPorComponentes) {
      return {
        texto: "Stock por componentes",
        clase: "bg-blue-50 text-blue-700 border-blue-200",
      };
    }

    const valor = Number(disponible);

    if (valor <= 0) {
      return {
        texto: "Sin stock",
        clase: "bg-red-50 text-red-700 border-red-200",
      };
    }

    if (valor <= 10) {
      return {
        texto: "Stock bajo",
        clase: "bg-amber-50 text-amber-700 border-amber-200",
      };
    }

    return {
      texto: "Disponible",
      clase: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-8">
      {/* ENCABEZADO */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-xl text-white shadow-sm">
              📦
            </div>

            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Inventario
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Disponibilidad de productos en bodega de producción BP02
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {ultimaActualizacion && (
            <div className="text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Última actualización
              </p>

              <p className="text-sm font-semibold text-slate-700">
                {ultimaActualizacion.toLocaleString("es-CL", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          )}

          <button
            onClick={cargarInventario}
            disabled={cargando}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            {cargando ? "Actualizando..." : "↻ Actualizar"}
          </button>
        </div>
      </div>

      {/* TARJETAS */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">
              Productos
            </p>

            <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-sm">
              📦
            </span>
          </div>

          <p className="mt-3 text-3xl font-bold text-slate-900">
            {resumen.total.toLocaleString("es-CL")}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Productos activos
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">
              Con disponibilidad
            </p>

            <span className="rounded-lg bg-emerald-50 px-2.5 py-1">
              ✓
            </span>
          </div>

          <p className="mt-3 text-3xl font-bold text-emerald-600">
            {resumen.conStock.toLocaleString("es-CL")}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Productos con stock propio
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">
              Sin disponibilidad
            </p>

            <span className="rounded-lg bg-red-50 px-2.5 py-1">
              !
            </span>
          </div>

          <p className="mt-3 text-3xl font-bold text-red-600">
            {resumen.sinStock.toLocaleString("es-CL")}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            No incluye productos por componentes
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">
              Venta comprometida
            </p>

            <span className="rounded-lg bg-violet-50 px-2.5 py-1">
              🛒
            </span>
          </div>

          <p className="mt-3 text-3xl font-bold text-violet-600">
            {formatearNumero(resumen.comprometido)}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Unidades comprometidas
          </p>
        </div>
      </div>

      {/* AVISO COMPONENTES */}
      {resumen.porComponentes > 0 && (
        <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-blue-600">ℹ</div>

            <div>
              <p className="text-sm font-semibold text-blue-800">
                {resumen.porComponentes.toLocaleString("es-CL")} productos
                utilizan stock por componentes
              </p>

              <p className="mt-0.5 text-xs text-blue-700">
                Estas presentaciones no mantienen stock propio. Su
                disponibilidad depende del stock de los componentes de su
                receta o conjunto.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* BUSCADOR */}
      <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-lg">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              🔎
            </span>

            <input
              type="text"
              placeholder="Buscar por código o nombre del producto..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-10 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />

            {busqueda && (
              <button
                onClick={() => setBusqueda("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                ×
              </button>
            )}
          </div>

          <div className="text-sm text-slate-500">
            Mostrando{" "}
            <span className="font-semibold text-slate-800">
              {inventarioFiltrado.length.toLocaleString("es-CL")}
            </span>{" "}
            de{" "}
            <span className="font-semibold text-slate-800">
              {inventario.length.toLocaleString("es-CL")}
            </span>{" "}
            productos
          </div>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* TABLA */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="max-h-[calc(100vh-360px)] overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-100">
              <tr className="border-b border-slate-200">
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Código
                </th>

                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Producto
                </th>

                <th className="px-5 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Bodega
                </th>

                <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Stock
                </th>

                <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Venta
                </th>

                <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Disponible
                </th>

                <th className="px-5 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Estado
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {cargando ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-16 text-center text-slate-400"
                  >
                    Cargando inventario...
                  </td>
                </tr>
              ) : inventarioFiltrado.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-16 text-center"
                  >
                    <div className="text-3xl">🔎</div>

                    <p className="mt-2 font-medium text-slate-700">
                      No se encontraron productos
                    </p>

                    <p className="mt-1 text-sm text-slate-400">
                      Intenta buscar con otro código o descripción.
                    </p>
                  </td>
                </tr>
              ) : (
                inventarioFiltrado.map((item) => {
                  const estado = estadoDisponible(
                    item.disponible,
                    item.stock_por_componentes
                  );

                  return (
                    <tr
                      key={item.codigo}
                      className="transition hover:bg-blue-50/40"
                    >
                      <td className="whitespace-nowrap px-5 py-3.5">
                        <span className="font-semibold text-blue-700">
                          {item.codigo}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 font-medium text-slate-700">
                        {item.producto}
                      </td>

                      <td className="px-5 py-3.5 text-center">
                        <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                          {item.bodega_produccion}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-right font-medium text-slate-700">
                        {item.stock_por_componentes
                          ? "—"
                          : formatearNumero(item.stock)}
                      </td>

                      <td className="px-5 py-3.5 text-right text-slate-600">
                        {formatearNumero(item.venta)}
                      </td>

                      <td className="px-5 py-3.5 text-right text-base font-bold text-slate-900">
                        {item.stock_por_componentes
                          ? "—"
                          : formatearNumero(item.disponible)}
                      </td>

                      <td className="px-5 py-3.5 text-center">
                        <span
                          className={`inline-flex min-w-[92px] justify-center rounded-full border px-2.5 py-1 text-xs font-semibold ${estado.clase}`}
                        >
                          {estado.texto}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-3 text-right text-xs text-slate-400">
        Inventario SAP · Bodega BP02
      </div>
    </div>
  );
}