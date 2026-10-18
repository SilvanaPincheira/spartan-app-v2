"use client";

// ============================================================
// SpartanOne · Gerencia · Control Mensual de Comodatos
//
// Lee el cierre que sube Sistema/subir_supabase.py:
//   comodatos_kpis_mensual  -> indicadores de cada cierre
//   comodatos_control       -> estado de cada RUT en cada cierre
//   Storage reportes-comodatos -> Excel y dashboard del mes
// ============================================================

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

// ============================================================
// TIPOS
// ============================================================

type EstadoControl = "CRITICO" | "ALERTA" | "CUMPLE" | "SIN CLASIFICAR";

type ControlRow = {
  rut_key: string;
  rut: string;
  cliente: string | null;
  ejecutivo: string | null;
  estado_control: EstadoControl;
  inversion_neta: number | null;
  inversion_costo: number | null;
  venta_prom_3m: number | null;
  venta_prom_12m: number | null;
  compromiso_mensual: number | null;
  cumplimiento: number | null;
  dias_sin_compra: number | null;
  meses_seguidos_critico: number | null;
  motivo: string | null;
  accion_sugerida: string | null;
  recuperacion: number | null;
  estado_recuperacion: string | null;
  vencimiento: string | null;
  dias_a_vencimiento: number | null;
  fuente_plazo: string | null;
  accion_vencimiento: string | null;
};

type KpiMensual = {
  periodo: string;
  corte_sap: string | null;
  clientes: number | null;
  cumplen: number | null;
  criticos: number | null;
  inversion_criticos: number | null;
  alertas: number | null;
  vencimientos: number | null;
  pagados: number | null;
  inversion_valor: number | null;
  inversion_costo: number | null;
  inversion_ociosa: number | null;
  costo_ocioso: number | null;
  evaluacion_vs_real: number | null;
  retorno_cohortes: Record<string, number | null> | null;
  retorno_financiero_cohortes: Record<string, number | null> | null;
  comodatos_no_rentables: Record<string, number | null> | null;
  archivo_reporte: string | null;
  archivo_dashboard: string | null;
};

type Perfil = { role?: string | null; department?: string | null; email?: string | null };

type Pestana = "CRITICO" | "ALERTA" | "CUMPLE" | "PLAZO" | "TODOS";

const BUCKET_REPORTES = "reportes-comodatos";

const PESTANAS: { id: Pestana; label: string }[] = [
  { id: "CRITICO", label: "Críticos" },
  { id: "ALERTA", label: "En alerta" },
  { id: "CUMPLE", label: "Cumplen" },
  { id: "PLAZO", label: "Plazos vencidos / por vencer" },
  { id: "TODOS", label: "Todos los clientes" },
];

// ============================================================
// HELPERS
// ============================================================

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

function number(value: unknown) {
  return num(value).toLocaleString("es-CL", { maximumFractionDigits: 0 });
}

function pct(ratio: number | null | undefined, decimales = 0) {
  if (ratio === null || ratio === undefined || !Number.isFinite(Number(ratio))) return "—";
  return `${(Number(ratio) * 100).toLocaleString("es-CL", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })}%`;
}

function ratioX(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  return `${Number(value).toLocaleString("es-CL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}x`;
}

function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function dateCL(value: string | null | undefined) {
  if (!value) return "—";
  const f = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(f.getTime()) ? value : f.toLocaleDateString("es-CL");
}

function periodoTexto(periodo: string | null | undefined) {
  if (!periodo) return "—";
  const [a, m] = periodo.split("-").map(Number);
  const t = new Date(a, (m || 1) - 1, 1).toLocaleDateString("es-CL", {
    month: "long",
    year: "numeric",
  });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// Quita prefijos de división que SAP antepone al ejecutivo ("HC ", "FB ", "IN ").
function ejecutivoLimpio(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/^[A-Z]{2}\s+/, "")
    .trim();
}

function controlTexto(estado: string | undefined) {
  switch (estado) {
    case "CRITICO":
      return "Crítico";
    case "ALERTA":
      return "En alerta";
    case "CUMPLE":
      return "Cumple";
    default:
      return "Sin clasificar";
  }
}

function controlBadge(estado: string | undefined) {
  switch (estado) {
    case "CRITICO":
      return "border-red-200 bg-red-50 text-red-700";
    case "ALERTA":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "CUMPLE":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    default:
      return "border-zinc-200 bg-zinc-50 text-zinc-500";
  }
}

function recuperacionTexto(estado: string | null) {
  if (!estado) return "—";
  return estado === "PAGADO" ? "Recuperada" : estado.toLowerCase();
}

function enPlazo(r: ControlRow) {
  return r.dias_a_vencimiento !== null && r.dias_a_vencimiento <= 90;
}

// ============================================================
// PAGE
// ============================================================

export default function ControlComodatosPage() {
  const supabase = useMemo(() => createClientComponentClient(), []);

  const [autorizado, setAutorizado] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [cargandoMes, setCargandoMes] = useState(false);
  const [error, setError] = useState("");

  const [historial, setHistorial] = useState<KpiMensual[]>([]);
  const [periodo, setPeriodo] = useState<string>("");
  const [filas, setFilas] = useState<ControlRow[]>([]);

  const [pestana, setPestana] = useState<Pestana>("CRITICO");
  const [busqueda, setBusqueda] = useState("");
  const [ejecutivoFiltro, setEjecutivoFiltro] = useState("TODOS");
  const [exportando, setExportando] = useState(false);

  // ==========================================================
  // ACCESO + HISTORIAL DE CIERRES
  // ==========================================================

  const cargarInicio = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setAutorizado(false);
        setError("No existe una sesión activa.");
        return;
      }

      const { data: perfilData, error: perfilError } = await supabase
        .from("profiles")
        .select("role, department, email")
        .eq("id", session.user.id)
        .maybeSingle();

      if (perfilError) throw perfilError;

      const perfil = (perfilData || {}) as Perfil;
      const role = normalize(perfil.role);
      const department = normalize(perfil.department);
      const email = normalize(session.user.email);

      const esGerencia = role === "gerencia" || department.startsWith("gerencia_");
      const accesoEspecial = email === "silvana.pincheira@spartan.cl";

      if (!esGerencia && !accesoEspecial) {
        setAutorizado(false);
        return;
      }

      setAutorizado(true);

      const { data, error: kpiError } = await supabase
        .from("comodatos_kpis_mensual")
        .select("*")
        .order("periodo", { ascending: true });

      if (kpiError) throw kpiError;

      const lista = (data || []) as KpiMensual[];
      setHistorial(lista);
      setPeriodo((actual) =>
        actual && lista.some((k) => k.periodo === actual)
          ? actual
          : lista[lista.length - 1]?.periodo || ""
      );
    } catch (err: any) {
      console.error("Error control comodatos:", err);
      setError(err?.message || "No fue posible cargar el control de comodatos.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    cargarInicio();
  }, [cargarInicio]);

  // ==========================================================
  // CLIENTES DEL CIERRE SELECCIONADO
  // ==========================================================

  useEffect(() => {
    if (!periodo || !autorizado) return;
    let cancelado = false;

    (async () => {
      try {
        setCargandoMes(true);
        const { data, error: e } = await supabase
          .from("comodatos_control")
          .select("*")
          .eq("periodo", periodo)
          .order("inversion_neta", { ascending: false })
          .range(0, 9999);
        if (e) throw e;
        if (!cancelado) setFilas((data || []) as ControlRow[]);
      } catch (err: any) {
        if (!cancelado) setError(err?.message || "No fue posible cargar los clientes del cierre.");
      } finally {
        if (!cancelado) setCargandoMes(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [supabase, periodo, autorizado]);

  // ==========================================================
  // DERIVADOS
  // ==========================================================

  const kpiMes = useMemo(
    () => historial.find((k) => k.periodo === periodo) || null,
    [historial, periodo]
  );

  const kpiAnterior = useMemo(() => {
    const i = historial.findIndex((k) => k.periodo === periodo);
    return i > 0 ? historial[i - 1] : null;
  }, [historial, periodo]);

  const ejecutivos = useMemo(
    () =>
      [...new Set(filas.map((r) => ejecutivoLimpio(r.ejecutivo)).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "es")
      ),
    [filas]
  );

  // Ejecutivo + búsqueda (base para pestañas y resumen)
  const alcance = useMemo(() => {
    const q = normalize(busqueda);
    return filas.filter((r) => {
      if (ejecutivoFiltro !== "TODOS" && ejecutivoLimpio(r.ejecutivo) !== ejecutivoFiltro) {
        return false;
      }
      if (!q) return true;
      return [r.cliente, r.rut, r.rut_key, r.ejecutivo, r.motivo]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [filas, busqueda, ejecutivoFiltro]);

  const conteos = useMemo(
    () => ({
      CRITICO: alcance.filter((r) => r.estado_control === "CRITICO").length,
      ALERTA: alcance.filter((r) => r.estado_control === "ALERTA").length,
      CUMPLE: alcance.filter((r) => r.estado_control === "CUMPLE").length,
      PLAZO: alcance.filter(enPlazo).length,
      TODOS: alcance.length,
    }),
    [alcance]
  );

  const visibles = useMemo(() => {
    const lista =
      pestana === "TODOS"
        ? alcance
        : pestana === "PLAZO"
        ? alcance.filter(enPlazo)
        : alcance.filter((r) => r.estado_control === pestana);

    return [...lista].sort((a, b) => {
      if (pestana === "PLAZO") return num(a.dias_a_vencimiento) - num(b.dias_a_vencimiento);
      if (pestana === "CRITICO") {
        const m = num(b.meses_seguidos_critico) - num(a.meses_seguidos_critico);
        if (m !== 0) return m;
      }
      return num(b.inversion_neta) - num(a.inversion_neta);
    });
  }, [alcance, pestana]);

  const totalVisible = useMemo(
    () => ({
      clientes: visibles.length,
      inversion: visibles.reduce((acc, r) => acc + num(r.inversion_neta), 0),
      venta3m: visibles.reduce((acc, r) => acc + num(r.venta_prom_3m), 0),
      compromiso: visibles.reduce((acc, r) => acc + num(r.compromiso_mensual), 0),
    }),
    [visibles]
  );

  // Resumen por ejecutivo (responde a la búsqueda, no a la pestaña)
  const porEjecutivo = useMemo(() => {
    const mapa = new Map<
      string,
      { ejecutivo: string; clientes: number; inversion: number; criticos: number; invCriticos: number; alertas: number; cumplen: number; plazo: number }
    >();
    alcance.forEach((r) => {
      const k = ejecutivoLimpio(r.ejecutivo) || "Sin ejecutivo";
      const e =
        mapa.get(k) ||
        { ejecutivo: k, clientes: 0, inversion: 0, criticos: 0, invCriticos: 0, alertas: 0, cumplen: 0, plazo: 0 };
      e.clientes += 1;
      e.inversion += num(r.inversion_neta);
      if (r.estado_control === "CRITICO") {
        e.criticos += 1;
        e.invCriticos += num(r.inversion_neta);
      }
      if (r.estado_control === "ALERTA") e.alertas += 1;
      if (r.estado_control === "CUMPLE") e.cumplen += 1;
      if (enPlazo(r)) e.plazo += 1;
      mapa.set(k, e);
    });
    return [...mapa.values()].sort((a, b) => b.invCriticos - a.invCriticos);
  }, [alcance]);

  const cohortes = useMemo(() => {
    if (!kpiMes) return [];
    const anios = new Set<string>([
      ...Object.keys(kpiMes.retorno_cohortes || {}),
      ...Object.keys(kpiMes.retorno_financiero_cohortes || {}),
      ...Object.keys(kpiMes.comodatos_no_rentables || {}),
    ]);
    return [...anios]
      .sort()
      .map((anio) => ({
        anio,
        comercial: kpiMes.retorno_cohortes?.[anio] ?? null,
        financiero: kpiMes.retorno_financiero_cohortes?.[anio] ?? null,
        noRentables: kpiMes.comodatos_no_rentables?.[anio] ?? null,
      }))
      .filter((c) => c.comercial !== null || c.financiero !== null || c.noRentables !== null);
  }, [kpiMes]);

  // ==========================================================
  // ACCIONES
  // ==========================================================

  const abrirArchivo = useCallback(
    async (ruta: string | null) => {
      if (!ruta) return;
      const { data, error: e } = await supabase.storage
        .from(BUCKET_REPORTES)
        .createSignedUrl(ruta, 60 * 10);
      if (e || !data?.signedUrl) {
        setError(e?.message || "No fue posible abrir el archivo.");
        return;
      }
      window.open(data.signedUrl, "_blank", "noopener");
    },
    [supabase]
  );

  const exportarExcel = useCallback(async () => {
    if (visibles.length === 0 || exportando) return;
    setExportando(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const libro = new ExcelJS.Workbook();
      libro.creator = "SpartanOne";
      const nombre = PESTANAS.find((p) => p.id === pestana)?.label || "Clientes";
      const hoja = libro.addWorksheet(nombre.slice(0, 31), {
        views: [{ state: "frozen", ySplit: 1 }],
      });

      hoja.columns = [
        { header: "Control", key: "control", width: 14 },
        { header: "Cliente", key: "cliente", width: 44 },
        { header: "RUT", key: "rut", width: 14 },
        { header: "Ejecutivo", key: "ejecutivo", width: 28 },
        { header: "Inversión neta", key: "inversion", width: 18 },
        { header: "Venta prom. 3m", key: "v3", width: 17 },
        { header: "Venta prom. 12m", key: "v12", width: 17 },
        { header: "Compromiso mensual", key: "comp", width: 19 },
        { header: "Cumplimiento", key: "cump", width: 14 },
        { header: "Días sin compra", key: "dias", width: 15 },
        { header: "Meses seguidos crítico", key: "meses", width: 20 },
        { header: "Motivo", key: "motivo", width: 70 },
        { header: "Acción sugerida", key: "accion", width: 42 },
        { header: "Recuperación inversión", key: "recup", width: 20 },
        { header: "Vencimiento", key: "venc", width: 14 },
        { header: "Días a vencimiento", key: "diasVenc", width: 17 },
        { header: "Fuente del plazo", key: "fuente", width: 18 },
      ];

      visibles.forEach((r) =>
        hoja.addRow({
          control: controlTexto(r.estado_control),
          cliente: r.cliente,
          rut: r.rut,
          ejecutivo: ejecutivoLimpio(r.ejecutivo),
          inversion: r.inversion_neta,
          v3: r.venta_prom_3m,
          v12: r.venta_prom_12m,
          comp: r.compromiso_mensual,
          cump: r.cumplimiento,
          dias: r.dias_sin_compra,
          meses: r.meses_seguidos_critico,
          motivo: r.motivo,
          accion: r.accion_sugerida || r.accion_vencimiento,
          recup: recuperacionTexto(r.estado_recuperacion),
          venc: r.vencimiento ? dateCL(r.vencimiento) : "",
          diasVenc: r.dias_a_vencimiento,
          fuente: r.fuente_plazo,
        })
      );

      hoja.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      hoja.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
      hoja.getRow(1).height = 25;
      hoja.autoFilter = { from: "A1", to: "Q1" };
      [5, 6, 7, 8].forEach((c) => (hoja.getColumn(c).numFmt = '"$"#,##0'));
      hoja.getColumn(9).numFmt = "0%";

      const buffer = await libro.xlsx.writeBuffer();
      const blob = new Blob([new Uint8Array(buffer)], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Control_Comodatos_${periodo}_${nombre.replace(/[^A-Za-zÁÉÍÓÚáéíóúñÑ]+/g, "_")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err: any) {
      setError(err?.message || "No fue posible generar el archivo Excel.");
    } finally {
      setExportando(false);
    }
  }, [visibles, exportando, pestana, periodo]);

  // ==========================================================
  // ESTADOS DE CARGA / ACCESO
  // ==========================================================

  if (loading && autorizado === null) {
    return (
      <Shell>
        <Panel>
          <p className="text-sm text-zinc-600">Cargando control de comodatos...</p>
        </Panel>
      </Shell>
    );
  }

  if (autorizado === false) {
    return (
      <Shell>
        <Panel>
          <h1 className="text-xl font-semibold">Control de Comodatos</h1>
          <p className="mt-3 text-sm text-zinc-600">
            {error || "Tu usuario no tiene acceso a este módulo."}
          </p>
        </Panel>
      </Shell>
    );
  }

  // ==========================================================
  // PAGE
  // ==========================================================

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <main className="mx-auto max-w-[1800px] px-4 py-6 md:px-6 lg:px-8">
        {/* HEADER */}
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Gerencia</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
              Control Mensual de Comodatos
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              Cumplimiento del compromiso de compra por RUT empresa, recuperación de la inversión
              y vencimiento de contratos.
              {kpiMes?.corte_sap && ` Datos SAP al ${dateCL(kpiMes.corte_sap)}.`}
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div>
              <FilterLabel>Cierre</FilterLabel>
              <select
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                disabled={historial.length === 0}
                className="h-10 min-w-[190px] rounded-xl border border-zinc-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-blue-400"
              >
                {[...historial].reverse().map((k) => (
                  <option key={k.periodo} value={k.periodo}>
                    {periodoTexto(k.periodo)}
                  </option>
                ))}
              </select>
            </div>
            <BotonSecundario
              onClick={() => abrirArchivo(kpiMes?.archivo_dashboard ?? null)}
              disabled={!kpiMes?.archivo_dashboard}
            >
              Ver dashboard
            </BotonSecundario>
            <BotonSecundario
              onClick={() => abrirArchivo(kpiMes?.archivo_reporte ?? null)}
              disabled={!kpiMes?.archivo_reporte}
            >
              Reporte del cierre
            </BotonSecundario>
            <BotonSecundario onClick={cargarInicio} disabled={loading}>
              {loading ? "Actualizando..." : "Actualizar"}
            </BotonSecundario>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && historial.length === 0 && (
          <Panel>
            <p className="text-sm text-zinc-600">
              Todavía no hay cierres cargados. Después del proceso mensual, ejecuta
              <strong> Sistema\Subir_a_SpartanOne.bat</strong> para publicarlo aquí.
            </p>
          </Panel>
        )}

        {kpiMes && (
          <>
            {/* KPI PRINCIPALES */}
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              <KpiCard
                label="Clientes que cumplen"
                value={`${number(kpiMes.cumplen)} / ${number(kpiMes.clientes)}`}
                detail={`${pct(num(kpiMes.cumplen) / Math.max(1, num(kpiMes.clientes)))} de los clientes con comodato`}
                delta={kpiAnterior ? num(kpiMes.cumplen) - num(kpiAnterior.cumplen) : null}
                mejorSiSube
                tone="green"
              />
              <KpiCard
                label="Clientes críticos"
                value={number(kpiMes.criticos)}
                detail={`${money(kpiMes.inversion_criticos)} invertidos`}
                delta={kpiAnterior ? num(kpiMes.criticos) - num(kpiAnterior.criticos) : null}
                tone="red"
              />
              <KpiCard
                label="En alerta"
                value={number(kpiMes.alertas)}
                detail="Sin compras en el mes cerrado"
                delta={kpiAnterior ? num(kpiMes.alertas) - num(kpiAnterior.alertas) : null}
                tone="amber"
              />
              <KpiCard
                label="Plazos vencidos o ≤ 90 días"
                value={number(kpiMes.vencimientos)}
                detail="Definir renovación o retiro"
                delta={kpiAnterior ? num(kpiMes.vencimientos) - num(kpiAnterior.vencimientos) : null}
                tone="violet"
              />
              <KpiCard
                label="Inversión ociosa a costo"
                value={money(kpiMes.costo_ocioso)}
                detail={`de ${money(kpiMes.inversion_costo)} invertidos a costo`}
                tone="cyan"
              />
              <KpiCard
                label="Evaluación vs venta real"
                value={pct(kpiMes.evaluacion_vs_real, 1)}
                detail={`${number(kpiMes.pagados)} comodatos ya recuperaron su costo`}
                tone="indigo"
              />
            </section>

            {/* RETORNO + EVOLUCIÓN */}
            <section className="mt-6 grid gap-4 xl:grid-cols-2">
              <Panel>
                <h2 className="font-semibold">Retorno por año de entrega</h2>
                <p className="mt-1 text-xs text-zinc-500">
                  Comercial: venta incremental 12m ÷ valor de las guías. Financiero: margen
                  incremental 12m ÷ costo de los equipos.
                </p>
                {cohortes.length === 0 ? (
                  <p className="mt-4 text-sm text-zinc-500">Sin años medibles en este cierre.</p>
                ) : (
                  <table className="mt-4 w-full text-sm">
                    <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th className="py-2">Año</th>
                        <th className="py-2 text-right">Retorno comercial</th>
                        <th className="py-2 text-right">Retorno financiero</th>
                        <th className="py-2 text-right">No rentables</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {cohortes.map((c) => (
                        <tr key={c.anio}>
                          <td className="py-2 font-medium">{c.anio}</td>
                          <td className="py-2 text-right tabular-nums">{ratioX(c.comercial)}</td>
                          <td className="py-2 text-right tabular-nums">{ratioX(c.financiero)}</td>
                          <td className="py-2 text-right tabular-nums">
                            {c.noRentables === null ? "—" : number(c.noRentables)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Panel>

              <Panel>
                <h2 className="font-semibold">Evolución de los cierres</h2>
                <p className="mt-1 text-xs text-zinc-500">Haz clic en un mes para verlo.</p>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th className="py-2">Cierre</th>
                        <th className="py-2 text-right">Clientes</th>
                        <th className="py-2 text-right">Cumplen</th>
                        <th className="py-2 text-right">Críticos</th>
                        <th className="py-2 text-right">Inv. en críticos</th>
                        <th className="py-2 text-right">Alertas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {[...historial].reverse().slice(0, 12).map((k) => (
                        <tr
                          key={k.periodo}
                          onClick={() => setPeriodo(k.periodo)}
                          className={`cursor-pointer transition hover:bg-zinc-50 ${
                            k.periodo === periodo ? "bg-blue-50/60 font-medium" : ""
                          }`}
                        >
                          <td className="py-2">{periodoTexto(k.periodo)}</td>
                          <td className="py-2 text-right tabular-nums">{number(k.clientes)}</td>
                          <td className="py-2 text-right tabular-nums">{number(k.cumplen)}</td>
                          <td className="py-2 text-right tabular-nums">{number(k.criticos)}</td>
                          <td className="py-2 text-right tabular-nums">{money(k.inversion_criticos)}</td>
                          <td className="py-2 text-right tabular-nums">{number(k.alertas)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </section>

            {/* FILTROS */}
            <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_280px_auto]">
                <div>
                  <FilterLabel>Buscar</FilterLabel>
                  <input
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Cliente, RUT, ejecutivo o motivo..."
                    className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <FilterLabel>Ejecutivo</FilterLabel>
                  <select
                    value={ejecutivoFiltro}
                    onChange={(e) => setEjecutivoFiltro(e.target.value)}
                    className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-blue-400"
                  >
                    <option value="TODOS">Todos</option>
                    {ejecutivos.map((e) => (
                      <option key={e} value={e}>
                        {e}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end gap-2">
                  <BotonSecundario
                    onClick={() => {
                      setBusqueda("");
                      setEjecutivoFiltro("TODOS");
                    }}
                  >
                    Limpiar
                  </BotonSecundario>
                  <button
                    type="button"
                    onClick={exportarExcel}
                    disabled={exportando || visibles.length === 0}
                    className="h-10 rounded-xl bg-emerald-700 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {exportando ? "Generando..." : `Descargar Excel (${number(visibles.length)})`}
                  </button>
                </div>
              </div>
            </section>

            {/* PESTAÑAS + TABLA */}
            <section className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="flex flex-wrap gap-1 border-b border-zinc-200 px-3 pt-3">
                {PESTANAS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPestana(p.id)}
                    className={`rounded-t-xl px-4 py-2 text-sm font-medium transition ${
                      pestana === p.id
                        ? "border border-b-white border-zinc-200 bg-white text-zinc-900 -mb-px"
                        : "text-zinc-500 hover:text-zinc-800"
                    }`}
                  >
                    {p.label}
                    <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                      {number(conteos[p.id])}
                    </span>
                  </button>
                ))}
              </div>

              <div className="grid gap-3 border-b border-zinc-100 px-5 py-3 sm:grid-cols-2 lg:grid-cols-4">
                <MiniTotal label="Clientes" value={number(totalVisible.clientes)} />
                <MiniTotal label="Inversión neta" value={money(totalVisible.inversion)} />
                <MiniTotal label="Venta prom. 3m" value={money(totalVisible.venta3m)} />
                <MiniTotal label="Compromiso mensual" value={money(totalVisible.compromiso)} />
              </div>

              <div className="overflow-x-auto">
                {cargandoMes ? (
                  <p className="px-6 py-12 text-center text-sm text-zinc-500">Cargando clientes...</p>
                ) : (
                  <TablaClientes filas={visibles} pestana={pestana} />
                )}
              </div>
            </section>

            {/* POR EJECUTIVO */}
            <section className="mt-6">
              <Panel>
                <h2 className="font-semibold">Resumen por ejecutivo</h2>
                <p className="mt-1 text-xs text-zinc-500">
                  Ordenado por inversión en clientes críticos. Clic para filtrar.
                </p>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[820px] text-sm">
                    <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th className="py-2">Ejecutivo</th>
                        <th className="py-2 text-right">Clientes</th>
                        <th className="py-2 text-right">Inversión neta</th>
                        <th className="py-2 text-right">Cumplen</th>
                        <th className="py-2 text-right">Críticos</th>
                        <th className="py-2 text-right">Inv. en críticos</th>
                        <th className="py-2 text-right">En alerta</th>
                        <th className="py-2 text-right">Plazos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {porEjecutivo.map((e) => (
                        <tr
                          key={e.ejecutivo}
                          onClick={() => setEjecutivoFiltro(e.ejecutivo)}
                          className="cursor-pointer transition hover:bg-zinc-50"
                        >
                          <td className="py-2 font-medium">{e.ejecutivo}</td>
                          <td className="py-2 text-right tabular-nums">{number(e.clientes)}</td>
                          <td className="py-2 text-right tabular-nums">{money(e.inversion)}</td>
                          <td className="py-2 text-right tabular-nums text-emerald-700">{number(e.cumplen)}</td>
                          <td className="py-2 text-right tabular-nums text-red-700">{number(e.criticos)}</td>
                          <td className="py-2 text-right tabular-nums">{money(e.invCriticos)}</td>
                          <td className="py-2 text-right tabular-nums text-amber-700">{number(e.alertas)}</td>
                          <td className="py-2 text-right tabular-nums">{number(e.plazo)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </section>

            <div className="mt-4 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xs leading-5 text-zinc-500">
              <strong className="font-semibold text-zinc-700">Crítico:</strong> sin compras en 90+
              días (o nunca), o bajo 50% del compromiso de la evaluación.{" "}
              <strong className="font-semibold text-zinc-700">En alerta:</strong> no es crítico,
              pero no compró en el mes cerrado.{" "}
              <strong className="font-semibold text-zinc-700">Cumple:</strong> compró en el mes y
              no es crítico. Las cifras vienen del cierre mensual y se evalúan por RUT empresa.
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// ============================================================
// TABLA DE CLIENTES (columnas según pestaña)
// ============================================================

function TablaClientes({ filas, pestana }: { filas: ControlRow[]; pestana: Pestana }) {
  const verPlazo = pestana === "PLAZO" || pestana === "TODOS";
  const verMotivo = pestana !== "CUMPLE" && pestana !== "PLAZO";

  return (
    <table className="w-full min-w-[1850px] text-sm">
      <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
        <tr>
          <th className="px-4 py-3">Control</th>
          <th className="px-4 py-3">Cliente</th>
          <th className="px-4 py-3">Ejecutivo</th>
          <th className="px-4 py-3 text-right">Inversión neta</th>
          <th className="px-4 py-3 text-right">Venta prom. 3m</th>
          <th className="px-4 py-3 text-right">Compromiso</th>
          <th className="px-4 py-3 text-right">Cumplimiento</th>
          {pestana === "CRITICO" && <th className="px-4 py-3 text-right">Meses crítico</th>}
          <th className="px-4 py-3 text-center">Recuperación</th>
          {verPlazo && <th className="px-4 py-3 text-center">Vencimiento</th>}
          {verMotivo && <th className="px-4 py-3">Motivo</th>}
          <th className="px-4 py-3">Acción sugerida</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-100">
        {filas.map((r) => (
          <tr key={r.rut_key} className="align-top transition hover:bg-zinc-50/80">
            <td className="px-4 py-3">
              <span
                className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${controlBadge(r.estado_control)}`}
              >
                {controlTexto(r.estado_control)}
              </span>
            </td>
            <td className="max-w-[300px] px-4 py-3">
              <div className="font-medium text-zinc-900">{r.cliente || "—"}</div>
              <div className="text-xs text-zinc-400">{r.rut}</div>
            </td>
            <td className="whitespace-nowrap px-4 py-3 text-zinc-600">{ejecutivoLimpio(r.ejecutivo) || "—"}</td>
            <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums">
              {money(r.inversion_neta)}
            </td>
            <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{money(r.venta_prom_3m)}</td>
            <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
              {r.compromiso_mensual ? money(r.compromiso_mensual) : "—"}
            </td>
            <td className="whitespace-nowrap px-4 py-3 text-right">
              <Cumplimiento valor={r.cumplimiento} />
            </td>
            {pestana === "CRITICO" && (
              <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                {r.meses_seguidos_critico ? number(r.meses_seguidos_critico) : "—"}
              </td>
            )}
            <td className="whitespace-nowrap px-4 py-3 text-center text-xs text-zinc-600">
              {recuperacionTexto(r.estado_recuperacion)}
            </td>
            {verPlazo && (
              <td className="whitespace-nowrap px-4 py-3 text-center">
                {r.vencimiento ? (
                  <>
                    <div className="text-zinc-700">{dateCL(r.vencimiento)}</div>
                    <div
                      className={`text-xs ${num(r.dias_a_vencimiento) < 0 ? "text-red-600" : "text-amber-600"}`}
                    >
                      {num(r.dias_a_vencimiento) < 0
                        ? `Vencido hace ${number(Math.abs(num(r.dias_a_vencimiento)))} días`
                        : `Vence en ${number(r.dias_a_vencimiento)} días`}
                    </div>
                  </>
                ) : (
                  <span className="text-xs text-zinc-400">—</span>
                )}
              </td>
            )}
            {verMotivo && (
              <td className="min-w-[340px] max-w-[460px] px-4 py-3 text-xs leading-5 text-zinc-600">{r.motivo || "—"}</td>
            )}
            <td className="min-w-[220px] max-w-[300px] px-4 py-3 text-xs leading-5 text-zinc-700">
              {(pestana === "PLAZO" ? r.accion_vencimiento : r.accion_sugerida || r.accion_vencimiento) || "—"}
            </td>
          </tr>
        ))}
        {filas.length === 0 && (
          <tr>
            <td colSpan={12} className="px-6 py-12 text-center text-sm text-zinc-500">
              No hay clientes para los filtros seleccionados.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

// ============================================================
// COMPONENTES
// ============================================================

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 p-8">
      <div className="mx-auto max-w-3xl">{children}</div>
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">{children}</div>;
}

function FilterLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">
      {children}
    </label>
  );
}

function BotonSecundario({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-10 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function Cumplimiento({ valor }: { valor: number | null }) {
  if (valor === null || valor === undefined) return <span className="text-zinc-400">—</span>;
  const v = Math.max(0, Number(valor));
  const color = v >= 1 ? "bg-emerald-500" : v >= 0.5 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="inline-flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-100">
        <div className={`h-full ${color}`} style={{ width: `${Math.min(100, v * 100)}%` }} />
      </div>
      <span className="tabular-nums text-zinc-700">{pct(v)}</span>
    </div>
  );
}

function KpiCard({
  label,
  value,
  detail,
  tone,
  delta = null,
  mejorSiSube = false,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "green" | "red" | "amber" | "violet" | "cyan" | "indigo";
  delta?: number | null;
  mejorSiSube?: boolean;
}) {
  const styles = {
    green: "border-emerald-200 border-l-emerald-500 bg-emerald-50/70 text-emerald-700",
    red: "border-red-200 border-l-red-500 bg-red-50/70 text-red-700",
    amber: "border-amber-200 border-l-amber-500 bg-amber-50/70 text-amber-700",
    violet: "border-violet-200 border-l-violet-500 bg-violet-50/70 text-violet-700",
    cyan: "border-cyan-200 border-l-cyan-500 bg-cyan-50/70 text-cyan-700",
    indigo: "border-indigo-200 border-l-indigo-500 bg-indigo-50/70 text-indigo-700",
  };

  const bueno = delta !== null && (mejorSiSube ? delta > 0 : delta < 0);
  const malo = delta !== null && (mejorSiSube ? delta < 0 : delta > 0);

  return (
    <div className={`rounded-2xl border border-l-4 p-5 shadow-sm ${styles[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
      <div className="mt-3 flex items-baseline gap-2">
        <p className="text-2xl font-bold tracking-tight text-zinc-950">{value}</p>
        {delta !== null && delta !== 0 && (
          <span
            className={`text-xs font-semibold ${bueno ? "text-emerald-700" : malo ? "text-red-700" : "text-zinc-500"}`}
            title="Variación vs cierre anterior"
          >
            {delta > 0 ? "▲" : "▼"} {number(Math.abs(delta))}
          </span>
        )}
      </div>
      <p className="mt-2 text-xs leading-5 text-zinc-600">{detail}</p>
    </div>
  );
}

function MiniTotal({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-zinc-900">{value}</p>
    </div>
  );
}
