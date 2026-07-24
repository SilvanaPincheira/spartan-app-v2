"use client";

import { useEffect, useMemo, useState } from "react";

type EstadoPrecio =
  | "VENCIDO"
  | "URGENTE"
  | "PROXIMO";

type PrecioEspecial = {
  codigoSN: string;
  nombreSN: string;
  articulo: string;
  descripcion: string;
  precioEspecial: number;
  precioLista: number;
  fechaVencimiento: string;
  fechaOrden: number;
  diasRestantes: number;
  ejecutivo: string;
  estado: EstadoPrecio;
};

type ApiResponse = {
  ok: boolean;
  error?: string;
  ejecutivo?: string;

  resumen?: {
    total: number;
    proximos30: number;
    proximos60: number;
    vencidos: number;
  };

  data?: PrecioEspecial[];
};

function money(value: number): string {
  return Number(value || 0).toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function textoDias(diasRestantes: number): string {
  if (diasRestantes < 0) {
    const diasVencidos = Math.abs(diasRestantes);

    return diasVencidos === 1
      ? "Vencido hace 1 día"
      : `Vencido hace ${diasVencidos} días`;
  }

  if (diasRestantes === 0) {
    return "Vence hoy";
  }

  if (diasRestantes === 1) {
    return "Falta 1 día";
  }

  return `Faltan ${diasRestantes} días`;
}

function claseEstado(registro: PrecioEspecial): string {
  if (registro.diasRestantes < 0) {
    return "bg-red-100 text-red-700";
  }

  if (registro.diasRestantes <= 30) {
    return "bg-orange-100 text-orange-700";
  }

  return "bg-amber-100 text-amber-700";
}

export default function VencimientosPreciosEspecialesPage() {
  const [registros, setRegistros] = useState<
    PrecioEspecial[]
  >([]);

  const [ejecutivo, setEjecutivo] =
    useState<string>("");

  const [cargando, setCargando] =
    useState<boolean>(true);

  const [error, setError] =
    useState<string>("");

  useEffect(() => {
    async function cargarVencimientos() {
      try {
        setCargando(true);
        setError("");

        const response = await fetch(
          "/api/precios-especiales/vencimientos",
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const json =
          (await response.json()) as ApiResponse;

        if (!response.ok || !json.ok) {
          throw new Error(
            json.error ||
              "No se pudieron cargar los vencimientos"
          );
        }

        setEjecutivo(json.ejecutivo || "");

        setRegistros(
          Array.isArray(json.data)
            ? json.data
            : []
        );
      } catch (err: unknown) {
        console.error(
          "Error cargando vencimientos:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "No se pudieron cargar los vencimientos"
        );
      } finally {
        setCargando(false);
      }
    }

    void cargarVencimientos();
  }, []);

  const resumen = useMemo(() => {
    const vencidos = registros.filter(
      (registro) =>
        registro.diasRestantes < 0
    ).length;

    const hasta30 = registros.filter(
      (registro) =>
        registro.diasRestantes >= 0 &&
        registro.diasRestantes <= 30
    ).length;

    const entre31y60 = registros.filter(
      (registro) =>
        registro.diasRestantes >= 31 &&
        registro.diasRestantes <= 60
    ).length;

    return {
      total: registros.length,
      vencidos,
      hasta30,
      entre31y60,
    };
  }, [registros]);

  const proximos = useMemo(
    () =>
      registros.filter(
        (registro) =>
          registro.diasRestantes >= 0 &&
          registro.diasRestantes <= 60
      ),
    [registros]
  );

  const vencidos = useMemo(
    () =>
      registros.filter(
        (registro) =>
          registro.diasRestantes < 0
      ),
    [registros]
  );

  function renderTabla(
    datos: PrecioEspecial[],
    tipo: "proximos" | "vencidos"
  ) {
    if (datos.length === 0) {
      return (
        <div className="p-8 text-center text-zinc-500">
          {tipo === "proximos"
            ? "No tienes precios especiales que venzan durante los próximos 60 días."
            : "No tienes precios especiales vencidos."}
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-100">
            <tr>
              <th className="px-3 py-3 text-left">
                Cliente
              </th>

              <th className="px-3 py-3 text-left">
                Código SN
              </th>

              <th className="px-3 py-3 text-left">
                Artículo
              </th>

              <th className="px-3 py-3 text-left">
                Descripción
              </th>

              <th className="px-3 py-3 text-right">
                Precio especial
              </th>

              <th className="px-3 py-3 text-right">
                Precio lista
              </th>

              <th className="px-3 py-3 text-center">
                Vencimiento
              </th>

              <th className="px-3 py-3 text-center">
                Estado
              </th>
            </tr>
          </thead>

          <tbody>
            {datos.map((registro, index) => {
              const key = [
                registro.codigoSN,
                registro.articulo,
                registro.fechaVencimiento,
                index,
              ].join("-");

              return (
                <tr
                  key={key}
                  className="border-t bg-white hover:bg-zinc-50"
                >
                  <td className="px-3 py-3">
                    {registro.nombreSN || "—"}
                  </td>

                  <td className="px-3 py-3">
                    {registro.codigoSN || "—"}
                  </td>

                  <td className="px-3 py-3">
                    {registro.articulo || "—"}
                  </td>

                  <td className="px-3 py-3">
                    {registro.descripcion || "—"}
                  </td>

                  <td className="px-3 py-3 text-right">
                    {money(
                      registro.precioEspecial
                    )}
                  </td>

                  <td className="px-3 py-3 text-right">
                    {money(registro.precioLista)}
                  </td>

                  <td className="px-3 py-3 text-center">
                    {registro.fechaVencimiento ||
                      "—"}
                  </td>

                  <td className="px-3 py-3 text-center">
                    <span
                      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${claseEstado(
                        registro
                      )}`}
                    >
                      {textoDias(
                        registro.diasRestantes
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-[#2B6CFF]">
            Alertas de precios especiales
          </h1>

          <p className="mt-1 text-sm text-zinc-600">
            Precios especiales próximos a vencer y
            vencidos asociados al ejecutivo
            conectado.
          </p>

          {ejecutivo && (
            <p className="mt-1 text-xs text-zinc-500">
              Ejecutivo: {ejecutivo}
            </p>
          )}
        </header>

        {error !== "" && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {cargando ? (
          <div className="rounded-lg border bg-white p-6 shadow-sm">
            Cargando alertas de precios...
          </div>
        ) : (
          <>
            <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 shadow-sm">
                <div className="text-sm text-red-700">
                  Precios vencidos
                </div>

                <div className="mt-1 text-3xl font-bold text-red-700">
                  {resumen.vencidos}
                </div>
              </div>

              <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 shadow-sm">
                <div className="text-sm text-orange-700">
                  Vencen en 30 días o menos
                </div>

                <div className="mt-1 text-3xl font-bold text-orange-700">
                  {resumen.hasta30}
                </div>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm">
                <div className="text-sm text-amber-700">
                  Vencen entre 31 y 60 días
                </div>

                <div className="mt-1 text-3xl font-bold text-amber-700">
                  {resumen.entre31y60}
                </div>
              </div>
            </section>

            <section className="mb-7 overflow-hidden rounded-lg border bg-white shadow-sm">
              <div className="border-b bg-white px-4 py-4">
                <h2 className="text-lg font-semibold text-zinc-800">
                  Próximos a vencer
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  Precios especiales que vencen
                  durante los próximos 60 días.
                </p>
              </div>

              {renderTabla(
                proximos,
                "proximos"
              )}
            </section>

            <section className="overflow-hidden rounded-lg border border-red-100 bg-white shadow-sm">
              <div className="border-b border-red-100 bg-red-50 px-4 py-4">
                <h2 className="text-lg font-semibold text-red-700">
                  Precios vencidos
                </h2>

                <p className="mt-1 text-sm text-red-600">
                  Estos precios ya no deberían
                  utilizarse en nuevas Notas de Venta.
                </p>
              </div>

              {renderTabla(
                vencidos,
                "vencidos"
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}