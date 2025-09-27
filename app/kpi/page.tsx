"use client";

import Link from "next/link";

export default function KpiMenu() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-[#1f4ed8] mb-6">
        KPI – Reportes
      </h1>

      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
        {/* Card: Clientes Inactivos con Comodatos */}
        <Link
          href="/kpi/clientes-inactivos"
          className="group block rounded-2xl border bg-white p-6 shadow-sm ring-1 ring-black/5 transition hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#2B6CFF]">
              Clientes Inactivos
            </h2>
            <span className="text-3xl">🚫</span>
          </div>
          <p className="mt-2 text-sm text-zinc-600">
            Lista clientes con comodatos vigentes pero sin compras en los últimos 6 meses.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 text-[#2B6CFF]">
            <span className="underline underline-offset-4">Ir al KPI</span>
            <svg
              className="h-4 w-4 transition group-hover:translate-x-0.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </div>
        </Link>

        {/* Aquí van tus otras tarjetas de KPI */}
      </div>
    </div>
  );
}
