"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

type VentaRow = {
  anio: number;
  mes: number;
  vendedor: string;
  zona: string | null;
  gerencia: string | null;
  supervisor: string | null;
  division: string | null;
  equipo: string | null;
  venta_quimicos: number | string | null;
  venta_otros: number | string | null;
  venta_total: number | string | null;
};

type DiarioRow = {
  fecha_corte: string;
  anio: number;
  mes: number;
  vendedor: string;
  zona: string | null;
  division: string | null;
  equipo: string | null;
  facturado_quimicos: number | string | null;
  facturado_otros: number | string | null;
  facturado_total: number | string | null;
};

type Metrica = "venta_total" | "venta_quimicos" | "venta_otros";

type Resumen = {
  vendedor: string;
  zona: string;
  gerencia: string;
  supervisor: string;
  division: string;
  equipo: string;
  mesLY: number;
  mesCY: number;
  ytdLY: number;
  ytdCY: number;
};

type FuenteMes = {
  anio: number;
  mes: number;
  fuente: "diario" | "mensual" | "sin-datos";
  fechaCorte: string | null;
};

type ResultadoMes = {
  rows: VentaRow[];
  fuente: FuenteMes;
};

const MESES = [
  "",
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function num(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function money(value: unknown) {
  return num(value).toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}

function pct(value: number | null) {
  if (value === null) return "—";
  return `${value.toLocaleString("es-CL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function porcentajeCYLY(actual: number, anterior: number) {
  if (anterior === 0) return null;
  return (actual / anterior) * 100;
}

function claseCYLY(value: number | null) {
  if (value === null) return "bg-slate-100 text-slate-500";
  if (value > 100) return "bg-green-100 text-green-800";
  if (value < 100) return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-700";
}

function clean(value: string | null | undefined) {
  return String(value || "").trim();
}

function normalizarJerarquia(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function vendedorKey(nombre: string) {
  return normalizarJerarquia(nombre);
}

function zonaDe(row: { zona: string | null | undefined }) {
  return clean(row.zona) || "SIN CLASIFICAR";
}

function valorMetrica(row: VentaRow, metrica: Metrica) {
  return num(row[metrica]);
}

function fechaISOlocal(date: Date) {
  const anio = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, "0");
  const dia = String(date.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

function rangoMesActual() {
  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  return {
    desde: fechaISOlocal(inicioMes),
    hasta: fechaISOlocal(hoy),
  };
}

function partesFecha(fecha: string) {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return { anio, mes, dia };
}

function inicioMesISO(anio: number, mes: number) {
  return `${anio}-${String(mes).padStart(2, "0")}-01`;
}

function finMesISO(anio: number, mes: number) {
  const ultimo = new Date(anio, mes, 0).getDate();
  return `${anio}-${String(mes).padStart(2, "0")}-${String(ultimo).padStart(2, "0")}`;
}

function fechaEquivalenteOtroAnio(fecha: string, anioDestino: number) {
  const { mes, dia } = partesFecha(fecha);
  const maxDia = new Date(anioDestino, mes, 0).getDate();
  return `${anioDestino}-${String(mes).padStart(2, "0")}-${String(
    Math.min(dia, maxDia)
  ).padStart(2, "0")}`;
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

function obtenerGerenteDivision(division: string | null | undefined) {
  const valor = normalizarJerarquia(division);
  return (
    GERENTES_DIVISION.find((item) =>
      valor.includes(normalizarJerarquia(item.match))
    ) || null
  );
}

function obtenerResponsableEquipo(equipo: string | null | undefined) {
  const valor = normalizarJerarquia(equipo);
  return (
    RESPONSABLES_EQUIPO.find((item) =>
      valor.includes(normalizarJerarquia(item.match))
    ) || null
  );
}

function esEquipoPatricio(equipo: string | null | undefined) {
  return normalizarJerarquia(equipo).includes("PATRICIO ROCO");
}

function obtenerResponsableZona(
  zona: string | null | undefined,
  equipo: string | null | undefined
) {
  if (!esEquipoPatricio(equipo)) return null;

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

function obtenerRolJerarquico(row: Resumen) {
  const vendedor = normalizarJerarquia(row.vendedor);

  const gerente = obtenerGerenteDivision(row.division);
  if (gerente && vendedor === normalizarJerarquia(gerente.nombre)) {
    return gerente.rol;
  }

  const responsableEquipo = obtenerResponsableEquipo(row.equipo);
  if (
    responsableEquipo &&
    vendedor === normalizarJerarquia(responsableEquipo.nombre)
  ) {
    return responsableEquipo.rol;
  }

  const responsableZona = obtenerResponsableZona(row.zona, row.equipo);
  if (
    responsableZona &&
    vendedor === normalizarJerarquia(responsableZona.nombre)
  ) {
    return responsableZona.rol;
  }

  return "";
}

function ordenarJerarquiaZona(zona: string, lista: Resumen[]) {
  const orden = JERARQUIA_ZONA[normalizarJerarquia(zona)] || [];

  if (!orden.length) {
    return [...lista].sort((a, b) =>
      normalizarJerarquia(a.vendedor).localeCompare(
        normalizarJerarquia(b.vendedor),
        "es"
      )
    );
  }

  const posiciones = new Map(
    orden.map((nombre, index) => [normalizarJerarquia(nombre), index])
  );

  return [...lista].sort((a, b) => {
    const nombreA = normalizarJerarquia(a.vendedor);
    const nombreB = normalizarJerarquia(b.vendedor);
    const posA = posiciones.has(nombreA) ? posiciones.get(nombreA)! : 999;
    const posB = posiciones.has(nombreB) ? posiciones.get(nombreB)! : 999;

    if (posA !== posB) return posA - posB;
    return nombreA.localeCompare(nombreB, "es");
  });
}

function ordenarVendedoresJerarquia(
  zona: string,
  equipo: string,
  lista: Resumen[]
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

function zonaTema(zona: string) {
  const z = normalizarJerarquia(zona);

  if (z === "CENTRO") {
    return {
      encabezado: "bg-blue-600",
      suave: "bg-blue-50",
      borde: "border-blue-200",
      texto: "text-blue-700",
    };
  }

  if (z === "NORTE") {
    return {
      encabezado: "bg-amber-500",
      suave: "bg-amber-50",
      borde: "border-amber-200",
      texto: "text-amber-700",
    };
  }

  if (z === "SUR") {
    return {
      encabezado: "bg-emerald-600",
      suave: "bg-emerald-50",
      borde: "border-emerald-200",
      texto: "text-emerald-700",
    };
  }

  return {
    encabezado: "bg-slate-600",
    suave: "bg-slate-50",
    borde: "border-slate-200",
    texto: "text-slate-700",
  };
}

function totalResumen(lista: Resumen[]) {
  const total = lista.reduce(
    (acc, r) => {
      acc.mesLY += r.mesLY;
      acc.mesCY += r.mesCY;
      acc.ytdLY += r.ytdLY;
      acc.ytdCY += r.ytdCY;
      return acc;
    },
    { mesLY: 0, mesCY: 0, ytdLY: 0, ytdCY: 0 }
  );

  return {
    ...total,
    mesDif: total.mesCY - total.mesLY,
    mesVar: porcentajeCYLY(total.mesCY, total.mesLY),
    ytdDif: total.ytdCY - total.ytdLY,
    ytdVar: porcentajeCYLY(total.ytdCY, total.ytdLY),
  };
}

export default function ComparativoPage() {
  const supabase = useMemo(() => createClientComponentClient(), []);

  const [rows, setRows] = useState<VentaRow[]>([]);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [fuenteCY, setFuenteCY] = useState<FuenteMes | null>(null);
  const [fuenteLY, setFuenteLY] = useState<FuenteMes | null>(null);

  const [metrica, setMetrica] = useState<Metrica>("venta_total");
  const [zonaFiltro, setZonaFiltro] = useState("TODAS");
  const [gerenciaFiltro, setGerenciaFiltro] = useState("TODAS");
  const [supervisorFiltro, setSupervisorFiltro] = useState("TODOS");
  const [divisionFiltro, setDivisionFiltro] = useState("TODAS");
  const [equipoFiltro, setEquipoFiltro] = useState("TODOS");
  const [vendedorFiltro, setVendedorFiltro] = useState("TODOS");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const periodo = useMemo(() => {
    if (!fechaHasta) return { anio: 0, mes: 0 };
    const p = partesFecha(fechaHasta);
    return { anio: p.anio, mes: p.mes };
  }, [fechaHasta]);

  const obtenerUltimoCorte = useCallback(
    async (anio: number, mes: number, desde: string, hasta: string) => {
      const { data, error } = await supabase
        .from("reporte_ventas_diario")
        .select("fecha_corte")
        .eq("anio", anio)
        .eq("mes", mes)
        .gte("fecha_corte", desde)
        .lte("fecha_corte", hasta)
        .order("fecha_corte", { ascending: false })
        .limit(1);

      if (error) throw error;
      return data?.[0]?.fecha_corte || "";
    },
    [supabase]
  );

  const cargarMesPreferente = useCallback(
    async (
      anio: number,
      mes: number,
      desde: string,
      hasta: string,
      mensualFallback: VentaRow[]
    ): Promise<ResultadoMes> => {
      const fechaCorte = await obtenerUltimoCorte(anio, mes, desde, hasta);
      const fallbackMes = mensualFallback.filter(
        (r) => Number(r.anio) === anio && Number(r.mes) === mes
      );

      if (!fechaCorte) {
        return {
          rows: fallbackMes,
          fuente: {
            anio,
            mes,
            fuente: fallbackMes.length ? "mensual" : "sin-datos",
            fechaCorte: null,
          },
        };
      }

      const { data, error } = await supabase
        .from("reporte_ventas_diario")
        .select(`
          fecha_corte,
          anio,
          mes,
          vendedor,
          zona,
          division,
          equipo,
          facturado_quimicos,
          facturado_otros,
          facturado_total
        `)
        .eq("fecha_corte", fechaCorte)
        .eq("anio", anio)
        .eq("mes", mes)
        .order("vendedor");

      if (error) throw error;

      const metadataMap = new Map<string, VentaRow>();
      fallbackMes.forEach((r) => metadataMap.set(vendedorKey(r.vendedor), r));

      const convertidas: VentaRow[] = ((data || []) as DiarioRow[]).map((d) => {
        const historico = metadataMap.get(vendedorKey(d.vendedor));

        return {
          anio,
          mes,
          vendedor: d.vendedor,
          zona: d.zona ?? historico?.zona ?? null,
          gerencia: historico?.gerencia ?? null,
          supervisor: historico?.supervisor ?? null,
          division: d.division ?? historico?.division ?? null,
          equipo: d.equipo ?? historico?.equipo ?? null,
          venta_quimicos: d.facturado_quimicos,
          venta_otros: d.facturado_otros,
          venta_total: d.facturado_total,
        };
      });

      return {
        rows: convertidas,
        fuente: {
          anio,
          mes,
          fuente: "diario",
          fechaCorte,
        },
      };
    },
    [obtenerUltimoCorte, supabase]
  );

  const cargar = useCallback(
    async (desdeSolicitada: string, hastaSolicitada: string) => {
      try {
        setLoading(true);
        setError("");

        const desde = desdeSolicitada || "";
        const hasta = hastaSolicitada || "";

        if (!desde || !hasta) {
          setRows([]);
          setError("Debes indicar las fechas Desde y Hasta.");
          return;
        }

        if (desde > hasta) {
          setRows([]);
          setError("La fecha Desde no puede ser posterior a la fecha Hasta.");
          return;
        }

        const pDesde = partesFecha(desde);
        const pHasta = partesFecha(hasta);

        if (pDesde.anio !== pHasta.anio || pDesde.mes !== pHasta.mes) {
          setRows([]);
          setError(
            "Para mantener el comparativo mensual correcto, Desde y Hasta deben pertenecer al mismo mes."
          );
          return;
        }

        const anioCY = pHasta.anio;
        const mesSeleccionado = pHasta.mes;
        const anioLY = anioCY - 1;

        const camposMensual = `
          anio,
          mes,
          vendedor,
          zona,
          gerencia,
          supervisor,
          division,
          equipo,
          venta_quimicos,
          venta_otros,
          venta_total
        `;

        const [actualResult, anteriorResult] = await Promise.all([
          supabase
            .from("reporte_ventas_mensual")
            .select(camposMensual)
            .eq("anio", anioCY)
            .order("mes"),
          supabase
            .from("reporte_ventas_mensual")
            .select(camposMensual)
            .eq("anio", anioLY)
            .order("mes"),
        ]);

        if (actualResult.error) throw actualResult.error;
        if (anteriorResult.error) throw anteriorResult.error;

        const mensualCY = (actualResult.data || []) as VentaRow[];
        const mensualLY = (anteriorResult.data || []) as VentaRow[];

        const meses = Array.from({ length: mesSeleccionado }, (_, i) => i + 1);

        const rangoLYSeleccionado = {
          desde: fechaEquivalenteOtroAnio(desde, anioLY),
          hasta: fechaEquivalenteOtroAnio(hasta, anioLY),
        };

        const [resultadosCY, resultadosLY] = await Promise.all([
          Promise.all(
            meses.map((m) => {
              const esSeleccionado = m === mesSeleccionado;
              return cargarMesPreferente(
                anioCY,
                m,
                esSeleccionado ? desde : inicioMesISO(anioCY, m),
                esSeleccionado ? hasta : finMesISO(anioCY, m),
                mensualCY
              );
            })
          ),
          Promise.all(
            meses.map((m) => {
              const esSeleccionado = m === mesSeleccionado;
              return cargarMesPreferente(
                anioLY,
                m,
                esSeleccionado
                  ? rangoLYSeleccionado.desde
                  : inicioMesISO(anioLY, m),
                esSeleccionado
                  ? rangoLYSeleccionado.hasta
                  : finMesISO(anioLY, m),
                mensualLY
              );
            })
          ),
        ]);

        const rowsCY = resultadosCY.flatMap((r) => r.rows);
        const rowsLY = resultadosLY.flatMap((r) => r.rows);

        setRows([...rowsLY, ...rowsCY]);
        setFuenteCY(resultadosCY[mesSeleccionado - 1]?.fuente || null);
        setFuenteLY(resultadosLY[mesSeleccionado - 1]?.fuente || null);
      } catch (err: any) {
        console.error(err);
        setRows([]);
        setError(err?.message || "No fue posible cargar el comparativo.");
      } finally {
        setLoading(false);
      }
    },
    [cargarMesPreferente, supabase]
  );

  useEffect(() => {
    const rango = rangoMesActual();
    setFechaDesde(rango.desde);
    setFechaHasta(rango.hasta);
    cargar(rango.desde, rango.hasta);
  }, [cargar]);

  useEffect(() => {
    if (!fechaDesde || !fechaHasta) return;

    const interval = window.setInterval(() => {
      cargar(fechaDesde, fechaHasta);
    }, 5 * 60 * 1000);

    return () => window.clearInterval(interval);
  }, [fechaDesde, fechaHasta, cargar]);

  const resumenBase = useMemo(() => {
    const mapa = new Map<string, Resumen>();
    const anioCY = periodo.anio;
    const mesSeleccionado = periodo.mes;

    rows.forEach((r) => {
      const key = vendedorKey(r.vendedor);
      if (!key) return;

      if (!mapa.has(key)) {
        mapa.set(key, {
          vendedor: r.vendedor,
          zona: zonaDe(r),
          gerencia: clean(r.gerencia),
          supervisor: clean(r.supervisor),
          division: clean(r.division),
          equipo: clean(r.equipo),
          mesLY: 0,
          mesCY: 0,
          ytdLY: 0,
          ytdCY: 0,
        });
      }

      const item = mapa.get(key)!;

      if (r.anio === anioCY) {
        item.vendedor = r.vendedor;
        if (r.zona) item.zona = zonaDe(r);
        if (r.gerencia) item.gerencia = clean(r.gerencia);
        if (r.supervisor) item.supervisor = clean(r.supervisor);
        if (r.division) item.division = clean(r.division);
        if (r.equipo) item.equipo = clean(r.equipo);
      }

      const valor = valorMetrica(r, metrica);

      if (r.anio === anioCY - 1 && r.mes === mesSeleccionado) {
        item.mesLY += valor;
      }
      if (r.anio === anioCY && r.mes === mesSeleccionado) {
        item.mesCY += valor;
      }
      if (r.anio === anioCY - 1 && r.mes <= mesSeleccionado) {
        item.ytdLY += valor;
      }
      if (r.anio === anioCY && r.mes <= mesSeleccionado) {
        item.ytdCY += valor;
      }
    });

    return [...mapa.values()];
  }, [rows, periodo.anio, periodo.mes, metrica]);

  const opcionesCampo = useCallback(
    (getter: (row: Resumen) => string) =>
      [...new Set(resumenBase.map(getter).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "es")
      ),
    [resumenBase]
  );

  const zonas = useMemo(
    () => opcionesCampo((r) => r.zona || "SIN CLASIFICAR"),
    [opcionesCampo]
  );
  const gerencias = useMemo(
    () => opcionesCampo((r) => clean(r.gerencia)),
    [opcionesCampo]
  );
  const supervisores = useMemo(
    () => opcionesCampo((r) => clean(r.supervisor)),
    [opcionesCampo]
  );
  const divisiones = useMemo(
    () => opcionesCampo((r) => clean(r.division)),
    [opcionesCampo]
  );
  const equipos = useMemo(
    () => opcionesCampo((r) => clean(r.equipo)),
    [opcionesCampo]
  );

  const vendedores = useMemo(() => {
    return [...resumenBase]
      .map((r) => [vendedorKey(r.vendedor), r.vendedor] as [string, string])
      .filter(([key]) => Boolean(key))
      .sort((a, b) => a[1].localeCompare(b[1], "es"));
  }, [resumenBase]);

  const resumenFiltrado = useMemo(() => {
    return resumenBase.filter((r) => {
      if (zonaFiltro !== "TODAS" && r.zona !== zonaFiltro) return false;
      if (gerenciaFiltro !== "TODAS" && r.gerencia !== gerenciaFiltro)
        return false;
      if (supervisorFiltro !== "TODOS" && r.supervisor !== supervisorFiltro)
        return false;
      if (divisionFiltro !== "TODAS" && r.division !== divisionFiltro)
        return false;
      if (equipoFiltro !== "TODOS" && r.equipo !== equipoFiltro) return false;
      if (
        vendedorFiltro !== "TODOS" &&
        vendedorKey(r.vendedor) !== vendedorFiltro
      )
        return false;
      return true;
    });
  }, [
    resumenBase,
    zonaFiltro,
    gerenciaFiltro,
    supervisorFiltro,
    divisionFiltro,
    equipoFiltro,
    vendedorFiltro,
  ]);

  const totalGeneral = useMemo(
    () => totalResumen(resumenFiltrado),
    [resumenFiltrado]
  );

  const resumenZona = useMemo(() => {
    const mapa = new Map<string, Resumen[]>();
    resumenFiltrado.forEach((r) => {
      const zona = r.zona || "SIN CLASIFICAR";
      if (!mapa.has(zona)) mapa.set(zona, []);
      mapa.get(zona)!.push(r);
    });

    const orden: Record<string, number> = {
      CENTRO: 1,
      NORTE: 2,
      SUR: 3,
      "SIN CLASIFICAR": 99,
    };

    return [...mapa.entries()].sort(
      ([a], [b]) =>
        (orden[normalizarJerarquia(a)] || 50) -
        (orden[normalizarJerarquia(b)] || 50)
    );
  }, [resumenFiltrado]);

  const jerarquiaDetalle = useMemo(() => {
    const divisionesMapa = new Map<
      string,
      Map<string, Map<string, Resumen[]>>
    >();

    resumenFiltrado.forEach((row) => {
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

      if (!zonasMapa.has(zona)) zonasMapa.set(zona, []);
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
          : normalizarJerarquia(a).localeCompare(normalizarJerarquia(b), "es");
      })
      .map(([division, equiposMapa]) => ({
        division,
        gerente: obtenerGerenteDivision(division),
        equipos: [...equiposMapa.entries()]
          .sort(([a], [b]) =>
            normalizarJerarquia(a).localeCompare(normalizarJerarquia(b), "es")
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
                responsableZona: obtenerResponsableZona(zona, equipo),
                lista: ordenarVendedoresJerarquia(zona, equipo, lista),
              })),
          })),
      }));
  }, [resumenFiltrado]);

  const nombreMetrica =
    metrica === "venta_quimicos"
      ? "Químicos"
      : metrica === "venta_otros"
      ? "Otros"
      : "Venta Total";

  const periodoActual = useMemo(() => {
    if (!fechaHasta) return false;
    const hoy = new Date();
    const p = partesFecha(fechaHasta);
    return p.anio === hoy.getFullYear() && p.mes === hoy.getMonth() + 1;
  }, [fechaHasta]);

  const fuenteTexto = (fuente: FuenteMes | null) => {
    if (!fuente) return "—";
    if (fuente.fuente === "diario") {
      return `Avance Diario · corte ${fuente.fechaCorte || "—"}`;
    }
    if (fuente.fuente === "mensual") return "Histórico mensual";
    return "Sin datos";
  };

  return (
    <div className="space-y-6 pb-8">
      {/* HERO */}
      <section className="overflow-hidden rounded-3xl bg-gradient-to-r from-[#123a9c] via-[#1f4ed8] to-[#2B6CFF] text-white shadow-lg shadow-blue-900/10">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_360px] lg:items-center lg:p-8">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-50">
                Reporte comercial
              </span>
              <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-medium text-emerald-50">
                Comparativo CY / LY
              </span>
            </div>

            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              Comparativo Comercial
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100 md:text-base">
              Comparación mensual y acumulada contra el año anterior usando el
              Avance Diario como fuente preferente de ventas.
            </p>

            <div className="mt-5 flex flex-wrap gap-3 text-xs text-blue-100">
              <span className="rounded-lg bg-white/10 px-3 py-2">
                Rango: <strong className="text-white">{fechaDesde || "—"}</strong>{" "}
                a <strong className="text-white">{fechaHasta || "—"}</strong>
              </span>
              <span className="rounded-lg bg-white/10 px-3 py-2">
                CY: <strong className="text-white">{fuenteTexto(fuenteCY)}</strong>
              </span>
              <span className="rounded-lg bg-white/10 px-3 py-2">
                LY: <strong className="text-white">{fuenteTexto(fuenteLY)}</strong>
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-100">
              {MESES[periodo.mes] || "Período"} {periodo.anio || ""}
            </p>
            <p className="mt-1 text-3xl font-bold">{money(totalGeneral.mesCY)}</p>
            <div className="mt-3 flex items-center justify-between text-xs text-blue-100">
              <span>LY {money(totalGeneral.mesLY)}</span>
              <span>CY/LY {pct(totalGeneral.mesVar)}</span>
            </div>
          </div>
        </div>
      </section>

      {periodoActual && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Período en curso:</strong> CY usa el último corte disponible
          dentro del rango seleccionado. LY usa el corte diario equivalente si
          existe; de lo contrario, usa el histórico mensual.
        </div>
      )}

      {fuenteCY?.fuente !== "diario" && fuenteCY && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Atención:</strong> para {MESES[periodo.mes]} {periodo.anio} no
          se encontró un corte de Avance Diario dentro del rango. El comparativo
          está usando el histórico mensual como respaldo.
        </div>
      )}

      {/* FILTROS */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Filtros del comparativo</h2>
            <p className="mt-1 text-xs text-slate-500">
              Desde y Hasta deben quedar dentro del mismo mes. El rango se usa
              para ubicar el último corte disponible del Avance Diario.
            </p>
          </div>

          <Link
            href="/tablero-control"
            className="text-sm font-semibold text-[#1f4ed8] hover:underline"
          >
            ← Volver al Tablero
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
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

          <Filtro label="Métrica">
            <select
              value={metrica}
              onChange={(e) => setMetrica(e.target.value as Metrica)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
            >
              <option value="venta_total">Venta Total</option>
              <option value="venta_quimicos">Químicos</option>
              <option value="venta_otros">Otros</option>
            </select>
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

          <Filtro label="Gerencia">
            <select
              value={gerenciaFiltro}
              onChange={(e) => setGerenciaFiltro(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
            >
              <option value="TODAS">Todas</option>
              {gerencias.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </Filtro>

          <Filtro label="Supervisor">
            <select
              value={supervisorFiltro}
              onChange={(e) => setSupervisorFiltro(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
            >
              <option value="TODOS">Todos</option>
              {supervisores.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Filtro>

          <Filtro label="Vendedor">
            <select
              value={vendedorFiltro}
              onChange={(e) => setVendedorFiltro(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
            >
              <option value="TODOS">Todos</option>
              {vendedores.map(([key, nombre]) => (
                <option key={key} value={key}>
                  {nombre}
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
              {loading ? "Actualizando..." : "Actualizar comparativo"}
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
          {error}
        </div>
      )}

      {/* KPIs MES */}
      <section>
        <div className="mb-3">
          <h2 className="text-lg font-bold text-slate-900">
            {MESES[periodo.mes]} — {nombreMetrica}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Comparación del período seleccionado contra el mismo mes del año anterior.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            titulo={`MES LY ${periodo.anio ? periodo.anio - 1 : ""}`}
            valor={money(totalGeneral.mesLY)}
            detalle={MESES[periodo.mes] || "—"}
          />
          <Kpi
            titulo={`MES CY ${periodo.anio || ""}`}
            valor={money(totalGeneral.mesCY)}
            detalle={MESES[periodo.mes] || "—"}
            destacado
          />
          <Kpi
            titulo="Variación $"
            valor={money(totalGeneral.mesDif)}
            detalle="CY - LY"
          />
          <Kpi
            titulo="% CY/LY"
            valor={pct(totalGeneral.mesVar)}
            detalle="CY / LY"
            clase={claseCYLY(totalGeneral.mesVar)}
          />
        </div>
      </section>

      {/* KPIs YTD */}
      <section>
        <div className="mb-3">
          <h2 className="text-lg font-bold text-slate-900">
            Acumulado YTD — Enero a {MESES[periodo.mes]}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Para CY se prioriza el último corte disponible de cada mes en Avance Diario.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            titulo={`YTD LY ${periodo.anio ? periodo.anio - 1 : ""}`}
            valor={money(totalGeneral.ytdLY)}
            detalle={`Enero - ${MESES[periodo.mes] || "—"}`}
          />
          <Kpi
            titulo={`YTD CY ${periodo.anio || ""}`}
            valor={money(totalGeneral.ytdCY)}
            detalle={`Enero - ${MESES[periodo.mes] || "—"}`}
            destacado
          />
          <Kpi
            titulo="Variación YTD $"
            valor={money(totalGeneral.ytdDif)}
            detalle="CY - LY"
          />
          <Kpi
            titulo="% YTD CY/LY"
            valor={pct(totalGeneral.ytdVar)}
            detalle="CY / LY"
            clase={claseCYLY(totalGeneral.ytdVar)}
          />
        </div>
      </section>

      {/* RESUMEN POR ZONA */}
      <section>
        <div className="mb-3">
          <h2 className="text-lg font-bold text-slate-900">Resumen por Zona</h2>
          <p className="mt-1 text-xs text-slate-500">
            Comparación rápida CY versus LY según los filtros seleccionados.
          </p>
        </div>

        {resumenZona.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            No existen datos para los filtros seleccionados.
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-3">
            {resumenZona.map(([zona, lista]) => (
              <ZonaComparativoCard
                key={zona}
                zona={zona}
                total={totalResumen(lista)}
                vendedores={lista.length}
              />
            ))}
          </div>
        )}
      </section>

      {/* DETALLE JERÁRQUICO */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-white px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Comparativo por Vendedor
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Jerarquía comercial por división, equipo y zona, manteniendo el orden del Avance Diario.
            </p>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
            {resumenFiltrado.length} vendedor
            {resumenFiltrado.length === 1 ? "" : "es"}
          </div>
        </div>

        <div className="max-h-[760px] overflow-auto">
          <table className="min-w-[1450px] w-full border-collapse text-xs">
            <thead className="sticky top-0 z-20 bg-slate-900 text-white shadow-sm">
              <tr>
                <Th oscuro>Zona</Th>
                <Th oscuro>Vendedor</Th>
                <Th oscuro>División</Th>
                <Th oscuro>Equipo</Th>
                <Th oscuro>MES LY</Th>
                <Th oscuro>MES CY</Th>
                <Th oscuro>Var. $</Th>
                <Th oscuro>% CY/LY</Th>
                <Th oscuro>YTD LY</Th>
                <Th oscuro>YTD CY</Th>
                <Th oscuro>Var. YTD $</Th>
                <Th oscuro>% YTD CY/LY</Th>
              </tr>
            </thead>

            <tbody>
              <FilaComparativo
                zona=""
                vendedor="TOTAL GENERAL"
                division=""
                equipo=""
                total={totalGeneral}
                totalGeneral
              />

              {jerarquiaDetalle.map((divisionItem) => {
                const filasDivision = divisionItem.equipos.flatMap((equipo) =>
                  equipo.zonas.flatMap((zona) => zona.lista)
                );
                const totalDivision = totalResumen(filasDivision);

                return (
                  <React.Fragment key={divisionItem.division}>
                    <tr className="bg-slate-950 text-white">
                      <td colSpan={12} className="px-4 py-3.5">
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
                              MES CY: <strong className="text-white">{money(totalDivision.mesCY)}</strong>
                            </span>
                            <span>
                              CY/LY: <strong className="text-white">{pct(totalDivision.mesVar)}</strong>
                            </span>
                          </div>
                        </div>
                      </td>
                    </tr>

                    {divisionItem.equipos.map((equipoItem) => {
                      const filasEquipo = equipoItem.zonas.flatMap(
                        (zona) => zona.lista
                      );
                      const totalEquipo = totalResumen(filasEquipo);

                      return (
                        <React.Fragment
                          key={`${divisionItem.division}-${equipoItem.equipo}`}
                        >
                          <tr className="border-b border-slate-300 bg-slate-100">
                            <td colSpan={12} className="px-4 py-3">
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
                                    MES CY: <strong>{money(totalEquipo.mesCY)}</strong>
                                  </span>
                                  <span>
                                    CY/LY: <strong>{pct(totalEquipo.mesVar)}</strong>
                                  </span>
                                </div>
                              </div>
                            </td>
                          </tr>

                          {equipoItem.zonas.map((zonaItem) => {
                            const totalZona = totalResumen(zonaItem.lista);
                            const tema = zonaTema(zonaItem.zona);

                            return (
                              <React.Fragment
                                key={`${divisionItem.division}-${equipoItem.equipo}-${zonaItem.zona}`}
                              >
                                <tr className={`${tema.encabezado} text-white`}>
                                  <td colSpan={12} className="px-4 py-3">
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
                                          {zonaItem.lista.length} vendedor
                                          {zonaItem.lista.length === 1 ? "" : "es"}
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-4 text-xs">
                                        <span>
                                          MES CY: <strong>{money(totalZona.mesCY)}</strong>
                                        </span>
                                        <span>
                                          CY/LY: <strong>{pct(totalZona.mesVar)}</strong>
                                        </span>
                                      </div>
                                    </div>
                                  </td>
                                </tr>

                                <FilaComparativo
                                  zona={zonaItem.zona}
                                  vendedor={`TOTAL ${zonaItem.zona}`}
                                  division=""
                                  equipo=""
                                  total={totalZona}
                                  subtotal
                                />

                                {zonaItem.lista.map((r, index) => (
                                  <FilaVendedorComparativo
                                    key={`${divisionItem.division}-${equipoItem.equipo}-${zonaItem.zona}-${vendedorKey(
                                      r.vendedor
                                    )}`}
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

function Kpi({
  titulo,
  valor,
  detalle,
  destacado = false,
  clase = "",
}: {
  titulo: string;
  valor: string;
  detalle: string;
  destacado?: boolean;
  clase?: string;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm ${
        destacado
          ? "border-blue-200 bg-blue-50"
          : "border-slate-200 bg-white"
      } ${clase}`}
    >
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
        {titulo}
      </p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{valor}</p>
      <p className="mt-1 text-xs text-slate-500">{detalle}</p>
    </div>
  );
}

function ZonaComparativoCard({
  zona,
  total,
  vendedores,
}: {
  zona: string;
  total: ReturnType<typeof totalResumen>;
  vendedores: number;
}) {
  const tema = zonaTema(zona);

  return (
    <div
      className={`rounded-2xl border bg-white p-5 shadow-sm ${tema.borde}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className={`text-xs font-bold uppercase tracking-wider ${tema.texto}`}>
            {zona}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {vendedores} vendedor{vendedores === 1 ? "" : "es"}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${claseCYLY(
            total.mesVar
          )}`}
        >
          {pct(total.mesVar)}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-[10px] font-semibold uppercase text-slate-400">
            MES LY
          </p>
          <p className="mt-1 font-bold text-slate-700">{money(total.mesLY)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase text-slate-400">
            MES CY
          </p>
          <p className="mt-1 font-bold text-slate-900">{money(total.mesCY)}</p>
        </div>
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
      className={`whitespace-nowrap border-b px-3 py-3 text-right text-[10px] font-bold uppercase tracking-wider ${
        oscuro
          ? "border-slate-700 text-slate-200"
          : "border-slate-200 text-slate-500"
      } first:text-left`}
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
      className={`whitespace-nowrap border-b border-slate-100 px-3 py-2.5 ${
        izquierda ? "text-left" : "text-right"
      } ${fuerte ? "font-bold" : ""} ${clase}`}
    >
      {children}
    </td>
  );
}

function FilaComparativo({
  zona,
  vendedor,
  division,
  equipo,
  total,
  totalGeneral = false,
  subtotal = false,
}: {
  zona: string;
  vendedor: string;
  division: string;
  equipo: string;
  total: ReturnType<typeof totalResumen>;
  totalGeneral?: boolean;
  subtotal?: boolean;
}) {
  const claseFila = totalGeneral
    ? "bg-blue-950 text-white"
    : subtotal
    ? "bg-slate-100 font-semibold"
    : "bg-white";

  return (
    <tr className={claseFila}>
      <Td izquierda fuerte={totalGeneral || subtotal}>
        {zona}
      </Td>
      <Td izquierda fuerte={totalGeneral || subtotal}>
        {vendedor}
      </Td>
      <Td izquierda>{division || "—"}</Td>
      <Td izquierda>{equipo || "—"}</Td>
      <Td>{money(total.mesLY)}</Td>
      <Td fuerte>{money(total.mesCY)}</Td>
      <Td>{money(total.mesDif)}</Td>
      <Td>
        <span
          className={`rounded-full px-2 py-1 text-[10px] font-bold ${
            totalGeneral ? "bg-white/15 text-white" : claseCYLY(total.mesVar)
          }`}
        >
          {pct(total.mesVar)}
        </span>
      </Td>
      <Td>{money(total.ytdLY)}</Td>
      <Td fuerte>{money(total.ytdCY)}</Td>
      <Td>{money(total.ytdDif)}</Td>
      <Td>
        <span
          className={`rounded-full px-2 py-1 text-[10px] font-bold ${
            totalGeneral ? "bg-white/15 text-white" : claseCYLY(total.ytdVar)
          }`}
        >
          {pct(total.ytdVar)}
        </span>
      </Td>
    </tr>
  );
}

function FilaVendedorComparativo({
  row,
  index,
  zona,
  rolJerarquico = "",
}: {
  row: Resumen;
  index: number;
  zona: string;
  rolJerarquico?: string;
}) {
  const tema = zonaTema(zona);
  const esLider = Boolean(rolJerarquico);
  const total = totalResumen([row]);

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
        clase={esLider ? `${tema.texto} font-bold` : "text-slate-800"}
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
            <span>{row.vendedor}</span>
          </div>
        )}
      </Td>

      <Td izquierda>{row.division || "—"}</Td>
      <Td izquierda>{row.equipo || "—"}</Td>
      <Td>{money(row.mesLY)}</Td>
      <Td fuerte>{money(row.mesCY)}</Td>
      <Td>{money(total.mesDif)}</Td>
      <Td>
        <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${claseCYLY(total.mesVar)}`}>
          {pct(total.mesVar)}
        </span>
      </Td>
      <Td>{money(row.ytdLY)}</Td>
      <Td fuerte>{money(row.ytdCY)}</Td>
      <Td>{money(total.ytdDif)}</Td>
      <Td>
        <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${claseCYLY(total.ytdVar)}`}>
          {pct(total.ytdVar)}
        </span>
      </Td>
    </tr>
  );
}
