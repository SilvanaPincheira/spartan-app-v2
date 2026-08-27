"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRouter } from "next/navigation";

const EMAIL_AUTORIZADO =
  "jorge.beltran@spartan.cl";

export default function ReporteriaEvaluacionesPage() {
  const router = useRouter();

  const [cargando, setCargando] =
    useState(true);

  const [autorizado, setAutorizado] =
    useState(false);

  const [evaluaciones, setEvaluaciones] =
    useState<any[]>([]);

  const [error, setError] =
    useState("");

  useEffect(() => {
    async function cargarPagina() {
      try {
        const supabase =
          createClientComponentClient();

        const { data } =
          await supabase.auth.getSession();

        const email =
          data.session?.user?.email
            ?.trim()
            .toLowerCase() || "";

        if (email !== EMAIL_AUTORIZADO) {
          setAutorizado(false);
          setCargando(false);
          return;
        }

        setAutorizado(true);

        const response = await fetch(
          "/api/historial-evaluaciones",
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const resultado =
          await response.json();

        if (
          !response.ok ||
          resultado.success === false
        ) {
          throw new Error(
            resultado.error ||
              "No se pudieron cargar las evaluaciones."
          );
        }

        setEvaluaciones(
          resultado.evaluaciones || []
        );
      } catch (error) {
        console.error(error);

        setError(
          error instanceof Error
            ? error.message
            : "Ocurrió un error inesperado."
        );
      } finally {
        setCargando(false);
      }
    }

    cargarPagina();
  }, []);

  if (cargando) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3">
            ⏳
          </div>

          <p className="text-gray-600">
            Cargando reportería...
          </p>
        </div>
      </div>
    );
  }

  if (!autorizado) {
    return (
      <div className="max-w-xl mx-auto mt-12 rounded-xl border border-red-200 bg-red-50 p-8 text-center">
        <div className="text-5xl mb-4">
          🔒
        </div>

        <h1 className="text-xl font-bold text-red-700">
          Acceso restringido
        </h1>

        <p className="mt-2 text-sm text-red-600">
          No tienes autorización para acceder a
          la Reportería de Evaluaciones.
        </p>

        <button
          onClick={() => router.push("/")}
          className="mt-6 rounded-lg bg-[#1f4ed8] px-5 py-2 text-sm font-medium text-white hover:bg-[#163bb8]"
        >
          Volver al inicio
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-blue-600">
          Gerencia
        </p>

        <h1 className="text-2xl font-bold text-gray-900">
          Reportería de Evaluaciones
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Seguimiento de evaluaciones comerciales y
          comodatos.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!error && (
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">
            Evaluaciones registradas
          </p>

          <p className="mt-1 text-3xl font-bold text-gray-900">
            {evaluaciones.length}
          </p>
        </div>
      )}

      {!error &&
        evaluaciones.length === 0 && (
          <div className="rounded-xl border bg-white p-10 text-center shadow-sm">
            <div className="text-4xl mb-3">
              📋
            </div>

            <p className="font-medium text-gray-700">
              No existen evaluaciones para mostrar.
            </p>
          </div>
        )}

      {!error &&
        evaluaciones.length > 0 && (
          <div className="rounded-xl border bg-white shadow-sm">
            <div className="border-b p-4">
              <h2 className="font-semibold text-gray-900">
                Últimas evaluaciones
              </h2>
            </div>

            <div className="divide-y">
              {evaluaciones
                .slice(0, 10)
                .map((evaluacion) => (
                  <div
                    key={
                      evaluacion.idEvaluacion
                    }
                    className="p-4"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {evaluacion.cliente ||
                            "Cliente sin nombre"}
                        </p>

                        <p className="text-xs text-gray-500">
                          {
                            evaluacion.idEvaluacion
                          }{" "}
                          ·{" "}
                          {
                            evaluacion.fechaEvaluacion
                          }
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {evaluacion.requiereVB && (
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                            VB pendiente
                          </span>
                        )}

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            evaluacion.estado ===
                            "Viable"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {evaluacion.estado ||
                            "Sin estado"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
    </div>
  );
}