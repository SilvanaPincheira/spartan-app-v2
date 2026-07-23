"use client";

import React, { useEffect, useMemo, useState } from "react";

type PrecioPorVencer = {
  codigoSN: string;
  nombreSN: string;
  articulo: string;
  descripcion: string;
  precioEspecial: number;
  precioLista: number;
  fechaVencimiento: string;
  diasRestantes: number;
  ejecutivo: string;
};

function money(value: number) {
  return Number(value || 0).toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 2,
  });
}

export default function VencimientosPreciosEspecialesPage() {
  const [registros, setRegistros] = useState<PrecioPorVencer[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setCargando(true);
        setError("");

        const res = await fetch(
          "/api/precios-especiales/vencimientos",
          {
            cache: "no-store",
          }
        );

        const json = await res.json();

        if (!res.ok || !json.ok) {
          throw new Error(
            json?.error ||
              "No se pudieron cargar los vencimientos"
          );
        }

        setRegistros(json.data || []);
      } catch (err: any) {
        console.error(
          "Error cargando vencimientos:",
          err
        );

        setError(
          err?.message ||
            "No se pudieron cargar los vencimientos"
        );
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  const resumen = useMemo(() => {
    const hasta30 = registros.filter(
      (r) => r.diasRestantes <= 30
    ).length;

    const entre31y60 = registros.filter(
      (r) =>
        r.diasRestantes > 30 &&
        r.diasRestantes <= 60
    ).length;

    return {
      total: registros.length,
      hasta30,
      entre31y60,
    };
  }, [registros]);

  return (
    <main className="min-h-screen bg-zinc-50 p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-[#2B6CFF]">
            Precios especiales próximos a vencer
          </h1>

          <p className="mt-1 text-sm text-zinc-600">
            Se muestran los precios especiales asociados al
            ejecutivo logueado que vencen dentro de los
            próximos 60 días.
          </p>
        </header>

        {error && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {cargando ? (
          <div className="rounded bg-white p-6 shadow">
            Cargando vencimientos...
          </div>
        ) : (
          <>
            <section className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded bg-white p-4 shadow">
                <div className="text-sm text-zinc-500">
                  Total próximos a vencer
                </div>

                <div className="mt-1 text-3xl font-bold text-zinc-800">
                  {resumen.total}
                </div>
              </div>

              <div className="rounded border border-red-200 bg-red-50 p-4 shadow">
                <div className="text-sm text-red-700">
                  Vencen en 30 días o menos
                </div>

                <div className="mt-1 text-3xl font-bold text-red-700">
                  {resumen.hasta30}
                </div>
              </div>

              <div className="rounded border border-amber-200 bg-amber-50 p-4 shadow">
                <div className="text-sm text-amber-700">
                  Vencen entre 31 y 60 días
                </div>

                <div className="mt-1 text-3xl font-bold text-amber-700">
                  {resumen.entre31y60}
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded bg-white shadow">
              {registros.length === 0 ? (
                <div className="p-8 text-center text-zinc-500">
                  No tienes precios especiales que venzan
                  durante los próximos 60 días.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-zinc-100">
                      <tr>
                        <th className="px-3 py-2 text-left">
                          Cliente
                        </th>

                        <th className="px-3 py-2 text-left">
                          Código SN
                        </th>

                        <th className="px-3 py-2 text-left">
                          Artículo
                        </th>

                        <th className="px-3 py-2 text-left">
                          Descripción
                        </th>

                        <th className="px-3 py-2 text-right">
                          Precio especial
                        </th>

                        <th className="px-3 py-2 text-right">
                          Precio lista
                        </th>

                        <th className="px-3 py-2 text-center">
                          Vencimiento
                        </th>

                        <th className="px-3 py-2 text-center">
                          Días restantes
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {registros.map((registro) => {
                        const urgente =
                          registro.diasRestantes <= 30;

                        return (
                          <tr
                            key={`${registro.codigoSN}-${registro.articulo}-${registro.fechaVencimiento}`}
                            className="border-t"
                          >
                            <td className="px-3 py-2">
                              {registro.nombreSN}
                            </td>

                            <td className="px-3 py-2">
                              {registro.codigoSN}
                            </td>

                            <td className="px-3 py-2">
                              {registro.articulo}
                            </td>

                            <td className="px-3 py-2">
                              {registro.descripcion}
                            </td>

                            <td className="px-3 py-2 text-right">
                              {money(
                                registro.precioEspecial
                              )}
                            </td>

                            <td className="px-3 py-2 text-right">
                              {money(registro.precioLista)}
                            </td>

                            <td className="px-3 py-2 text-center">
                              {registro.fechaVencimiento}
                            </td>

                            <td className="px-3 py-2 text-center">
                              <span
                                className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                                  urgente
                                    ? "bg-red-100 text-red-700"
                                    : "bg-amber-100 text-amber-700"
                                }`}
                              >
                                {registro.diasRestantes} días
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}