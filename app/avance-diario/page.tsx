"use client";



import React, {



  useCallback,



  useEffect,



  useMemo,



  useState,



} from "react";



import Link from "next/link";



import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";



type ReporteRow = {



  fecha_corte: string;



  anio: number;



  mes: number;



  slpcode: number;



  vendedor: string;



  zona: string | null;



  division: string | null;



  equipo: string | null;



  meta_mes: number | string | null;



  facturado_quimicos: number | string | null;



  facturado_otros: number | string | null;



  facturado_total: number | string | null;



  pedidos_quimicos: number | string | null;



  pedidos_otros: number | string | null;



  pedidos_total: number | string | null;



  entregas_quimicos: number | string | null;



  entregas_otros: number | string | null;



  entregas_total: number | string | null;



  cierre_quimicos: number | string | null;



  cierre_otros: number | string | null;



  cierre_total: number | string | null;



  synced_at: string | null;



};



type TotalReporte = {

  meta: number;

  facturadoQuimicos: number;

  facturadoOtros: number;

  facturadoTotal: number;

  pedidosQuimicos: number;

  pedidosOtros: number;

  pedidosTotal: number;

  entregasQuimicos: number;

  entregasOtros: number;

  entregasTotal: number;

  cierreQuimicos: number;

  cierreOtros: number;

  cierreTotal: number;

  avance: number;

  cierrePct: number;

  faltante: number;

};



function num(value: unknown) {



  const n = Number(value ?? 0);



  return Number.isFinite(n)



    ? n



    : 0;



}



function money(value: unknown) {



  return num(value).toLocaleString(



    "es-CL",



    {



      style: "currency",



      currency: "CLP",



      maximumFractionDigits: 0,



    }



  );



}



function pct(value: number) {



  return `${value.toLocaleString("es-CL", {



    minimumFractionDigits: 1,



    maximumFractionDigits: 1,



  })}%`;



}



function clasePct(value: number) {



  if (value >= 100) {



    return "bg-green-100 text-green-800";



  }



  if (value >= 80) {



    return "bg-yellow-100 text-yellow-800";



  }



  return "bg-red-100 text-red-700";



}



function formatSync(value: string | null) {



  if (!value) {



    return "—";



  }



  const date = new Date(value);



  return date.toLocaleString(



    "es-CL",



    {



      dateStyle: "short",



      timeStyle: "medium",



    }



  );



}




function fechaISOlocal(date: Date) {
  const anio = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, "0");
  const dia = String(date.getDate()).padStart(2, "0");

  return `${anio}-${mes}-${dia}`;
}


function rangoMesActual() {
  const hoy = new Date();
  const inicioMes = new Date(
    hoy.getFullYear(),
    hoy.getMonth(),
    1
  );

  return {
    desde: fechaISOlocal(inicioMes),
    hasta: fechaISOlocal(hoy),
  };
}



const JERARQUIA_ZONA: Record<string, string[]> = {

  CENTRO: [

    "PATRICIO ROCO",

    "EDMUNDO DE LA BARRA",

    "VENDEDOR SPARTAN",

    "PEDRO GONZALEZ TRONCOSO",

    "ROBERTO VENEGAS",

  ],

  NORTE: [

    "OSCAR ORTIZ",

    "MITCHEL MARTINEZ JARA",

    "ALVARO AHUMADA",

    "OSCAR ROJAS",

  ],

  SUR: [

    "JUAN PRIETO",

    "ARTURO HOPE",

    "FABIAN ALE",

    "MIGUEL OÑATE",

    "VICTOR REYES",

    "ROGER CHAVEZ VERA",

  ],

};



const GERENTES_DIVISION = [

  { match: "INDUSTRIAL", nombre: "Alberto Damm", rol: "Gerente" },

  { match: "FOOD", nombre: "Claudia Borquez", rol: "Gerente" },

  { match: "HC", nombre: "Ives", rol: "Gerente" },

];



const RESPONSABLES_EQUIPO = [

  {

    match: "PATRICIO ROCO",

    nombre: "Patricio Roco",

    rol: "Subgerente",

  },

  {

    match: "NELSON NORAMBUENA",

    nombre: "Nelson Norambuena",

    rol: "Responsable de equipo",

  },

  {

    match: "HERNAN",

    nombre: "Hernan Lopez",

    rol: "Supervisor",

  },

];



function normalizarJerarquia(value: unknown) {

  return String(value ?? "")

    .trim()

    .toUpperCase()

    .normalize("NFD")

    .replace(/[\u0300-\u036f]/g, "")

    .replace(/\s+/g, " ");

}



function obtenerGerenteDivision(division: string | null) {

  const valor = normalizarJerarquia(division);



  return (

    GERENTES_DIVISION.find((item) =>

      valor.includes(normalizarJerarquia(item.match))

    ) || null

  );

}



function obtenerResponsableEquipo(equipo: string | null) {

  const valor = normalizarJerarquia(equipo);



  return (

    RESPONSABLES_EQUIPO.find((item) =>

      valor.includes(normalizarJerarquia(item.match))

    ) || null

  );

}



function esEquipoPatricio(equipo: string | null) {

  return normalizarJerarquia(equipo).includes("PATRICIO ROCO");

}



function obtenerResponsableZona(

  zona: string | null,

  equipo: string | null

) {

  if (!esEquipoPatricio(equipo)) {

    return null;

  }



  const z = normalizarJerarquia(zona);



  if (z === "CENTRO") {

    return { nombre: "Patricio Roco", rol: "Subgerente" };

  }



  if (z === "NORTE") {

    return { nombre: "Oscar Ortiz", rol: "Responsable Zona" };

  }



  if (z === "SUR") {

    return { nombre: "Juan Prieto", rol: "Responsable Zona" };

  }



  return null;

}



function obtenerRolJerarquico(row: ReporteRow) {

  const vendedor = normalizarJerarquia(row.vendedor);



  const gerente = obtenerGerenteDivision(row.division);

  if (

    gerente &&

    vendedor === normalizarJerarquia(gerente.nombre)

  ) {

    return gerente.rol;

  }



  const responsableEquipo = obtenerResponsableEquipo(row.equipo);

  if (

    responsableEquipo &&

    vendedor === normalizarJerarquia(responsableEquipo.nombre)

  ) {

    return responsableEquipo.rol;

  }



  const responsableZona = obtenerResponsableZona(

    row.zona,

    row.equipo

  );



  if (

    responsableZona &&

    vendedor === normalizarJerarquia(responsableZona.nombre)

  ) {

    return responsableZona.rol;

  }



  return "";

}



function ordenarVendedoresJerarquia(

  zona: string,

  equipo: string,

  lista: ReporteRow[]

) {

  if (esEquipoPatricio(equipo)) {

    return ordenarJerarquiaZona(zona, lista);

  }



  const responsableEquipo = obtenerResponsableEquipo(equipo);

  const nombreResponsable = responsableEquipo

    ? normalizarJerarquia(responsableEquipo.nombre)

    : "";



  return [...lista].sort((a, b) => {

    const nombreA = normalizarJerarquia(a.vendedor);

    const nombreB = normalizarJerarquia(b.vendedor);



    if (nombreResponsable) {

      if (nombreA === nombreResponsable && nombreB !== nombreResponsable) {

        return -1;

      }



      if (nombreB === nombreResponsable && nombreA !== nombreResponsable) {

        return 1;

      }

    }



    return nombreA.localeCompare(nombreB, "es");

  });

}



function esResponsableZona(zona: string, vendedor: string) {

  const zonaNormalizada = normalizarJerarquia(zona);

  const orden = JERARQUIA_ZONA[zonaNormalizada] || [];



  if (!orden.length) {

    return false;

  }



  return (

    normalizarJerarquia(vendedor) ===

    normalizarJerarquia(orden[0])

  );

}



function ordenarJerarquiaZona(

  zona: string,

  lista: ReporteRow[]

): ReporteRow[] {

  const zonaNormalizada = normalizarJerarquia(zona);

  const orden = JERARQUIA_ZONA[zonaNormalizada] || [];



  if (!orden.length) {

    return [...lista].sort((a, b) =>

      normalizarJerarquia(a.vendedor).localeCompare(

        normalizarJerarquia(b.vendedor),

        "es"

      )

    );

  }



  const posiciones = new Map(

    orden.map((nombre, index) => [

      normalizarJerarquia(nombre),

      index,

    ])

  );



  return [...lista].sort((a, b) => {

    const nombreA = normalizarJerarquia(a.vendedor);

    const nombreB = normalizarJerarquia(b.vendedor);



    const posA = posiciones.has(nombreA)

      ? posiciones.get(nombreA)!

      : 999;



    const posB = posiciones.has(nombreB)

      ? posiciones.get(nombreB)!

      : 999;



    if (posA !== posB) {

      return posA - posB;

    }



    return nombreA.localeCompare(nombreB, "es");

  });

}



export default function AvanceDiarioPage() {



  const supabase = useMemo(



    () => createClientComponentClient(),



    []



  );



  const [rows, setRows] =



    useState<ReporteRow[]>([]);



  const [fechaCorte, setFechaCorte] =



    useState("");



  const [fechaDesde, setFechaDesde] =



    useState("");



  const [fechaHasta, setFechaHasta] =



    useState("");



  const [zonaFiltro, setZonaFiltro] =



    useState("TODAS");



  const [divisionFiltro, setDivisionFiltro] =



    useState("TODAS");



  const [equipoFiltro, setEquipoFiltro] =



    useState("TODOS");



  const [loading, setLoading] =



    useState(true);



  const [error, setError] =



    useState("");



  // =========================================================



  // OBTENER ÚLTIMA FECHA DISPONIBLE DENTRO DEL RANGO



  // =========================================================



  const obtenerUltimaFecha =



    useCallback(



      async (desde: string, hasta: string) => {



        const {



          data,



          error,



        } = await supabase



          .from(



            "reporte_ventas_diario"



          )



          .select("fecha_corte")



          .gte(



            "fecha_corte",



            desde



          )



          .lte(



            "fecha_corte",



            hasta



          )



          .order(



            "fecha_corte",



            {



              ascending: false,



            }



          )



          .limit(1);



        if (error) {



          throw error;



        }



        return (



          data?.[0]



            ?.fecha_corte || ""



        );



      },



      [supabase]



    );



  // =========================================================



  // CARGAR DATOS



  // Toma el último corte disponible dentro de Desde / Hasta.



  // No suma cortes diarios, porque cada corte ya viene acumulado.



  // =========================================================



  const cargar =



    useCallback(



      async (



        desdeSolicitada: string,



        hastaSolicitada: string



      ) => {



        try {



          setLoading(true);



          setError("");



          const desde =



            desdeSolicitada || "";



          const hasta =



            hastaSolicitada || "";



          if (!desde || !hasta) {



            setRows([]);



            setFechaCorte("");



            setError(



              "Debes indicar las fechas Desde y Hasta."



            );



            return;



          }



          if (desde > hasta) {



            setRows([]);



            setFechaCorte("");



            setError(



              "La fecha Desde no puede ser posterior a la fecha Hasta."



            );



            return;



          }



          const fecha =



            await obtenerUltimaFecha(



              desde,



              hasta



            );



          if (!fecha) {



            setRows([]);



            setFechaCorte("");



            setError(



              `No existen datos disponibles entre ${desde} y ${hasta}.`



            );



            return;



          }



          setFechaCorte(fecha);



          const {



            data,



            error,



          } = await supabase



            .from(



              "reporte_ventas_diario"



            )



            .select(`



              fecha_corte,



              anio,



              mes,



              slpcode,



              vendedor,



              zona,



              division,



              equipo,



              meta_mes,



              facturado_quimicos,



              facturado_otros,



              facturado_total,



              pedidos_quimicos,



              pedidos_otros,



              pedidos_total,



              entregas_quimicos,



              entregas_otros,



              entregas_total,



              cierre_quimicos,



              cierre_otros,



              cierre_total,



              synced_at



            `)



            .eq(



              "fecha_corte",



              fecha



            )



            .order("zona")



            .order("vendedor");



          if (error) {



            throw error;



          }



          setRows(



            (data ||



              []) as ReporteRow[]



          );



        } catch (err: any) {



          console.error(err);



          setError(



            err?.message ||



              "No fue posible cargar el Avance Diario."



          );



        } finally {



          setLoading(false);



        }



      },



      [



        supabase,



        obtenerUltimaFecha,



      ]



    );



  // =========================================================



  // CARGA INICIAL



  // Desde = primer día del mes actual / Hasta = hoy.



  // =========================================================



  useEffect(() => {



    const rango = rangoMesActual();



    setFechaDesde(rango.desde);



    setFechaHasta(rango.hasta);



    cargar(



      rango.desde,



      rango.hasta



    );



  }, [cargar]);



  // =========================================================



  // REFRESCO AUTOMÁTICO CADA 5 MIN



  // Conserva el rango seleccionado y busca el último corte disponible.



  // =========================================================



  useEffect(() => {



    if (



      !fechaDesde ||



      !fechaHasta



    ) {



      return;



    }



    const interval =



      window.setInterval(() => {



        cargar(



          fechaDesde,



          fechaHasta



        );



      }, 5 * 60 * 1000);



    return () =>



      window.clearInterval(



        interval



      );



  }, [



    fechaDesde,



    fechaHasta,



    cargar,



  ]);



  // =========================================================



  // FILTROS



  // =========================================================



  const zonas =



    useMemo(() => {



      return [



        ...new Set(



          rows



            .map(



              (r) =>



                r.zona || ""



            )



            .filter(Boolean)



        ),



      ].sort();



    }, [rows]);



  const divisiones =



    useMemo(() => {



      return [



        ...new Set(



          rows



            .filter(



              (r) =>



                zonaFiltro ===



                  "TODAS" ||



                r.zona ===



                  zonaFiltro



            )



            .map(



              (r) =>



                r.division ||



                ""



            )



            .filter(Boolean)



        ),



      ].sort();



    }, [



      rows,



      zonaFiltro,



    ]);



  const equipos =



    useMemo(() => {



      return [



        ...new Set(



          rows



            .filter(



              (r) => {



                if (



                  zonaFiltro !==



                    "TODAS" &&



                  r.zona !==



                    zonaFiltro



                ) {



                  return false;



                }



                if (



                  divisionFiltro !==



                    "TODAS" &&



                  r.division !==



                    divisionFiltro



                ) {



                  return false;



                }



                return true;



              }



            )



            .map(



              (r) =>



                r.equipo || ""



            )



            .filter(Boolean)



        ),



      ].sort();



    }, [



      rows,



      zonaFiltro,



      divisionFiltro,



    ]);



  const filtrados =



    useMemo(() => {



      return rows.filter(



        (r) => {



          if (



            zonaFiltro !==



              "TODAS" &&



            r.zona !==



              zonaFiltro



          ) {



            return false;



          }



          if (



            divisionFiltro !==



              "TODAS" &&



            r.division !==



              divisionFiltro



          ) {



            return false;



          }



          if (



            equipoFiltro !==



              "TODOS" &&



            r.equipo !==



              equipoFiltro



          ) {



            return false;



          }



          return true;



        }



      );



    }, [



      rows,



      zonaFiltro,



      divisionFiltro,



      equipoFiltro,



    ]);



  useEffect(() => {



    setDivisionFiltro(



      "TODAS"



    );



    setEquipoFiltro(



      "TODOS"



    );



  }, [zonaFiltro]);



  useEffect(() => {



    setEquipoFiltro(



      "TODOS"



    );



  }, [divisionFiltro]);



  // =========================================================



  // TOTALIZAR



  // =========================================================



  function totalizar(



    lista: ReporteRow[]



  ) {



    const total = {



      meta: 0,



      facturadoQuimicos: 0,



      facturadoOtros: 0,



      facturadoTotal: 0,



      pedidosQuimicos: 0,



      pedidosOtros: 0,



      pedidosTotal: 0,



      entregasQuimicos: 0,



      entregasOtros: 0,



      entregasTotal: 0,



      cierreQuimicos: 0,



      cierreOtros: 0,



      cierreTotal: 0,



    };



    lista.forEach((r) => {



      total.meta +=



        num(r.meta_mes);



      total.facturadoQuimicos +=



        num(



          r.facturado_quimicos



        );



      total.facturadoOtros +=



        num(



          r.facturado_otros



        );



      total.facturadoTotal +=



        num(



          r.facturado_total



        );



      total.pedidosQuimicos +=



        num(



          r.pedidos_quimicos



        );



      total.pedidosOtros +=



        num(



          r.pedidos_otros



        );



      total.pedidosTotal +=



        num(



          r.pedidos_total



        );



      total.entregasQuimicos +=



        num(



          r.entregas_quimicos



        );



      total.entregasOtros +=



        num(



          r.entregas_otros



        );



      total.entregasTotal +=



        num(



          r.entregas_total



        );



      total.cierreQuimicos +=



        num(



          r.cierre_quimicos



        );



      total.cierreOtros +=



        num(



          r.cierre_otros



        );



      total.cierreTotal +=



        num(



          r.cierre_total



        );



    });



    return {



      ...total,



      avance:



        total.meta > 0



          ? (



              total.facturadoQuimicos /



              total.meta



            ) *



            100



          : 0,



      cierrePct:



        total.meta > 0



          ? (



              total.cierreQuimicos /



              total.meta



            ) *



            100



          : 0,



      faltante:



        total.meta -



        total.facturadoQuimicos,



    };



  }



  const totalGeneral =



    useMemo(



      () =>



        totalizar(



          filtrados



        ),



      [filtrados]



    );



  // =========================================================



  // AGRUPAR POR ZONA



  // =========================================================



  const grupos =



    useMemo(() => {



      const mapa =



        new Map<



          string,



          ReporteRow[]



        >();



      filtrados.forEach(



        (r) => {



          const zona =



            r.zona ||



            "SIN ZONA";



          if (



            !mapa.has(zona)



          ) {



            mapa.set(



              zona,



              []



            );



          }



          mapa



            .get(zona)!



            .push(r);



        }



      );



      const orden: Record<



        string,



        number



      > = {



        CENTRO: 1,



        NORTE: 2,



        SUR: 3,



      };



      return [

        ...mapa.entries(),

      ]

        .map(

          ([zona, lista]) =>

            [

              zona,

              ordenarJerarquiaZona(

                zona,

                lista

              ),

            ] as [string, ReporteRow[]]

        )

        .sort(

          ([a], [b]) =>

            (orden[a] || 99) -

            (orden[b] || 99)

        );



    }, [filtrados]);



  // =========================================================



  // JERARQUÍA: DIVISIÓN → EQUIPO → ZONA → VENDEDOR



  // =========================================================



  const jerarquiaDetalle = useMemo(() => {

    const divisionesMapa = new Map<

      string,

      Map<string, Map<string, ReporteRow[]>>

    >();



    filtrados.forEach((row) => {

      const division = row.division || "SIN DIVISIÓN";

      const equipo = row.equipo || "SIN EQUIPO";

      const zona = row.zona || "SIN ZONA";



      if (!divisionesMapa.has(division)) {

        divisionesMapa.set(division, new Map());

      }



      const equiposMapa = divisionesMapa.get(division)!;



      if (!equiposMapa.has(equipo)) {

        equiposMapa.set(equipo, new Map());

      }



      const zonasMapa = equiposMapa.get(equipo)!;



      if (!zonasMapa.has(zona)) {

        zonasMapa.set(zona, []);

      }



      zonasMapa.get(zona)!.push(row);

    });



    const ordenZona: Record<string, number> = {

      CENTRO: 1,

      NORTE: 2,

      SUR: 3,

    };



    const ordenDivision = (nombre: string) => {

      const n = normalizarJerarquia(nombre);

      if (n.includes("INDUSTRIAL")) return 1;

      if (n.includes("FOOD")) return 2;

      if (n.includes("HC")) return 3;

      return 99;

    };



    return [...divisionesMapa.entries()]

      .sort(([a], [b]) => {

        const oa = ordenDivision(a);

        const ob = ordenDivision(b);

        return oa !== ob

          ? oa - ob

          : normalizarJerarquia(a).localeCompare(

              normalizarJerarquia(b),

              "es"

            );

      })

      .map(([division, equiposMapa]) => ({

        division,

        gerente: obtenerGerenteDivision(division),

        equipos: [...equiposMapa.entries()]

          .sort(([a], [b]) =>

            normalizarJerarquia(a).localeCompare(

              normalizarJerarquia(b),

              "es"

            )

          )

          .map(([equipo, zonasMapa]) => ({

            equipo,

            responsable: obtenerResponsableEquipo(equipo),

            zonas: [...zonasMapa.entries()]

              .sort(

                ([a], [b]) =>

                  (ordenZona[normalizarJerarquia(a)] || 99) -

                    (ordenZona[normalizarJerarquia(b)] || 99) ||

                  normalizarJerarquia(a).localeCompare(

                    normalizarJerarquia(b),

                    "es"

                  )

              )

              .map(([zona, lista]) => ({

                zona,

                responsableZona: obtenerResponsableZona(

                  zona,

                  equipo

                ),

                lista: ordenarVendedoresJerarquia(

                  zona,

                  equipo,

                  lista

                ),

              })),

          })),

      }));

  }, [filtrados]);



  // =========================================================



  // ÚLTIMA SINCRONIZACIÓN



  // =========================================================



  const ultimaSync =



    useMemo(() => {



      if (



        rows.length === 0



      ) {



        return null;



      }



      const fechas =



        rows



          .map(



            (r) =>



              r.synced_at



          )



          .filter(



            (



              x



            ): x is string =>



              !!x



          )



          .map(



            (x) =>



              new Date(x)



          )



          .sort(



            (a, b) =>



              b.getTime() -



              a.getTime()



          );



      return fechas[0]



        ? fechas[0].toISOString()



        : null;



    }, [rows]);



  // =========================================================

  // RENDER

  // =========================================================



  return (

    <div className="space-y-6 pb-8">

      {/* =====================================================

          HERO

      ====================================================== */}

      <section className="overflow-hidden rounded-3xl bg-gradient-to-r from-[#123a9c] via-[#1f4ed8] to-[#2B6CFF] text-white shadow-lg shadow-blue-900/10">

        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_340px] lg:items-center lg:p-8">

          <div>

            <div className="mb-3 flex flex-wrap items-center gap-2">

              <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-50">

                Reporte comercial

              </span>

              <span className="flex items-center gap-2 rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-medium text-emerald-50">

                <span className="h-2 w-2 rounded-full bg-emerald-300" />

                SAP sincronizado

              </span>

            </div>



            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">

              Avance Diario

            </h1>



            <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100 md:text-base">

              Seguimiento de ventas, metas, pedidos, entregas y cierre potencial por zona y vendedor.

            </p>



            <div className="mt-5 flex flex-wrap gap-3 text-xs text-blue-100">

              <span className="rounded-lg bg-white/10 px-3 py-2">

                Corte: <strong className="text-white">{fechaCorte || "—"}</strong>

              </span>

              <span className="rounded-lg bg-white/10 px-3 py-2">

                Última sincronización: <strong className="text-white">{formatSync(ultimaSync)}</strong>

              </span>

            </div>

          </div>



          <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">

            <div className="flex items-end justify-between gap-4">

              <div>

                <p className="text-xs font-semibold uppercase tracking-wider text-blue-100">

                  Avance químicos

                </p>

                <p className="mt-1 text-4xl font-bold">

                  {pct(totalGeneral.avance)}

                </p>

              </div>

              <div className="text-right text-xs text-blue-100">

                <div>Venta Q</div>

                <div className="mt-1 text-sm font-semibold text-white">

                  {money(totalGeneral.facturadoQuimicos)}

                </div>

              </div>

            </div>



            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/20">

              <div

                className="h-full rounded-full bg-white transition-all duration-500"

                style={{ width: `${Math.min(Math.max(totalGeneral.avance, 0), 100)}%` }}

              />

            </div>



            <div className="mt-3 flex items-center justify-between text-xs text-blue-100">

              <span>Meta {money(totalGeneral.meta)}</span>

              <span>

                {totalGeneral.faltante <= 0

                  ? "Meta alcanzada"

                  : `Faltan ${money(totalGeneral.faltante)}`}

              </span>

            </div>

          </div>

        </div>

      </section>



      {/* =====================================================

          FILTROS

      ====================================================== */}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">

        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

          <div>

            <h2 className="font-bold text-slate-900">Filtros del reporte</h2>

            <p className="mt-1 text-xs text-slate-500">

              Ajusta la vista por período, zona, división o equipo.

            </p>

          </div>



          <Link

            href="/tablero-control"

            className="text-sm font-semibold text-[#1f4ed8] hover:underline"

          >

            ← Volver al Tablero

          </Link>

        </div>



        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">

          <Filtro label="Desde">

            <input

              type="date"

              value={fechaDesde}

              onChange={(e) => setFechaDesde(e.target.value)}

              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"

            />

          </Filtro>



          <Filtro label="Hasta">

            <input

              type="date"

              value={fechaHasta}

              onChange={(e) => setFechaHasta(e.target.value)}

              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"

            />

          </Filtro>



          <Filtro label="Zona">

            <select

              value={zonaFiltro}

              onChange={(e) => setZonaFiltro(e.target.value)}

              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"

            >

              <option value="TODAS">Todas</option>

              {zonas.map((z) => (

                <option key={z} value={z}>

                  {z}

                </option>

              ))}

            </select>

          </Filtro>



          <Filtro label="División">

            <select

              value={divisionFiltro}

              onChange={(e) => setDivisionFiltro(e.target.value)}

              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"

            >

              <option value="TODAS">Todas</option>

              {divisiones.map((d) => (

                <option key={d} value={d}>

                  {d}

                </option>

              ))}

            </select>

          </Filtro>



          <Filtro label="Equipo">

            <select

              value={equipoFiltro}

              onChange={(e) => setEquipoFiltro(e.target.value)}

              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"

            >

              <option value="TODOS">Todos</option>

              {equipos.map((e) => (

                <option key={e} value={e}>

                  {e}

                </option>

              ))}

            </select>

          </Filtro>



          <div className="flex items-end">

            <button

              onClick={() => cargar(fechaDesde, fechaHasta)}

              disabled={loading}

              className="w-full rounded-xl bg-[#1f4ed8] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#163bb8] disabled:cursor-not-allowed disabled:opacity-50"

            >

              {loading ? "Actualizando..." : "Actualizar datos"}

            </button>

          </div>

        </div>

      </section>



      {error && (

        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">

          {error}

        </div>

      )}



      {/* =====================================================

          KPIs

      ====================================================== */}

      <section>

        <div className="mb-3 flex items-end justify-between">

          <div>

            <h2 className="text-lg font-bold text-slate-900">Indicadores generales</h2>

            <p className="mt-1 text-xs text-slate-500">

              Resultado consolidado según los filtros seleccionados.

            </p>

          </div>

        </div>



        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <Kpi

            titulo="Meta Químicos"

            valor={money(totalGeneral.meta)}

            detalle="Meta mensual"

            tono="azul"

          />



          <Kpi

            titulo="Venta Químicos"

            valor={money(totalGeneral.facturadoQuimicos)}

            detalle={`${pct(totalGeneral.avance)} de la meta`}

            tono="indigo"

            progreso={totalGeneral.avance}

          />



          <Kpi

            titulo="Venta Total"

            valor={money(totalGeneral.facturadoTotal)}

            detalle={`Otros: ${money(totalGeneral.facturadoOtros)}`}

            tono="verde"

          />



          <Kpi

            titulo="Faltante Meta"

            valor={money(Math.max(totalGeneral.faltante, 0))}

            detalle={totalGeneral.faltante <= 0 ? "Meta alcanzada" : "Sólo químicos"}

            tono={totalGeneral.faltante <= 0 ? "verde" : "ambar"}

          />



          <Kpi

            titulo="Pedidos Abiertos"

            valor={money(totalGeneral.pedidosTotal)}

            detalle={`Químicos: ${money(totalGeneral.pedidosQuimicos)}`}

            tono="violeta"

          />



          <Kpi

            titulo="Entregas"

            valor={money(totalGeneral.entregasTotal)}

            detalle={`Químicos: ${money(totalGeneral.entregasQuimicos)}`}

            tono="celeste"

          />



          <Kpi

            titulo="Cierre Potencial Q"

            valor={money(totalGeneral.cierreQuimicos)}

            detalle={`${pct(totalGeneral.cierrePct)} de la meta`}

            tono="indigo"

            progreso={totalGeneral.cierrePct}

          />



          <Kpi

            titulo="Cierre Potencial Total"

            valor={money(totalGeneral.cierreTotal)}

            detalle={`Otros: ${money(totalGeneral.cierreOtros)}`}

            tono="esmeralda"

          />

        </div>

      </section>



      {/* =====================================================

          RESUMEN POR ZONA

      ====================================================== */}

      <section>

        <div className="mb-3">

          <h2 className="text-lg font-bold text-slate-900">Resumen por Zona</h2>

          <p className="mt-1 text-xs text-slate-500">

            Comparación rápida de cumplimiento comercial por territorio.

          </p>

        </div>



        {grupos.length === 0 ? (

          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">

            No existen datos para los filtros seleccionados.

          </div>

        ) : (

          <div className="grid gap-4 xl:grid-cols-3">

            {grupos.map(([zona, lista]) => {

              const t = totalizar(lista);



              return (

                <ZonaCard

                  key={zona}

                  zona={zona}

                  total={t}

                  vendedores={lista.length}

                />

              );

            })}

          </div>

        )}

      </section>



      {/* =====================================================

          DETALLE VENDEDORES AGRUPADO POR ZONA

      ====================================================== */}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

        <div className="flex flex-col gap-3 border-b border-slate-200 bg-white px-5 py-5 sm:flex-row sm:items-center sm:justify-between">

          <div>

            <h2 className="text-lg font-bold text-slate-900">Detalle por Vendedor</h2>

            <p className="mt-1 text-xs text-slate-500">

              Jerarquía comercial por división, equipo y zona, con responsables y semáforo de cumplimiento.

            </p>

          </div>



          <div className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">

            {filtrados.length} vendedor{filtrados.length === 1 ? "" : "es"}

          </div>

        </div>



        <div className="max-h-[720px] overflow-auto">

          <table className="min-w-[1550px] w-full border-collapse text-xs">

            <thead className="sticky top-0 z-20 bg-slate-900 text-white shadow-sm">

              <tr>

                <Th oscuro>Zona</Th>

                <Th oscuro>Vendedor</Th>

                <Th oscuro>División</Th>

                <Th oscuro>Equipo</Th>

                <Th oscuro>Meta Q</Th>

                <Th oscuro>Venta Q</Th>

                <Th oscuro>% Avance</Th>

                <Th oscuro>Otros</Th>

                <Th oscuro>Venta Total</Th>

                <Th oscuro>Pedidos</Th>

                <Th oscuro>Entregas</Th>

                <Th oscuro>Cierre Q</Th>

                <Th oscuro>% Cierre</Th>

                <Th oscuro>Cierre Total</Th>

              </tr>

            </thead>



            <tbody>

              {jerarquiaDetalle.map((divisionItem) => {

                const filasDivision = divisionItem.equipos.flatMap((equipo) =>

                  equipo.zonas.flatMap((zona) => zona.lista)

                );

                const totalDivision = totalizar(filasDivision);



                return (

                  <React.Fragment key={divisionItem.division}>

                    <tr className="bg-slate-950 text-white">

                      <td colSpan={14} className="px-4 py-3.5">

                        <div className="flex flex-wrap items-center justify-between gap-3">

                          <div className="flex flex-wrap items-center gap-3">

                            <span className="rounded-lg bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em]">

                              División

                            </span>

                            <span className="text-sm font-bold">

                              {divisionItem.division}

                            </span>

                            {divisionItem.gerente && (

                              <span className="rounded-full bg-indigo-500/30 px-3 py-1 text-[10px] font-semibold text-indigo-100">

                                Gerente: {divisionItem.gerente.nombre}

                              </span>

                            )}

                          </div>



                          <div className="flex items-center gap-4 text-xs text-slate-200">

                            <span>

                              Venta Q: <strong className="text-white">{money(totalDivision.facturadoQuimicos)}</strong>

                            </span>

                            <span>

                              Avance: <strong className="text-white">{pct(totalDivision.avance)}</strong>

                            </span>

                          </div>

                        </div>

                      </td>

                    </tr>



                    {divisionItem.equipos.map((equipoItem) => {

                      const filasEquipo = equipoItem.zonas.flatMap(

                        (zona) => zona.lista

                      );

                      const totalEquipo = totalizar(filasEquipo);



                      return (

                        <React.Fragment

                          key={`${divisionItem.division}-${equipoItem.equipo}`}

                        >

                          <tr className="border-b border-slate-300 bg-slate-100">

                            <td colSpan={14} className="px-4 py-3">

                              <div className="flex flex-wrap items-center justify-between gap-3">

                                <div className="flex flex-wrap items-center gap-3">

                                  <span className="rounded-md bg-slate-800 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">

                                    Equipo

                                  </span>

                                  <span className="font-bold text-slate-800">

                                    {equipoItem.equipo}

                                  </span>

                                  {equipoItem.responsable && (

                                    <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-[10px] font-semibold text-slate-700">

                                      {equipoItem.responsable.rol}: {equipoItem.responsable.nombre}

                                    </span>

                                  )}

                                </div>



                                <div className="flex items-center gap-4 text-[11px] text-slate-600">

                                  <span>

                                    Venta Q: <strong>{money(totalEquipo.facturadoQuimicos)}</strong>

                                  </span>

                                  <span>

                                    Avance: <strong>{pct(totalEquipo.avance)}</strong>

                                  </span>

                                </div>

                              </div>

                            </td>

                          </tr>



                          {equipoItem.zonas.map((zonaItem) => {

                            const t = totalizar(zonaItem.lista);

                            const tema = zonaTema(zonaItem.zona);



                            return (

                              <React.Fragment

                                key={`${divisionItem.division}-${equipoItem.equipo}-${zonaItem.zona}`}

                              >

                                <tr className={`${tema.encabezado} text-white`}>

                                  <td colSpan={14} className="px-4 py-3">

                                    <div className="flex flex-wrap items-center justify-between gap-3">

                                      <div className="flex flex-wrap items-center gap-3">

                                        <span className="rounded-lg bg-white/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider">

                                          Zona

                                        </span>

                                        <span className="text-sm font-bold tracking-wide">

                                          {zonaItem.zona}

                                        </span>

                                        {zonaItem.responsableZona && (

                                          <span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-semibold">

                                            {zonaItem.responsableZona.rol}: {zonaItem.responsableZona.nombre}

                                          </span>

                                        )}

                                        <span className="text-xs text-white/80">

                                          {zonaItem.lista.length} vendedor{zonaItem.lista.length === 1 ? "" : "es"}

                                        </span>

                                      </div>



                                      <div className="flex items-center gap-4 text-xs">

                                        <span>

                                          Venta Q: <strong>{money(t.facturadoQuimicos)}</strong>

                                        </span>

                                        <span>

                                          Avance: <strong>{pct(t.avance)}</strong>

                                        </span>

                                      </div>

                                    </div>

                                  </td>

                                </tr>



                                <FilaTotalZona

                                  zona={zonaItem.zona}

                                  total={t}

                                />



                                {zonaItem.lista.map((r, index) => (

                                  <FilaVendedor

                                    key={`${r.fecha_corte}-${r.slpcode}`}

                                    row={r}

                                    index={index}

                                    zona={zonaItem.zona}

                                    rolJerarquico={obtenerRolJerarquico(r)}

                                  />

                                ))}

                              </React.Fragment>

                            );

                          })}

                        </React.Fragment>

                      );

                    })}

                  </React.Fragment>

                );

              })}

            </tbody>

          </table>

        </div>

      </section>

    </div>

  );

}



// =========================================================

// COMPONENTES

// =========================================================



function zonaTema(zona: string) {

  const z = String(zona || "").toUpperCase();



  if (z === "CENTRO") {

    return {

      encabezado: "bg-blue-600",

      suave: "bg-blue-50",

      borde: "border-blue-200",

      texto: "text-blue-700",

      barra: "bg-blue-500",

      halo: "shadow-blue-100",

    };

  }



  if (z === "NORTE") {

    return {

      encabezado: "bg-amber-500",

      suave: "bg-amber-50",

      borde: "border-amber-200",

      texto: "text-amber-700",

      barra: "bg-amber-500",

      halo: "shadow-amber-100",

    };

  }



  if (z === "SUR") {

    return {

      encabezado: "bg-emerald-600",

      suave: "bg-emerald-50",

      borde: "border-emerald-200",

      texto: "text-emerald-700",

      barra: "bg-emerald-500",

      halo: "shadow-emerald-100",

    };

  }



  return {

    encabezado: "bg-slate-600",

    suave: "bg-slate-50",

    borde: "border-slate-200",

    texto: "text-slate-700",

    barra: "bg-slate-500",

    halo: "shadow-slate-100",

  };

}



function Filtro({

  label,

  children,

}: {

  label: string;

  children: React.ReactNode;

}) {

  return (

    <div>

      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">

        {label}

      </label>

      {children}

    </div>

  );

}



type KpiTono =

  | "azul"

  | "indigo"

  | "verde"

  | "ambar"

  | "violeta"

  | "celeste"

  | "esmeralda";



function Kpi({

  titulo,

  valor,

  detalle,

  tono,

  progreso,

}: {

  titulo: string;

  valor: string;

  detalle: string;

  tono: KpiTono;

  progreso?: number;

}) {

  const estilos: Record<

    KpiTono,

    {

      fondo: string;

      borde: string;

      etiqueta: string;

      barra: string;

      detalle: string;

    }

  > = {

    azul: {

      fondo: "bg-blue-50/70",

      borde: "border-blue-200",

      etiqueta: "text-blue-700",

      barra: "bg-blue-500",

      detalle: "text-blue-700",

    },

    indigo: {

      fondo: "bg-indigo-50/70",

      borde: "border-indigo-200",

      etiqueta: "text-indigo-700",

      barra: "bg-indigo-500",

      detalle: "text-indigo-700",

    },

    verde: {

      fondo: "bg-green-50/70",

      borde: "border-green-200",

      etiqueta: "text-green-700",

      barra: "bg-green-500",

      detalle: "text-green-700",

    },

    ambar: {

      fondo: "bg-amber-50/70",

      borde: "border-amber-200",

      etiqueta: "text-amber-700",

      barra: "bg-amber-500",

      detalle: "text-amber-700",

    },

    violeta: {

      fondo: "bg-violet-50/70",

      borde: "border-violet-200",

      etiqueta: "text-violet-700",

      barra: "bg-violet-500",

      detalle: "text-violet-700",

    },

    celeste: {

      fondo: "bg-cyan-50/70",

      borde: "border-cyan-200",

      etiqueta: "text-cyan-700",

      barra: "bg-cyan-500",

      detalle: "text-cyan-700",

    },

    esmeralda: {

      fondo: "bg-emerald-50/70",

      borde: "border-emerald-200",

      etiqueta: "text-emerald-700",

      barra: "bg-emerald-500",

      detalle: "text-emerald-700",

    },

  };



  const e = estilos[tono];



  return (

    <div

      className={`relative overflow-hidden rounded-2xl border ${e.borde} ${e.fondo} p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md`}

    >

      <div className={`absolute left-0 top-0 h-full w-1 ${e.barra}`} />



      <div className={`text-[11px] font-bold uppercase tracking-wider ${e.etiqueta}`}>

        {titulo}

      </div>



      <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">

        {valor}

      </div>



      {progreso !== undefined && (

        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/80">

          <div

            className={`h-full rounded-full ${e.barra}`}

            style={{ width: `${Math.min(Math.max(progreso, 0), 100)}%` }}

          />

        </div>

      )}



      <div className={`mt-2 text-xs font-semibold ${e.detalle}`}>

        {detalle}

      </div>

    </div>

  );

}



function Progreso({

  value,

  compact = false,

}: {

  value: number;

  compact?: boolean;

}) {

  const ancho = Math.min(Math.max(value, 0), 100);



  const barra =

    value >= 100

      ? "bg-emerald-500"

      : value >= 80

      ? "bg-amber-400"

      : "bg-red-400";



  return (

    <div className={compact ? "min-w-[120px]" : "min-w-[145px]"}>

      <div className="flex items-center justify-between gap-2">

        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${clasePct(value)}`}>

          {pct(value)}

        </span>

      </div>

      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">

        <div

          className={`h-full rounded-full ${barra}`}

          style={{ width: `${ancho}%` }}

        />

      </div>

    </div>

  );

}



function ZonaCard({

  zona,

  total,

  vendedores,

}: {

  zona: string;

  total: TotalReporte;

  vendedores: number;

}) {

  const tema = zonaTema(zona);



  return (

    <div

      className={`overflow-hidden rounded-2xl border ${tema.borde} bg-white shadow-sm ${tema.halo}`}

    >

      <div className={`${tema.encabezado} px-5 py-4 text-white`}>

        <div className="flex items-center justify-between gap-3">

          <div>

            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75">

              Zona

            </div>

            <div className="mt-1 text-xl font-bold">{zona}</div>

          </div>

          <div className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">

            {vendedores} vendedor{vendedores === 1 ? "" : "es"}

          </div>

        </div>

      </div>



      <div className="p-5">

        <div className="grid grid-cols-2 gap-4">

          <DatoZona label="Meta Q" value={money(total.meta)} />

          <DatoZona label="Venta Q" value={money(total.facturadoQuimicos)} fuerte />

          <DatoZona label="Venta Total" value={money(total.facturadoTotal)} />

          <DatoZona label="Cierre Q" value={money(total.cierreQuimicos)} />

        </div>



        <div className={`mt-5 rounded-xl ${tema.suave} p-3`}>

          <div className="flex items-center justify-between gap-3">

            <span className={`text-xs font-bold ${tema.texto}`}>Avance de meta</span>

            <span className={`text-sm font-bold ${tema.texto}`}>{pct(total.avance)}</span>

          </div>

          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">

            <div

              className={`h-full rounded-full ${tema.barra}`}

              style={{ width: `${Math.min(Math.max(total.avance, 0), 100)}%` }}

            />

          </div>

        </div>

      </div>

    </div>

  );

}



function DatoZona({

  label,

  value,

  fuerte = false,

}: {

  label: string;

  value: string;

  fuerte?: boolean;

}) {

  return (

    <div>

      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">

        {label}

      </div>

      <div className={`mt-1 text-sm ${fuerte ? "font-bold text-slate-900" : "font-semibold text-slate-700"}`}>

        {value}

      </div>

    </div>

  );

}



function Th({

  children,

  oscuro = false,

}: {

  children: React.ReactNode;

  oscuro?: boolean;

}) {

  return (

    <th

      className={`border-r px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider last:border-r-0 ${

        oscuro

          ? "border-slate-700 text-slate-200"

          : "border-slate-200 text-slate-600"

      }`}

    >

      {children}

    </th>

  );

}



function Td({

  children,

  izquierda = false,

  fuerte = false,

  clase = "",

}: {

  children: React.ReactNode;

  izquierda?: boolean;

  fuerte?: boolean;

  clase?: string;

}) {

  return (

    <td

      className={`border-b border-r border-slate-200 px-3 py-2.5 last:border-r-0 ${

        izquierda ? "text-left" : "text-right"

      } ${fuerte ? "font-semibold" : ""} ${clase}`}

    >

      {children}

    </td>

  );

}



function FilaTotalZona({

  zona,

  total,

}: {

  zona: string;

  total: TotalReporte;

}) {

  const tema = zonaTema(zona);



  return (

    <tr className={`${tema.suave} font-semibold`}>

      <Td izquierda clase={`${tema.texto} font-bold`}>

        {zona}

      </Td>

      <Td izquierda clase="font-bold text-slate-900">

        TOTAL {zona}

      </Td>

      <Td izquierda>—</Td>

      <Td izquierda>—</Td>

      <Td>{money(total.meta)}</Td>

      <Td fuerte>{money(total.facturadoQuimicos)}</Td>

      <Td>

        <Progreso value={total.avance} compact />

      </Td>

      <Td>{money(total.facturadoOtros)}</Td>

      <Td fuerte>{money(total.facturadoTotal)}</Td>

      <Td>{money(total.pedidosTotal)}</Td>

      <Td>{money(total.entregasTotal)}</Td>

      <Td>{money(total.cierreQuimicos)}</Td>

      <Td>

        <Progreso value={total.cierrePct} compact />

      </Td>

      <Td fuerte>{money(total.cierreTotal)}</Td>

    </tr>

  );

}



function FilaVendedor({

  row,

  index,

  zona,

  rolJerarquico = "",

}: {

  row: ReporteRow;

  index: number;

  zona: string;

  rolJerarquico?: string;

}) {

  const meta = num(row.meta_mes);

  const ventaQ = num(row.facturado_quimicos);

  const cierreQ = num(row.cierre_quimicos);



  const avance = meta > 0 ? (ventaQ / meta) * 100 : 0;

  const cierrePct = meta > 0 ? (cierreQ / meta) * 100 : 0;

  const tema = zonaTema(zona);

  const esLider = Boolean(rolJerarquico);



  return (

    <tr

      className={`transition ${

        esLider

          ? `${tema.suave} border-t-2 ${tema.borde}`

          : index % 2 === 0

          ? "bg-white hover:bg-blue-50/50"

          : "bg-slate-50/60 hover:bg-blue-50/50"

      }`}

    >

      <Td izquierda clase={esLider ? `${tema.texto} font-bold` : "text-slate-300"}>

        {esLider ? zona : ""}

      </Td>



      <Td

        izquierda

        fuerte={esLider}

        clase={

          esLider

            ? `${tema.texto} font-bold`

            : "text-slate-800"

        }

      >

        {esLider ? (

          <div className="flex items-center gap-2">

            <span

              className={`rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${tema.borde} ${tema.suave} ${tema.texto}`}

            >

              {rolJerarquico}

            </span>

            <span>{row.vendedor}</span>

          </div>

        ) : (

          <div className="flex items-center gap-2 pl-5">

            <span className="text-base leading-none text-slate-300">└</span>

            <span className="font-medium">{row.vendedor}</span>

          </div>

        )}

      </Td>



      <Td izquierda>{row.division || "—"}</Td>

      <Td izquierda>{row.equipo || "—"}</Td>

      <Td>{money(meta)}</Td>

      <Td>{money(ventaQ)}</Td>

      <Td>

        <Progreso value={avance} compact />

      </Td>

      <Td>{money(row.facturado_otros)}</Td>

      <Td fuerte>{money(row.facturado_total)}</Td>

      <Td>{money(row.pedidos_total)}</Td>

      <Td>{money(row.entregas_total)}</Td>

      <Td>{money(cierreQ)}</Td>

      <Td>

        <Progreso value={cierrePct} compact />

      </Td>

      <Td fuerte>{money(row.cierre_total)}</Td>

    </tr>

  );

}
