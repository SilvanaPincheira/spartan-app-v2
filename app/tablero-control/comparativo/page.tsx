"use client";

import Link from "next/link";

export default function ComparativoPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Comparativo Comercial
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Comparación mensual y acumulada de ventas.
          </p>
        </div>

        <Link
          href="/tablero-control"
          className="w-fit rounded-lg border bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          ← Volver al Tablero
        </Link>
      </div>

      <div className="rounded-xl border bg-white p-8 shadow-sm">
        <div className="text-center">
          <div className="text-4xl">📊</div>

          <h2 className="mt-4 text-lg font-bold text-gray-900">
            Comparativo
          </h2>

          <p className="mx-auto mt-2 max-w-xl text-sm text-gray-500">
            Este módulo mostrará MES LY, MES CY, variación,
            YTD LY, YTD CY y crecimiento acumulado.
          </p>
        </div>
      </div>
    </div>
  );
}