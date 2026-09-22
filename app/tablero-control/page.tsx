import Link from "next/link";

export default function TableroControlPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Tablero de Control
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Seguimiento comercial, avance de metas y análisis comparativo.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {/* AVANCE DIARIO */}
        <Link
          href="/avance-diario"
          className="group rounded-xl border bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-2xl">
              📈
            </div>

            <span className="text-gray-300 transition group-hover:text-[#1f4ed8]">
              →
            </span>
          </div>

          <h2 className="mt-5 text-lg font-bold text-gray-900">
            Avance Diario
          </h2>

          <p className="mt-2 text-sm leading-6 text-gray-500">
            Estado actual de metas, ventas de químicos, otros,
            pedidos, entregas y cierre potencial.
          </p>

          <div className="mt-5 text-sm font-semibold text-[#1f4ed8]">
            Ver avance diario
          </div>
        </Link>

        {/* RESUMEN */}
        <Link
          href="/avance-diario/resumen"
          className="group rounded-xl border bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-2xl">
              📋
            </div>

            <span className="text-gray-300 transition group-hover:text-amber-600">
              →
            </span>
          </div>

          <h2 className="mt-5 text-lg font-bold text-gray-900">
            Resumen de Cierre
          </h2>

          <p className="mt-2 text-sm leading-6 text-gray-500">
            Resumen gerencial por zona y vendedor, con proyección,
            diferencia contra meta y mitigaciones.
          </p>

          <div className="mt-5 text-sm font-semibold text-amber-700">
            Ver resumen de cierre
          </div>
        </Link>

        {/* COMPARATIVO */}
        <Link
          href="/tablero-control/comparativo"
          className="group rounded-xl border bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-green-300 hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-2xl">
              📊
            </div>

            <span className="text-gray-300 transition group-hover:text-green-700">
              →
            </span>
          </div>

          <h2 className="mt-5 text-lg font-bold text-gray-900">
            Comparativo
          </h2>

          <p className="mt-2 text-sm leading-6 text-gray-500">
            Comparación MES LY vs MES CY y acumulado YTD para
            analizar crecimiento y cumplimiento.
          </p>

          <div className="mt-5 text-sm font-semibold text-green-700">
            Ver comparativo
          </div>
        </Link>
      </div>
    </div>
  );
}