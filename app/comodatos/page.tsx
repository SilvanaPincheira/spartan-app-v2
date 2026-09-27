"use client";

import Link from "next/link";

export default function ComodatosMenu() {
  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold text-[#1f4ed8]">
        Gestión de Comodatos
      </h1>

      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">

        {/* Card: Evaluación de Negocio */}
        <Link
          href="/comodatos/negocios"
          className="group block rounded-2xl border bg-white p-6 shadow-sm ring-1 ring-black/5 transition hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#2B6CFF]">
              Evaluación de Negocio
            </h2>

            <span className="text-3xl">
              📈
            </span>
          </div>

          <p className="mt-2 text-sm text-zinc-600">
            Carga catálogo, arma la propuesta, calcula margen,
            comisión y genera PDF/Word.
          </p>

          <div className="mt-4 inline-flex items-center gap-2 text-[#2B6CFF]">
            <span className="underline underline-offset-4">
              Ir al módulo
            </span>

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

        {/* Card: Historial de Evaluaciones */}
        <Link
          href="/comodatos/evaluaciones/historial"
          className="group block rounded-2xl border bg-white p-6 shadow-sm ring-1 ring-black/5 transition hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#2B6CFF]">
              Historial de Evaluaciones
            </h2>

            <span className="text-3xl">
              🧾
            </span>
          </div>

          <p className="mt-2 text-sm text-zinc-600">
            Consulta las evaluaciones guardadas, revisa sus
            resultados y duplica propuestas anteriores.
          </p>

          <div className="mt-4 inline-flex items-center gap-2 text-[#2B6CFF]">
            <span className="underline underline-offset-4">
              Ir al historial
            </span>

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

        {/* NUEVO: Comodatos Instalados */}
        <Link
          href="/comodatos/instalados"
          className="group block rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-6 shadow-sm ring-1 ring-blue-100 transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[#2B6CFF]">
              Comodatos Instalados
            </h2>

            <span className="text-3xl">
              🏭
            </span>
          </div>

          <p className="mt-2 text-sm text-zinc-600">
            Consulta los equipos actualmente instalados y el
            histórico de salidas y entradas de comodato por
            cliente.
          </p>

          <div className="mt-4 inline-flex items-center gap-2 font-medium text-[#2B6CFF]">
            <span className="underline underline-offset-4">
              Ver mis comodatos
            </span>

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

        {/* Card: Clientes Comodatos Activos */}
        <Link
          href="/comodatos/clientes-activos"
          className="group block rounded-2xl border bg-white p-6 shadow-sm ring-1 ring-black/5 transition hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[#2B6CFF]">
              Clientes Activos
            </h2>

            <span className="text-3xl">
              🧪
            </span>
          </div>

          <p className="mt-2 text-sm text-zinc-600">
            Lee ventas y comodatos vigentes (24m), calcula
            relación mensual y simula nuevas instalaciones.
          </p>

          <div className="mt-4 inline-flex items-center gap-2 text-[#2B6CFF]">
            <span className="underline underline-offset-4">
              Ir al módulo
            </span>

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

        {/* Card: Catálogo de Equipos */}
        <Link
          href="/comodatos/catalogos"
          className="group block rounded-2xl border bg-white p-6 shadow-sm ring-1 ring-black/5 transition hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[#2B6CFF]">
              Catálogo de Equipos
            </h2>

            <span className="text-3xl">
              📚
            </span>
          </div>

          <p className="mt-2 text-sm text-zinc-600">
            Visualiza el catálogo (PDF) desde Google Drive con
            visor embebido.
          </p>

          <div className="mt-4 inline-flex items-center gap-2 text-[#2B6CFF]">
            <span className="underline underline-offset-4">
              Ir al módulo
            </span>

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

        {/* Card: Solicitud de Retiro de Equipos */}
        <Link
          href="/comodatos/solicitud-de-retiro"
          className="group block rounded-2xl border bg-white p-6 shadow-sm ring-1 ring-black/5 transition hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[#2B6CFF]">
              Solicitud de Retiro
            </h2>

            <span className="text-3xl">
              📦
            </span>
          </div>

          <p className="mt-2 text-sm text-zinc-600">
            Crea una solicitud de retiro de equipos, selecciona
            comodatos históricos y envíala a Servicio Técnico.
          </p>

          <div className="mt-4 inline-flex items-center gap-2 text-[#2B6CFF]">
            <span className="underline underline-offset-4">
              Ir al módulo
            </span>

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

        {/* Card: Contrato de Comodato */}
        <Link
          href="/comodatos/contrato"
          className="group block rounded-2xl border bg-white p-6 shadow-sm ring-1 ring-black/5 transition hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[#2B6CFF]">
              Contrato de Comodato (Borrador)
            </h2>

            <span className="text-3xl">
              📄
            </span>
          </div>

          <p className="mt-2 text-sm text-zinc-600">
            Visualiza el contrato tipo de comodato y descarga
            el borrador en PDF desde Google Drive.
          </p>

          <div className="mt-4 inline-flex items-center gap-2 text-[#2B6CFF]">
            <span className="underline underline-offset-4">
              Ir al módulo
            </span>

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

        {/* Card: Ficha Clientes Comodato */}
        <Link
          href="/comodatos/ficha-clientes"
          className="group block rounded-2xl border bg-white p-6 shadow-sm ring-1 ring-black/5 transition hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[#2B6CFF]">
              Ficha Clientes Comodato
            </h2>

            <span className="text-3xl">
              📘
            </span>
          </div>

          <p className="mt-2 text-sm text-zinc-600">
            Consulta la base de clientes activos con comodato y
            descarga el Excel desde Google Sheets.
          </p>

          <div className="mt-4 inline-flex items-center gap-2 text-[#2B6CFF]">
            <span className="underline underline-offset-4">
              Ir al módulo
            </span>

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

      </div>
    </div>
  );
}