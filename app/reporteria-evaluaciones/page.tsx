"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import {
  createClientComponentClient,
} from "@supabase/auth-helpers-nextjs";


const EMAIL_AUTORIZADO =
  "jorge.beltran@spartan.cl";


type Producto = {
  codigo: string;
  descripcion: string;
  kilosUnidadBase: number;
  cantidadMensual: number;
  precioBaseKg: number;
  precioVentaKg: number;
  costoKg: number;
  costoTotal: number;
  descuentoPct: number;
  totalItem: number;
  fuente: string;
};


type Equipo = {
  codigo: string;
  descripcion: string;
  cantidad: number;
  valorUnitario: number;
  costoTotal: number;
  total: number;
  fuente: string;
};


type Evaluacion = {
  idEvaluacion: string;
  fechaEvaluacion: string;

  cliente: string;
  rut: string;
  direccion: string;

  ejecutivo: string;
  correoEjecutivo: string;
  zona: string;
  comentarios: string;

  mesesContrato: number;

  comisionBasePct: number;
  comisionFinalPct: number;
  relacionCdtoVenta: number;

  margenFinalPct: number;
  margenFinal: number;

  estado: string;

  ventaMensual: number;
  costoTotal: number;

  comodatoTotal: number;
  comodatoMensual: number;

  montoComision: number;

  requiereVB: boolean;
  estadoVB: string;

  usuarioVB?: string;
  fechaVB?: string;
  comentarioVB?: string;
  montoAprobado?: number;

  productos: Producto[];
  equipos: Equipo[];
};


type ResultadoVB = {
  success: boolean;
  error: string;
};


function formatoMoneda(valor: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(Number(valor) || 0);
}


function formatoNumero(
  valor: number,
  decimales = 2
) {
  return new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimales,
  }).format(Number(valor) || 0);
}


function formatoPorcentaje(valor: number) {
  const numero = Number(valor) || 0;

  const porcentaje =
    Math.abs(numero) <= 1
      ? numero * 100
      : numero;

  return `${formatoNumero(
    porcentaje,
    2
  )}%`;
}


function obtenerFechaComparable(
  fecha: string
) {
  if (!fecha) return null;

  const parteFecha =
    fecha.split(" ")[0];

  const partes =
    parteFecha.split("-");

  if (partes.length !== 3) {
    return null;
  }

  const dia = Number(partes[0]);
  const mes = Number(partes[1]);
  const anio = Number(partes[2]);

  const resultado =
    new Date(anio, mes - 1, dia);

  return Number.isNaN(
    resultado.getTime()
  )
    ? null
    : resultado;
}


function normalizarTexto(
  valor: unknown
) {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}


export default function ReporteriaEvaluacionesPage() {
  const router = useRouter();

  const [cargando, setCargando] =
    useState(true);

  const [autorizado, setAutorizado] =
    useState(false);

  const [error, setError] =
    useState("");

  const [evaluaciones, setEvaluaciones] =
    useState<Evaluacion[]>([]);

  const [
    evaluacionAbierta,
    setEvaluacionAbierta,
  ] = useState<string | null>(null);

  const [guardandoVB, setGuardandoVB] =
    useState<string | null>(null);

  const [busqueda, setBusqueda] =
    useState("");

  const [
    filtroEjecutivo,
    setFiltroEjecutivo,
  ] = useState("");

  const [filtroZona, setFiltroZona] =
    useState("");

  const [
    filtroViabilidad,
    setFiltroViabilidad,
  ] = useState("");

  const [filtroVB, setFiltroVB] =
    useState("");

  const [fechaDesde, setFechaDesde] =
    useState("");

  const [fechaHasta, setFechaHasta] =
    useState("");


  useEffect(() => {
    cargarDatos();
  }, []);


  async function cargarDatos() {
    setCargando(true);
    setError("");

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
            "No se pudo cargar la reportería."
        );
      }

      setEvaluaciones(
        Array.isArray(
          resultado.evaluaciones
        )
          ? resultado.evaluaciones
          : []
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


  async function guardarVBGerencia(
    idEvaluacion: string,
    estadoVB:
      | "Aprobado"
      | "Rechazado",
    comentario: string
  ): Promise<ResultadoVB> {
    setGuardandoVB(idEvaluacion);

    try {
      const response = await fetch(
        "/api/historial-evaluaciones",
        {
          method: "PATCH",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            idEvaluacion,
            estadoVB,
            comentario,
          }),
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
            "No se pudo guardar el VB."
        );
      }

      /*
       * Actualizar la evaluación en pantalla
       * sin recargar todo el historial.
       */
      setEvaluaciones((actuales) =>
        actuales.map((evaluacion) =>
          evaluacion.idEvaluacion ===
          idEvaluacion
            ? {
                ...evaluacion,

                estadoVB:
                  resultado.estadoVB,

                usuarioVB:
                  resultado.usuarioVB,

                fechaVB:
                  resultado.fechaVB,

                comentarioVB:
                  resultado.comentarioVB,

                montoAprobado:
                  resultado.montoAprobado,
              }
            : evaluacion
        )
      );

      return {
        success: true,
        error: "",
      };

    } catch (error) {
      console.error(error);

      return {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "No se pudo guardar la decisión.",
      };

    } finally {
      setGuardandoVB(null);
    }
  }


  const ejecutivos = useMemo(() => {
    return Array.from(
      new Set(
        evaluaciones
          .map((item) =>
            String(
              item.ejecutivo || ""
            ).trim()
          )
          .filter(Boolean)
      )
    ).sort((a, b) =>
      a.localeCompare(b, "es")
    );
  }, [evaluaciones]);


  const zonas = useMemo(() => {
    return Array.from(
      new Set(
        evaluaciones
          .map((item) =>
            String(
              item.zona || ""
            ).trim()
          )
          .filter(Boolean)
      )
    ).sort((a, b) =>
      a.localeCompare(b, "es")
    );
  }, [evaluaciones]);


  const evaluacionesFiltradas =
    useMemo(() => {
      const textoBusqueda =
        normalizarTexto(busqueda);

      const desde = fechaDesde
        ? new Date(
            `${fechaDesde}T00:00:00`
          )
        : null;

      const hasta = fechaHasta
        ? new Date(
            `${fechaHasta}T23:59:59`
          )
        : null;

      return evaluaciones.filter(
        (evaluacion) => {
          const coincideBusqueda =
            !textoBusqueda ||
            normalizarTexto(
              evaluacion.cliente
            ).includes(textoBusqueda) ||
            normalizarTexto(
              evaluacion.rut
            ).includes(textoBusqueda) ||
            normalizarTexto(
              evaluacion.idEvaluacion
            ).includes(textoBusqueda) ||
            normalizarTexto(
              evaluacion.ejecutivo
            ).includes(textoBusqueda);

          const coincideEjecutivo =
            !filtroEjecutivo ||
            evaluacion.ejecutivo ===
              filtroEjecutivo;

          const coincideZona =
            !filtroZona ||
            evaluacion.zona ===
              filtroZona;

          const coincideViabilidad =
            !filtroViabilidad ||
            normalizarTexto(
              evaluacion.estado
            ) ===
              normalizarTexto(
                filtroViabilidad
              );

          let coincideVB = true;

          if (
            filtroVB === "requiere"
          ) {
            coincideVB =
              evaluacion.requiereVB ===
              true;
          }

          if (
            filtroVB === "pendiente"
          ) {
            coincideVB =
              evaluacion.requiereVB ===
                true &&
              normalizarTexto(
                evaluacion.estadoVB
              ) === "pendiente";
          }

          if (
            filtroVB === "aprobado"
          ) {
            coincideVB =
              normalizarTexto(
                evaluacion.estadoVB
              ) === "aprobado";
          }

          if (
            filtroVB === "rechazado"
          ) {
            coincideVB =
              normalizarTexto(
                evaluacion.estadoVB
              ) === "rechazado";
          }

          if (
            filtroVB === "no-requiere"
          ) {
            coincideVB =
              evaluacion.requiereVB !==
              true;
          }

          const fecha =
            obtenerFechaComparable(
              evaluacion.fechaEvaluacion
            );

          const coincideDesde =
            !desde ||
            !fecha ||
            fecha >= desde;

          const coincideHasta =
            !hasta ||
            !fecha ||
            fecha <= hasta;

          return (
            coincideBusqueda &&
            coincideEjecutivo &&
            coincideZona &&
            coincideViabilidad &&
            coincideVB &&
            coincideDesde &&
            coincideHasta
          );
        }
      );
    }, [
      evaluaciones,
      busqueda,
      filtroEjecutivo,
      filtroZona,
      filtroViabilidad,
      filtroVB,
      fechaDesde,
      fechaHasta,
    ]);


  const indicadores = useMemo(() => {
    const ventaTotal =
      evaluacionesFiltradas.reduce(
        (total, item) =>
          total +
          (Number(
            item.ventaMensual
          ) || 0),
        0
      );

    const costoTotal =
      evaluacionesFiltradas.reduce(
        (total, item) =>
          total +
          (Number(
            item.costoTotal
          ) || 0),
        0
      );

    const margenTotal =
      evaluacionesFiltradas.reduce(
        (total, item) =>
          total +
          (Number(
            item.margenFinal
          ) || 0),
        0
      );

    const comodatoTotal =
      evaluacionesFiltradas.reduce(
        (total, item) =>
          total +
          (Number(
            item.comodatoTotal
          ) || 0),
        0
      );

    const viables =
      evaluacionesFiltradas.filter(
        (item) =>
          normalizarTexto(
            item.estado
          ) === "viable"
      ).length;

    const pendientesVB =
      evaluacionesFiltradas.filter(
        (item) =>
          item.requiereVB === true &&
          normalizarTexto(
            item.estadoVB
          ) === "pendiente"
      ).length;

    return {
      ventaTotal,
      costoTotal,
      margenTotal,
      comodatoTotal,
      viables,
      pendientesVB,
    };
  }, [evaluacionesFiltradas]);


  function limpiarFiltros() {
    setBusqueda("");
    setFiltroEjecutivo("");
    setFiltroZona("");
    setFiltroViabilidad("");
    setFiltroVB("");
    setFechaDesde("");
    setFechaHasta("");
  }


  function cambiarEvaluacion(
    idEvaluacion: string
  ) {
    setEvaluacionAbierta(
      (actual) =>
        actual === idEvaluacion
          ? null
          : idEvaluacion
    );
  }


  if (cargando) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-5xl">
            ⏳
          </div>

          <p className="font-medium text-gray-700">
            Cargando reportería...
          </p>

          <p className="mt-1 text-sm text-gray-500">
            Consultando el historial de
            evaluaciones.
          </p>
        </div>
      </div>
    );
  }


  if (!autorizado) {
    return (
      <div className="mx-auto mt-12 max-w-xl rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
        <div className="mb-4 text-5xl">
          🔒
        </div>

        <h1 className="text-xl font-bold text-red-700">
          Acceso restringido
        </h1>

        <p className="mt-2 text-sm text-red-600">
          Este módulo está disponible
          únicamente para Gerencia.
        </p>

        <button
          onClick={() =>
            router.push("/")
          }
          className="mt-6 rounded-lg bg-[#1f4ed8] px-5 py-2 text-sm font-medium text-white hover:bg-[#163bb8]"
        >
          Volver al inicio
        </button>
      </div>
    );
  }


  return (
    <div className="space-y-6">
      {/* CABECERA */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-blue-600">
            Gerencia
          </p>

          <h1 className="text-2xl font-bold text-gray-900">
            Reportería de Evaluaciones
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Evaluaciones comerciales,
            costos, márgenes y comodatos.
          </p>
        </div>

        <button
          onClick={cargarDatos}
          className="rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
        >
          🔄 Actualizar información
        </button>
      </div>


      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="font-medium text-red-700">
            No fue posible cargar la
            reportería
          </p>

          <p className="mt-1 text-sm text-red-600">
            {error}
          </p>
        </div>
      )}


      {!error && (
        <>
          {/* INDICADORES */}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <TarjetaIndicador
              titulo="Evaluaciones"
              valor={formatoNumero(
                evaluacionesFiltradas.length,
                0
              )}
              detalle={`${indicadores.viables} viables`}
              icono="📋"
              color="azul"
            />

            <TarjetaIndicador
              titulo="Venta mensual"
              valor={formatoMoneda(
                indicadores.ventaTotal
              )}
              detalle="Total evaluaciones filtradas"
              icono="💰"
              color="verde"
            />

            <TarjetaIndicador
              titulo="Margen final"
              valor={formatoMoneda(
                indicadores.margenTotal
              )}
              detalle={`Costo: ${formatoMoneda(
                indicadores.costoTotal
              )}`}
              icono="📈"
              color="morado"
            />

            <TarjetaIndicador
              titulo="Comodato total"
              valor={formatoMoneda(
                indicadores.comodatoTotal
              )}
              detalle={`${indicadores.pendientesVB} VB pendientes`}
              icono="🧪"
              color="naranjo"
            />
          </div>


          {/* FILTROS */}

          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">
                  Filtros
                </h2>

                <p className="text-xs text-gray-500">
                  Selecciona los criterios
                  de la reportería.
                </p>
              </div>

              <button
                onClick={limpiarFiltros}
                className="text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                Limpiar filtros
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="xl:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Buscar evaluación
                </label>

                <input
                  value={busqueda}
                  onChange={(event) =>
                    setBusqueda(
                      event.target.value
                    )
                  }
                  placeholder="Cliente, RUT, ejecutivo o ID..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <CampoSeleccion
                etiqueta="Ejecutivo"
                value={filtroEjecutivo}
                onChange={
                  setFiltroEjecutivo
                }
                opciones={ejecutivos}
                opcionInicial="Todos"
              />

              <CampoSeleccion
                etiqueta="División / Zona"
                value={filtroZona}
                onChange={setFiltroZona}
                opciones={zonas}
                opcionInicial="Todas"
              />

              <CampoSeleccion
                etiqueta="Viabilidad"
                value={
                  filtroViabilidad
                }
                onChange={
                  setFiltroViabilidad
                }
                opciones={[
                  "Viable",
                  "No Viable",
                ]}
                opcionInicial="Todos"
              />

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  VB Gerencia
                </label>

                <select
                  value={filtroVB}
                  onChange={(event) =>
                    setFiltroVB(
                      event.target.value
                    )
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  <option value="">
                    Todos
                  </option>

                  <option value="requiere">
                    Requiere VB
                  </option>

                  <option value="pendiente">
                    Pendiente
                  </option>

                  <option value="aprobado">
                    Aprobado
                  </option>

                  <option value="rechazado">
                    Rechazado
                  </option>

                  <option value="no-requiere">
                    No requiere
                  </option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Fecha desde
                </label>

                <input
                  type="date"
                  value={fechaDesde}
                  onChange={(event) =>
                    setFechaDesde(
                      event.target.value
                    )
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Fecha hasta
                </label>

                <input
                  type="date"
                  value={fechaHasta}
                  onChange={(event) =>
                    setFechaHasta(
                      event.target.value
                    )
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </section>


          {/* EVALUACIONES */}

          <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="border-b p-5">
              <h2 className="font-semibold text-gray-900">
                Evaluaciones
              </h2>

              <p className="text-xs text-gray-500">
                {
                  evaluacionesFiltradas.length
                }{" "}
                resultados encontrados
              </p>
            </div>

            {evaluacionesFiltradas.length ===
            0 ? (
              <div className="p-12 text-center">
                <div className="mb-3 text-5xl">
                  🔎
                </div>

                <p className="font-medium text-gray-700">
                  No se encontraron
                  evaluaciones
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {evaluacionesFiltradas.map(
                  (evaluacion) => {
                    const abierta =
                      evaluacionAbierta ===
                      evaluacion.idEvaluacion;

                    return (
                      <article
                        key={
                          evaluacion.idEvaluacion
                        }
                      >
                        <button
                          type="button"
                          onClick={() =>
                            cambiarEvaluacion(
                              evaluacion.idEvaluacion
                            )
                          }
                          className="w-full p-5 text-left transition hover:bg-gray-50"
                        >
                          <div className="grid gap-4 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] lg:items-center">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-semibold text-gray-900">
                                  {evaluacion.cliente ||
                                    "Cliente sin nombre"}
                                </h3>

                                <EstadoViabilidad
                                  estado={
                                    evaluacion.estado
                                  }
                                />

                                {evaluacion.requiereVB && (
                                  <EstadoVB
                                    estado={
                                      evaluacion.estadoVB
                                    }
                                  />
                                )}
                              </div>

                              <p className="mt-1 text-xs text-gray-500">
                                {
                                  evaluacion.idEvaluacion
                                }{" "}
                                ·{" "}
                                {
                                  evaluacion.fechaEvaluacion
                                }
                              </p>

                              <p className="mt-1 text-sm text-gray-600">
                                Ejecutivo:{" "}
                                {evaluacion.ejecutivo ||
                                  "Sin informar"}
                              </p>
                            </div>

                            <DatoResumen
                              etiqueta="Venta mensual"
                              valor={formatoMoneda(
                                evaluacion.ventaMensual
                              )}
                            />

                            <DatoResumen
                              etiqueta="Margen final"
                              valor={formatoPorcentaje(
                                evaluacion.margenFinalPct
                              )}
                            />

                            <DatoResumen
                              etiqueta="Comodato"
                              valor={formatoMoneda(
                                evaluacion.comodatoTotal
                              )}
                            />

                            <div className="text-2xl text-blue-600">
                              {abierta
                                ? "▲"
                                : "▼"}
                            </div>
                          </div>
                        </button>

                        {abierta && (
                          <DetalleEvaluacion
                            evaluacion={
                              evaluacion
                            }
                            guardando={
                              guardandoVB ===
                              evaluacion.idEvaluacion
                            }
                            onGuardarVB={
                              guardarVBGerencia
                            }
                          />
                        )}
                      </article>
                    );
                  }
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}


/****************************************************
 * COMPONENTES
 ****************************************************/

function TarjetaIndicador({
  titulo,
  valor,
  detalle,
  icono,
  color,
}: {
  titulo: string;
  valor: string;
  detalle: string;
  icono: string;
  color:
    | "azul"
    | "verde"
    | "morado"
    | "naranjo";
}) {
  const colores = {
    azul:
      "bg-blue-50 text-blue-700",
    verde:
      "bg-green-50 text-green-700",
    morado:
      "bg-purple-50 text-purple-700",
    naranjo:
      "bg-amber-50 text-amber-700",
  };

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">
            {titulo}
          </p>

          <p className="mt-2 text-xl font-bold text-gray-900">
            {valor}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            {detalle}
          </p>
        </div>

        <div
          className={`rounded-xl p-3 text-xl ${colores[color]}`}
        >
          {icono}
        </div>
      </div>
    </div>
  );
}


function CampoSeleccion({
  etiqueta,
  value,
  onChange,
  opciones,
  opcionInicial,
}: {
  etiqueta: string;
  value: string;
  onChange:
    (value: string) => void;
  opciones: string[];
  opcionInicial: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">
        {etiqueta}
      </label>

      <select
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
      >
        <option value="">
          {opcionInicial}
        </option>

        {opciones.map(
          (opcion) => (
            <option
              key={opcion}
              value={opcion}
            >
              {opcion}
            </option>
          )
        )}
      </select>
    </div>
  );
}


function EstadoViabilidad({
  estado,
}: {
  estado: string;
}) {
  const viable =
    normalizarTexto(estado) ===
    "viable";

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
        viable
          ? "bg-green-100 text-green-700"
          : "bg-red-100 text-red-700"
      }`}
    >
      {estado || "Sin estado"}
    </span>
  );
}


function EstadoVB({
  estado,
}: {
  estado: string;
}) {
  const estadoNormalizado =
    normalizarTexto(estado);

  if (
    estadoNormalizado === "aprobado"
  ) {
    return (
      <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
        ✅ VB Aprobado
      </span>
    );
  }

  if (
    estadoNormalizado === "rechazado"
  ) {
    return (
      <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
        ❌ VB Rechazado
      </span>
    );
  }

  return (
    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
      ⚠ VB Pendiente
    </span>
  );
}


function DatoResumen({
  etiqueta,
  valor,
}: {
  etiqueta: string;
  valor: string;
}) {
  return (
    <div>
      <p className="text-xs text-gray-500">
        {etiqueta}
      </p>

      <p className="mt-1 font-semibold text-gray-900">
        {valor}
      </p>
    </div>
  );
}


function CajaDato({
  titulo,
  valor,
  secundario,
}: {
  titulo: string;
  valor: string;
  secundario?: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-xs text-gray-500">
        {titulo}
      </p>

      <p className="mt-1 font-bold text-gray-900">
        {valor}
      </p>

      {secundario && (
        <p className="mt-1 text-xs font-medium text-blue-600">
          {secundario}
        </p>
      )}
    </div>
  );
}


function DetalleEvaluacion({
  evaluacion,
  guardando,
  onGuardarVB,
}: {
  evaluacion: Evaluacion;
  guardando: boolean;

  onGuardarVB: (
    idEvaluacion: string,
    estadoVB:
      | "Aprobado"
      | "Rechazado",
    comentario: string
  ) => Promise<ResultadoVB>;
}) {
  const [comentario, setComentario] =
    useState(
      evaluacion.comentarioVB || ""
    );

  const [mensaje, setMensaje] =
    useState("");

  const [
    tipoMensaje,
    setTipoMensaje,
  ] = useState<
    "success" | "error" | ""
  >("");


  const decisionRegistrada =
    evaluacion.estadoVB ===
      "Aprobado" ||
    evaluacion.estadoVB ===
      "Rechazado";


  async function procesarDecision(
    estado:
      | "Aprobado"
      | "Rechazado"
  ) {
    setMensaje("");
    setTipoMensaje("");

    if (
      estado === "Rechazado" &&
      !comentario.trim()
    ) {
      setMensaje(
        "Debe ingresar el motivo del rechazo."
      );

      setTipoMensaje("error");
      return;
    }

    const confirmacion =
      window.confirm(
        estado === "Aprobado"
          ? "¿Confirma la aprobación de esta evaluación?"
          : "¿Confirma el rechazo de esta evaluación?"
      );

    if (!confirmacion) {
      return;
    }

    const resultado =
      await onGuardarVB(
        evaluacion.idEvaluacion,
        estado,
        comentario.trim()
      );

    if (resultado.success) {
      setMensaje(
        estado === "Aprobado"
          ? "Evaluación aprobada correctamente."
          : "Evaluación rechazada correctamente."
      );

      setTipoMensaje("success");

    } else {
      setMensaje(resultado.error);
      setTipoMensaje("error");
    }
  }


  return (
    <div className="border-t bg-slate-50 p-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <CajaDato
          titulo="Venta total neta"
          valor={formatoMoneda(
            evaluacion.ventaMensual
          )}
        />

        <CajaDato
          titulo="Costo total"
          valor={formatoMoneda(
            evaluacion.costoTotal
          )}
        />

        <CajaDato
          titulo="Margen final"
          valor={formatoMoneda(
            evaluacion.margenFinal
          )}
          secundario={formatoPorcentaje(
            evaluacion.margenFinalPct
          )}
        />

        <CajaDato
          titulo="Comisión final"
          valor={formatoPorcentaje(
            evaluacion.comisionFinalPct
          )}
          secundario={formatoMoneda(
            evaluacion.montoComision
          )}
        />

        <CajaDato
          titulo="Contrato"
          valor={`${formatoNumero(
            evaluacion.mesesContrato,
            0
          )} meses`}
        />

        <CajaDato
          titulo="Comodato total"
          valor={formatoMoneda(
            evaluacion.comodatoTotal
          )}
        />

        <CajaDato
          titulo="Comodato mensual"
          valor={formatoMoneda(
            evaluacion.comodatoMensual
          )}
        />

        <CajaDato
          titulo="Relación Cdto/Venta"
          valor={formatoPorcentaje(
            evaluacion.relacionCdtoVenta
          )}
        />

        <CajaDato
          titulo="División / Zona"
          valor={
            evaluacion.zona ||
            "Sin informar"
          }
        />

        <CajaDato
          titulo="Resultado"
          valor={
            evaluacion.estado ||
            "Sin informar"
          }
        />
      </div>


      {evaluacion.requiereVB && (
        <div
          className={`mt-5 rounded-xl border p-5 ${
            evaluacion.estadoVB ===
            "Aprobado"
              ? "border-green-300 bg-green-50"
              : evaluacion.estadoVB ===
                "Rechazado"
              ? "border-red-300 bg-red-50"
              : "border-amber-300 bg-amber-50"
          }`}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p
                className={`font-semibold ${
                  evaluacion.estadoVB ===
                  "Aprobado"
                    ? "text-green-800"
                    : evaluacion.estadoVB ===
                      "Rechazado"
                    ? "text-red-800"
                    : "text-amber-800"
                }`}
              >
                {evaluacion.estadoVB ===
                "Aprobado"
                  ? "✅ Aprobado por Gerencia"
                  : evaluacion.estadoVB ===
                    "Rechazado"
                  ? "❌ Rechazado por Gerencia"
                  : "⚠ Requiere VB de Gerencia"}
              </p>

              <p className="mt-1 text-sm text-gray-700">
                Comodato:{" "}
                <strong>
                  {formatoMoneda(
                    evaluacion.comodatoTotal
                  )}
                </strong>
              </p>

              {decisionRegistrada && (
                <div className="mt-3 space-y-1 text-sm text-gray-700">
                  <p>
                    <strong>
                      Usuario:
                    </strong>{" "}
                    {evaluacion.usuarioVB ||
                      "Sin informar"}
                  </p>

                  <p>
                    <strong>
                      Fecha:
                    </strong>{" "}
                    {evaluacion.fechaVB ||
                      "Sin informar"}
                  </p>

                  {evaluacion.comentarioVB && (
                    <p>
                      <strong>
                        Comentario:
                      </strong>{" "}
                      {
                        evaluacion.comentarioVB
                      }
                    </p>
                  )}

                  <p>
                    <strong>
                      Monto registrado:
                    </strong>{" "}
                    {formatoMoneda(
                      evaluacion.montoAprobado ||
                        evaluacion.comodatoTotal
                    )}
                  </p>
                </div>
              )}
            </div>

            <span
              className={`w-fit rounded-full px-3 py-1 text-sm font-semibold ${
                evaluacion.estadoVB ===
                "Aprobado"
                  ? "bg-green-200 text-green-800"
                  : evaluacion.estadoVB ===
                    "Rechazado"
                  ? "bg-red-200 text-red-800"
                  : "bg-amber-200 text-amber-800"
              }`}
            >
              {evaluacion.estadoVB ||
                "Pendiente"}
            </span>
          </div>


          {!decisionRegistrada && (
            <div className="mt-5 border-t border-amber-200 pt-4">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Comentario de Gerencia
              </label>

              <textarea
                value={comentario}
                onChange={(event) =>
                  setComentario(
                    event.target.value
                  )
                }
                placeholder="Comentario opcional al aprobar y obligatorio al rechazar..."
                rows={3}
                disabled={guardando}
                className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
              />

              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={guardando}
                  onClick={() =>
                    procesarDecision(
                      "Rechazado"
                    )
                  }
                  className="rounded-lg border border-red-300 bg-white px-5 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {guardando
                    ? "Guardando..."
                    : "❌ Rechazar"}
                </button>

                <button
                  type="button"
                  disabled={guardando}
                  onClick={() =>
                    procesarDecision(
                      "Aprobado"
                    )
                  }
                  className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {guardando
                    ? "Guardando..."
                    : "✅ Aprobar"}
                </button>
              </div>
            </div>
          )}


          {mensaje && (
            <div
              className={`mt-4 rounded-lg border p-3 text-sm ${
                tipoMensaje ===
                "success"
                  ? "border-green-200 bg-green-100 text-green-800"
                  : "border-red-200 bg-red-100 text-red-800"
              }`}
            >
              {mensaje}
            </div>
          )}
        </div>
      )}


      {evaluacion.comentarios && (
        <div className="mt-5 rounded-xl border bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Comentarios de la evaluación
          </p>

          <p className="mt-2 text-sm text-gray-700">
            {evaluacion.comentarios}
          </p>
        </div>
      )}


      <div className="mt-5 space-y-5">
        <TablaProductos
          productos={
            evaluacion.productos ||
            []
          }
        />

        <TablaEquipos
          equipos={
            evaluacion.equipos ||
            []
          }
        />
      </div>
    </div>
  );
}


function TablaProductos({
  productos,
}: {
  productos: Producto[];
}) {
  if (productos.length === 0) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-white">
      <div className="border-b px-4 py-3">
        <h4 className="font-semibold text-gray-900">
          Productos
        </h4>

        <p className="text-xs text-gray-500">
          {productos.length} productos
          registrados
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-3">
                Código
              </th>

              <th className="px-4 py-3">
                Descripción
              </th>

              <th className="px-4 py-3 text-right">
                Cantidad
              </th>

              <th className="px-4 py-3 text-right">
                Venta $/Kg
              </th>

              <th className="px-4 py-3 text-right">
                Costo $/Kg
              </th>

              <th className="px-4 py-3 text-right">
                Costo total
              </th>

              <th className="px-4 py-3 text-right">
                Total venta
              </th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {productos.map(
              (producto, index) => (
                <tr
                  key={`${producto.codigo}-${index}`}
                  className="hover:bg-gray-50"
                >
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">
                    {producto.codigo}
                  </td>

                  <td className="min-w-[260px] px-4 py-3 text-gray-700">
                    {
                      producto.descripcion
                    }
                  </td>

                  <td className="px-4 py-3 text-right">
                    {formatoNumero(
                      producto.cantidadMensual
                    )}
                  </td>

                  <td className="px-4 py-3 text-right">
                    {formatoMoneda(
                      producto.precioVentaKg
                    )}
                  </td>

                  <td className="px-4 py-3 text-right">
                    {formatoMoneda(
                      producto.costoKg
                    )}
                  </td>

                  <td className="px-4 py-3 text-right">
                    {formatoMoneda(
                      producto.costoTotal
                    )}
                  </td>

                  <td className="px-4 py-3 text-right font-semibold">
                    {formatoMoneda(
                      producto.totalItem
                    )}
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


function TablaEquipos({
  equipos,
}: {
  equipos: Equipo[];
}) {
  if (equipos.length === 0) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-white">
      <div className="border-b px-4 py-3">
        <h4 className="font-semibold text-gray-900">
          Equipos en comodato
        </h4>

        <p className="text-xs text-gray-500">
          {equipos.length} equipos
          registrados
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-3">
                Código
              </th>

              <th className="px-4 py-3">
                Descripción
              </th>

              <th className="px-4 py-3 text-right">
                Cantidad
              </th>

              <th className="px-4 py-3 text-right">
                Valor unitario
              </th>

              <th className="px-4 py-3 text-right">
                Total
              </th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {equipos.map(
              (equipo, index) => (
                <tr
                  key={`${equipo.codigo}-${index}`}
                  className="hover:bg-gray-50"
                >
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">
                    {equipo.codigo}
                  </td>

                  <td className="min-w-[260px] px-4 py-3 text-gray-700">
                    {
                      equipo.descripcion
                    }
                  </td>

                  <td className="px-4 py-3 text-right">
                    {formatoNumero(
                      equipo.cantidad,
                      0
                    )}
                  </td>

                  <td className="px-4 py-3 text-right">
                    {formatoMoneda(
                      equipo.valorUnitario
                    )}
                  </td>

                  <td className="px-4 py-3 text-right font-semibold">
                    {formatoMoneda(
                      equipo.total
                    )}
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}