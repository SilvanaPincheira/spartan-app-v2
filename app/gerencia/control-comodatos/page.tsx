"use client";

// ============================================================
// SpartanOne · Gerencia · Control Mensual de Comodatos
//
// Lee el cierre que sube Sistema/subir_supabase.py:
//   comodatos_kpis_mensual  -> indicadores de cada cierre
//   comodatos_control       -> estado de cada RUT en cada cierre
//   Storage reportes-comodatos -> Excel y dashboard del mes
// ============================================================

import { Fragment, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

// ============================================================
// TIPOS
// ============================================================

type EstadoControl = "CRITICO" | "ALERTA" | "CUMPLE" | "SIN CLASIFICAR" | "RETIRADO" | "INACTIVO";

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
  tiene_contrato: boolean | null;
  fecha_contrato: string | null;
  plazo_meses: number | null;
  renovacion_meses: number | null;
  fuente_condiciones: string | null;
  inicio_vigencia: string | null;
  primera_guia: string | null;
  contrato_archivo: string | null;
  contrato_pdf: string | null;
};

type ContratoRow = {
  archivo: string;
  tipo: string | null;
  cliente: string | null;
  rut: string | null;
  rut_key: string | null;
  fecha_contrato: string | null;
  plazo_meses: number | null;
  renovacion_meses: number | null;
  compromiso_compra: string | null;
  equipos: string | null;
  usar: boolean | null;
  observaciones: string | null;
  pdf: string | null;
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

type CompromisoManual = {
  rut_key: string;
  rut: string;
  cliente: string | null;
  compromiso_mensual: number;
  nota: string | null;
  editado_por: string | null;
  editado_en: string | null;
};

type EstadoGestion = {
  rut_key: string;
  rut: string;
  cliente: string | null;
  estado: "RETIRADO" | "INACTIVO";
  fecha: string | null;
  nota: string | null;
  editado_por: string | null;
  editado_en: string | null;
};

type AccionesEstado = {
  puedeEditar: boolean;
  estados: Map<string, EstadoGestion>;
  guardar: (r: ControlRow, estado: "RETIRADO" | "INACTIVO", fecha: string, nota: string) => Promise<boolean>;
  quitar: (r: ControlRow) => Promise<boolean>;
};

type AccionesCompromiso = {
  puedeEditar: boolean;
  manuales: Map<string, CompromisoManual>;
  guardar: (r: ControlRow, monto: number, nota: string) => Promise<boolean>;
  quitar: (r: ControlRow) => Promise<boolean>;
};

type Perfil = { role?: string | null; department?: string | null; email?: string | null };

type Pestana = "CRITICO" | "ALERTA" | "CUMPLE" | "PLAZO" | "CONTRATO" | "RETIRADO" | "TODOS";

const BUCKET_REPORTES = "reportes-comodatos";

const PESTANAS: { id: Pestana; label: string }[] = [
  { id: "CRITICO", label: "Críticos" },
  { id: "ALERTA", label: "En alerta" },
  { id: "CUMPLE", label: "Cumplen" },
  { id: "PLAZO", label: "Plazos vencidos / por vencer" },
  { id: "CONTRATO", label: "Con contrato firmado" },
  { id: "RETIRADO", label: "Retirados / inactivos" },
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
    case "RETIRADO":
      return "Retirado";
    case "INACTIVO":
      return "Inactivo";
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
    case "RETIRADO":
      return "border-zinc-300 bg-zinc-100 text-zinc-600 line-through decoration-zinc-400";
    case "INACTIVO":
      return "border-slate-300 bg-slate-100 text-slate-600";
    default:
      return "border-zinc-200 bg-zinc-50 text-zinc-500";
  }
}

function recuperacionTexto(estado: string | null) {
  if (!estado) return "—";
  return estado === "PAGADO" ? "Recuperada" : estado.toLowerCase();
}

function fuenteTexto(r: ControlRow) {
  if (r.tiene_contrato) return "Contrato firmado";
  const f = String(r.fuente_condiciones || r.fuente_plazo || "").toUpperCase();
  if (f.startsWith("EVALUA")) return "Evaluación de negocio";
  if (f.startsWith("PLAZO")) return "Plazo estándar";
  return f ? f.charAt(0) + f.slice(1).toLowerCase() : "Sin plazo";
}

function mesesTexto(m: number | null | undefined) {
  if (!m) return "—";
  return m % 12 === 0 ? `${m / 12} año${m / 12 === 1 ? "" : "s"}` : `${m} meses`;
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
  const [contratos, setContratos] = useState<ContratoRow[]>([]);
  const [manuales, setManuales] = useState<Map<string, CompromisoManual>>(new Map());
  const [estados, setEstados] = useState<Map<string, EstadoGestion>>(new Map());
  const [puedeEditar, setPuedeEditar] = useState(false);
  const [emailUsuario, setEmailUsuario] = useState("");

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
      setPuedeEditar(accesoEspecial); // la base de datos también lo valida (RLS)
      setEmailUsuario(email);

      const { data, error: kpiError } = await supabase
        .from("comodatos_kpis_mensual")
        .select("*")
        .order("periodo", { ascending: true });

      if (kpiError) throw kpiError;

      // Registro de contratos firmados (si la tabla aún no existe, se omite)
      const { data: ctData, error: ctError } = await supabase
        .from("comodatos_contratos")
        .select("*")
        .order("fecha_contrato", { ascending: false });
      if (ctError) console.warn("Contratos no disponibles:", ctError);
      setContratos(((ctData || []) as ContratoRow[]));

      // Compromisos fijados a mano (si la tabla aún no existe, se omite)
      const { data: cmData, error: cmError } = await supabase
        .from("comodatos_compromisos")
        .select("*");
      if (cmError) console.warn("Compromisos manuales no disponibles:", cmError);
      setManuales(new Map(((cmData || []) as CompromisoManual[]).map((c) => [c.rut_key, c])));

      // Clientes marcados como retirados / inactivos (si la tabla aún no existe, se omite)
      const { data: esData, error: esError } = await supabase
        .from("comodatos_estado_cliente")
        .select("*");
      if (esError) console.warn("Estados de clientes no disponibles:", esError);
      setEstados(new Map(((esData || []) as EstadoGestion[]).map((e) => [e.rut_key, e])));

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

  // Estado efectivo: lo marcado en SpartanOne manda sobre el cierre
  const estadoDe = useCallback(
    (r: ControlRow): EstadoControl => estados.get(r.rut_key)?.estado ?? r.estado_control,
    [estados]
  );
  const esMarcado = useCallback(
    (r: ControlRow) => {
      const e = estadoDe(r);
      return e === "RETIRADO" || e === "INACTIVO";
    },
    [estadoDe]
  );

  const alcanceActivo = useMemo(() => alcance.filter((r) => !esMarcado(r)), [alcance, esMarcado]);

  const conteos = useMemo(
    () => ({
      CRITICO: alcanceActivo.filter((r) => r.estado_control === "CRITICO").length,
      ALERTA: alcanceActivo.filter((r) => r.estado_control === "ALERTA").length,
      CUMPLE: alcanceActivo.filter((r) => r.estado_control === "CUMPLE").length,
      PLAZO: alcanceActivo.filter(enPlazo).length,
      CONTRATO: alcanceActivo.filter((r) => r.tiene_contrato).length,
      RETIRADO: alcance.filter(esMarcado).length,
      TODOS: alcance.length,
    }),
    [alcance, alcanceActivo, esMarcado]
  );

  const guardarEstado = useCallback(
    async (r: ControlRow, estado: "RETIRADO" | "INACTIVO", fecha: string, nota: string) => {
      const fila: EstadoGestion = {
        rut_key: r.rut_key,
        rut: r.rut,
        cliente: r.cliente,
        estado,
        fecha: fecha || null,
        nota: nota.trim() || null,
        editado_por: emailUsuario,
        editado_en: new Date().toISOString(),
      };
      const { error: e } = await supabase
        .from("comodatos_estado_cliente")
        .upsert(fila, { onConflict: "rut_key" });
      if (e) {
        setError(`No se pudo guardar el estado: ${e.message}`);
        return false;
      }
      setEstados((prev) => new Map(prev).set(r.rut_key, fila));
      return true;
    },
    [supabase, emailUsuario]
  );

  const quitarEstado = useCallback(
    async (r: ControlRow) => {
      const { error: e } = await supabase
        .from("comodatos_estado_cliente")
        .delete()
        .eq("rut_key", r.rut_key);
      if (e) {
        setError(`No se pudo reactivar el cliente: ${e.message}`);
        return false;
      }
      setEstados((prev) => {
        const m = new Map(prev);
        m.delete(r.rut_key);
        return m;
      });
      return true;
    },
    [supabase]
  );

  const accionesEstado: AccionesEstado = useMemo(
    () => ({ puedeEditar, estados, guardar: guardarEstado, quitar: quitarEstado }),
    [puedeEditar, estados, guardarEstado, quitarEstado]
  );

  const compEfectivo = useCallback(
    (r: ControlRow) => manuales.get(r.rut_key)?.compromiso_mensual ?? r.compromiso_mensual,
    [manuales]
  );

  const guardarCompromiso = useCallback(
    async (r: ControlRow, monto: number, nota: string) => {
      const fila = {
        rut_key: r.rut_key,
        rut: r.rut,
        cliente: r.cliente,
        compromiso_mensual: Math.round(monto),
        nota: nota.trim() || null,
        editado_por: emailUsuario,
        editado_en: new Date().toISOString(),
      };
      const { error: e } = await supabase
        .from("comodatos_compromisos")
        .upsert(fila, { onConflict: "rut_key" });
      if (e) {
        setError(`No se pudo guardar el compromiso: ${e.message}`);
        return false;
      }
      setManuales((prev) => new Map(prev).set(r.rut_key, fila as CompromisoManual));
      return true;
    },
    [supabase, emailUsuario]
  );

  const quitarCompromiso = useCallback(
    async (r: ControlRow) => {
      const { error: e } = await supabase
        .from("comodatos_compromisos")
        .delete()
        .eq("rut_key", r.rut_key);
      if (e) {
        setError(`No se pudo quitar el compromiso: ${e.message}`);
        return false;
      }
      setManuales((prev) => {
        const m = new Map(prev);
        m.delete(r.rut_key);
        return m;
      });
      return true;
    },
    [supabase]
  );

  const accionesCompromiso: AccionesCompromiso = useMemo(
    () => ({ puedeEditar, manuales, guardar: guardarCompromiso, quitar: quitarCompromiso }),
    [puedeEditar, manuales, guardarCompromiso, quitarCompromiso]
  );

  const visibles = useMemo(() => {
    const lista =
      pestana === "TODOS"
        ? alcance
        : pestana === "RETIRADO"
        ? alcance.filter(esMarcado)
        : pestana === "PLAZO"
        ? alcanceActivo.filter(enPlazo)
        : pestana === "CONTRATO"
        ? alcanceActivo.filter((r) => r.tiene_contrato)
        : alcanceActivo.filter((r) => r.estado_control === pestana);

    return [...lista].sort((a, b) => {
      if (pestana === "PLAZO" || pestana === "CONTRATO") return num(a.dias_a_vencimiento) - num(b.dias_a_vencimiento);
      if (pestana === "CRITICO") {
        const m = num(b.meses_seguidos_critico) - num(a.meses_seguidos_critico);
        if (m !== 0) return m;
      }
      return num(b.inversion_neta) - num(a.inversion_neta);
    });
  }, [alcance, alcanceActivo, esMarcado, pestana]);

  const contratosSinCliente = useMemo(() => {
    const ruts = new Set(filas.map((r) => r.rut_key));
    return contratos.filter((c) => !c.rut_key || !ruts.has(c.rut_key));
  }, [contratos, filas]);

  const totalVisible = useMemo(
    () => ({
      clientes: visibles.length,
      inversion: visibles.reduce((acc, r) => acc + num(r.inversion_neta), 0),
      venta3m: visibles.reduce((acc, r) => acc + num(r.venta_prom_3m), 0),
      compromiso: visibles.reduce((acc, r) => acc + num(compEfectivo(r)), 0),
    }),
    [visibles, compEfectivo]
  );

  // Resumen por ejecutivo (responde a la búsqueda, no a la pestaña)
  const porEjecutivo = useMemo(() => {
    const mapa = new Map<
      string,
      { ejecutivo: string; clientes: number; inversion: number; criticos: number; invCriticos: number; alertas: number; cumplen: number; plazo: number }
    >();
    alcanceActivo.forEach((r) => {
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
  }, [alcanceActivo]);

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
        { header: "Nota estado", key: "notaEstado", width: 30 },
        { header: "Cliente", key: "cliente", width: 44 },
        { header: "RUT", key: "rut", width: 14 },
        { header: "Ejecutivo", key: "ejecutivo", width: 28 },
        { header: "Inversión neta", key: "inversion", width: 18 },
        { header: "Venta prom. 3m", key: "v3", width: 17 },
        { header: "Venta prom. 12m", key: "v12", width: 17 },
        { header: "Compromiso mensual (cierre)", key: "comp", width: 19 },
        { header: "Cumplimiento", key: "cump", width: 14 },
        { header: "Días sin compra", key: "dias", width: 15 },
        { header: "Meses seguidos crítico", key: "meses", width: 20 },
        { header: "Motivo", key: "motivo", width: 70 },
        { header: "Acción sugerida", key: "accion", width: 42 },
        { header: "Recuperación inversión", key: "recup", width: 20 },
        { header: "Vencimiento", key: "venc", width: 14 },
        { header: "Días a vencimiento", key: "diasVenc", width: 17 },
        { header: "Condiciones", key: "fuente", width: 22 },
        { header: "Fecha contrato", key: "fContrato", width: 15 },
        { header: "Plazo inicial", key: "plazo", width: 13 },
        { header: "Renovación automática", key: "renov", width: 20 },
        { header: "Contrato (PDF)", key: "archivo", width: 48 },
        { header: "Compromiso manual", key: "compMan", width: 18 },
        { header: "Nota compromiso manual", key: "notaMan", width: 40 },
      ];

      visibles.forEach((r) =>
        hoja.addRow({
          control: controlTexto(estados.get(r.rut_key)?.estado ?? r.estado_control),
          notaEstado: estados.get(r.rut_key)?.nota ?? "",
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
          fuente: fuenteTexto(r),
          fContrato: r.fecha_contrato ? dateCL(r.fecha_contrato) : "",
          plazo: r.tiene_contrato ? mesesTexto(r.plazo_meses) : "",
          renov: r.tiene_contrato ? mesesTexto(r.renovacion_meses) : "",
          archivo: r.contrato_archivo || "",
          compMan: manuales.get(r.rut_key)?.compromiso_mensual ?? null,
          notaMan: manuales.get(r.rut_key)?.nota ?? "",
        })
      );

      hoja.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      hoja.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
      hoja.getRow(1).height = 25;
      hoja.autoFilter = { from: "A1", to: "X1" };
      hoja.getColumn(23).numFmt = '"$"#,##0';
      [6, 7, 8, 9].forEach((c) => (hoja.getColumn(c).numFmt = '"$"#,##0'));
      hoja.getColumn(10).numFmt = "0%";

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
  }, [visibles, exportando, pestana, periodo, manuales, estados]);

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
                  <TablaClientes
                    filas={visibles}
                    pestana={pestana}
                    onAbrir={abrirArchivo}
                    compromisos={accionesCompromiso}
                    estados={accionesEstado}
                  />
                )}
              </div>

              {pestana === "CONTRATO" && contratosSinCliente.length > 0 && (
                <div className="border-t border-zinc-200 px-5 py-4">
                  <h3 className="text-sm font-semibold text-zinc-900">
                    Contratos firmados sin comodato en SAP ({number(contratosSinCliente.length)})
                  </h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    Están en el registro de contratos, pero su RUT no tiene guías de comodato en
                    este cierre (posible entrega a otro RUT, o no es comodato).
                  </p>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[900px] text-sm">
                      <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
                        <tr>
                          <th className="py-2">Cliente según contrato</th>
                          <th className="py-2">Tipo</th>
                          <th className="py-2">Fecha</th>
                          <th className="py-2">Plazo</th>
                          <th className="py-2">Observaciones</th>
                          <th className="py-2 text-right">PDF</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {contratosSinCliente.map((c) => (
                          <tr key={c.archivo} className="align-top">
                            <td className="py-2 pr-4">
                              <div className="font-medium">{c.cliente || c.archivo}</div>
                              <div className="text-xs text-zinc-400">{c.rut || "—"}</div>
                            </td>
                            <td className="py-2 pr-4 text-xs">{c.tipo || "—"}</td>
                            <td className="whitespace-nowrap py-2 pr-4">{dateCL(c.fecha_contrato)}</td>
                            <td className="whitespace-nowrap py-2 pr-4">{mesesTexto(c.plazo_meses)}</td>
                            <td className="max-w-[420px] py-2 pr-4 text-xs text-zinc-600">{c.observaciones || "—"}</td>
                            <td className="py-2 text-right">
                              {c.pdf ? (
                                <button
                                  type="button"
                                  onClick={() => abrirArchivo(c.pdf)}
                                  className="text-xs font-medium text-blue-600 hover:underline"
                                >
                                  Ver PDF
                                </button>
                              ) : (
                                <span className="text-xs text-zinc-400">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
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

function TablaClientes({
  filas,
  pestana,
  onAbrir,
  compromisos,
  estados,
}: {
  filas: ControlRow[];
  pestana: Pestana;
  onAbrir: (ruta: string | null) => void;
  compromisos: AccionesCompromiso;
  estados: AccionesEstado;
}) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const alternar = (k: string) => setAbierto((a) => (a === k ? null : k));
  const parar = (e: { stopPropagation: () => void }) => e.stopPropagation();

  return (
    <table className="w-full table-fixed text-sm">
      <colgroup>
        <col className="w-[34px]" />
        <col className="w-[128px]" />
        <col />
        <col className="w-[130px]" />
        <col className="w-[120px]" />
        <col className="w-[150px]" />
        <col className="w-[140px]" />
        <col className="w-[190px]" />
      </colgroup>
      <thead className="bg-zinc-50 text-left text-[11px] uppercase tracking-wide text-zinc-500">
        <tr>
          <th className="py-3 pl-3" />
          <th className="px-2 py-3">Control</th>
          <th className="px-2 py-3">Cliente · ejecutivo</th>
          <th className="px-2 py-3 text-right">Inversión neta</th>
          <th className="px-2 py-3 text-right">Venta prom. 3m</th>
          <th className="px-2 py-3 text-right">Compromiso</th>
          <th className="px-2 py-3">Cumplimiento</th>
          <th className="px-2 py-3">Contrato / plazo</th>
        </tr>
      </thead>
      <tbody>
        {filas.map((r) => {
          const open = abierto === r.rut_key;
          const man = compromisos.manuales.get(r.rut_key);
          const prov =
            man && man.compromiso_mensual > 0 ? num(r.venta_prom_3m) / man.compromiso_mensual : null;
          return (
            <Fragment key={r.rut_key}>
              <tr
                onClick={() => alternar(r.rut_key)}
                className={`cursor-pointer border-t border-zinc-100 align-top transition ${
                  open ? "bg-blue-50/40" : "hover:bg-zinc-50/80"
                }`}
              >
                <td className="py-3 pl-3 text-zinc-400">
                  <span className={`inline-block transition-transform ${open ? "rotate-90 text-blue-600" : ""}`}>
                    ▸
                  </span>
                </td>
                <td className="px-2 py-3" onClick={parar}>
                  <EstadoCelda r={r} acciones={estados} />
                </td>
                <td className="px-2 py-3">
                  <div className="line-clamp-2 font-medium leading-5 text-zinc-900" title={r.cliente || ""}>
                    {r.cliente || "—"}
                  </div>
                  <div className="truncate text-xs text-zinc-400">
                    {r.rut} · {ejecutivoLimpio(r.ejecutivo) || "Sin ejecutivo"}
                  </div>
                </td>
                <td className="whitespace-nowrap px-2 py-3 text-right font-medium tabular-nums">
                  {money(r.inversion_neta)}
                </td>
                <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums">{money(r.venta_prom_3m)}</td>
                <td className="px-2 py-3 text-right" onClick={parar}>
                  <CompromisoCelda r={r} acciones={compromisos} />
                </td>
                <td className="px-2 py-3">
                  {man ? (
                    <div title="Calculado con el compromiso manual. La clasificación se actualiza en el próximo cierre.">
                      <Cumplimiento valor={prov} />
                      <div className="text-[11px] text-violet-600">provisorio</div>
                    </div>
                  ) : (
                    <Cumplimiento valor={r.cumplimiento} />
                  )}
                </td>
                <td className="px-2 py-3">
                  <ContratoCompacto r={r} />
                </td>
              </tr>
              {open && (
                <tr className="bg-blue-50/40">
                  <td />
                  <td colSpan={7} className="px-2 pb-4">
                    <DetalleCliente r={r} pestana={pestana} onAbrir={onAbrir} compromiso={man} estado={estados.estados.get(r.rut_key)} />
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
        {filas.length === 0 && (
          <tr>
            <td colSpan={8} className="px-6 py-12 text-center text-sm text-zinc-500">
              No hay clientes para los filtros seleccionados.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function ContratoCompacto({ r }: { r: ControlRow }) {
  const dias = r.dias_a_vencimiento;
  const color =
    dias === null ? "text-zinc-400" : dias < 0 ? "text-red-600" : dias <= 90 ? "text-amber-600" : "text-zinc-500";
  return (
    <div className="space-y-0.5">
      <span
        className={`inline-flex max-w-full truncate rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
          r.tiene_contrato ? "border-blue-200 bg-blue-50 text-blue-700" : "border-zinc-200 bg-zinc-50 text-zinc-500"
        }`}
      >
        {fuenteTexto(r)}
      </span>
      <div className={`truncate text-xs ${color}`}>
        {dias === null
          ? "Sin vencimiento"
          : dias < 0
          ? `Vencido hace ${number(Math.abs(dias))} d`
          : `Vence en ${number(dias)} d`}
      </div>
    </div>
  );
}

function Dato({ label, children, ancho }: { label: string; children: ReactNode; ancho?: boolean }) {
  return (
    <div className={ancho ? "sm:col-span-2 lg:col-span-4" : ""}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <div className="mt-0.5 text-sm text-zinc-800">{children}</div>
    </div>
  );
}

function DetalleCliente({
  r,
  pestana,
  onAbrir,
  compromiso,
  estado,
}: {
  r: ControlRow;
  pestana: Pestana;
  onAbrir: (ruta: string | null) => void;
  compromiso?: CompromisoManual;
  estado?: EstadoGestion;
}) {
  const accion = pestana === "PLAZO" ? r.accion_vencimiento : r.accion_sugerida || r.accion_vencimiento;
  const marcado = estado || r.estado_control === "RETIRADO" || r.estado_control === "INACTIVO";

  return (
    <div className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(r.motivo || accion) && (
          <>
            <Dato label="Motivo" ancho={!accion}>
              {r.motivo || "—"}
            </Dato>
            {accion && (
              <div className="sm:col-span-1 lg:col-span-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Acción sugerida</p>
                <p className="mt-0.5 text-sm font-medium text-blue-800">{accion}</p>
              </div>
            )}
          </>
        )}

        {marcado && (
          <Dato label="Estado de gestión" ancho>
            {controlTexto(estado?.estado ?? r.estado_control)}
            {estado?.fecha && ` desde ${dateCL(estado.fecha)}`}
            {estado?.nota && ` · ${estado.nota}`}
            {num(r.inversion_neta) > 0 && (
              <span className="ml-2 font-medium text-red-700">
                · Falta registrar la entrada de comodato en SAP ({money(r.inversion_neta)} aún figura como inversión)
              </span>
            )}
          </Dato>
        )}

        <Dato label="Venta prom. 12m">{money(r.venta_prom_12m)}</Dato>
        <Dato label="Días sin compra">{r.dias_sin_compra === null ? "—" : number(r.dias_sin_compra)}</Dato>
        <Dato label="Meses seguidos crítico">
          {r.meses_seguidos_critico ? number(r.meses_seguidos_critico) : "—"}
        </Dato>
        <Dato label="Recuperación de la inversión">
          {recuperacionTexto(r.estado_recuperacion)}
          {r.recuperacion !== null && r.recuperacion !== undefined && r.estado_recuperacion !== "PAGADO"
            ? ` (${pct(r.recuperacion)})`
            : ""}
        </Dato>

        <Dato label="Inversión a costo">{money(r.inversion_costo)}</Dato>
        <Dato label="Primera guía">{dateCL(r.primera_guia)}</Dato>
        <Dato label="Compromiso de evaluación">
          {r.compromiso_mensual ? money(r.compromiso_mensual) : "Sin evaluación"}
        </Dato>
        <Dato label="Compromiso manual">
          {compromiso ? (
            <>
              {money(compromiso.compromiso_mensual)}
              {compromiso.nota && <span className="text-zinc-500"> · {compromiso.nota}</span>}
            </>
          ) : (
            "—"
          )}
        </Dato>

        <Dato label="Condiciones">{fuenteTexto(r)}</Dato>
        <Dato label="Contrato">
          {r.tiene_contrato ? (
            <>
              Firmado {dateCL(r.fecha_contrato)} · {mesesTexto(r.plazo_meses)}
              {r.renovacion_meses ? ` + renov. ${mesesTexto(r.renovacion_meses)}` : ""}
            </>
          ) : (
            "Sin contrato firmado"
          )}
        </Dato>
        <Dato label="Vigencia">
          {dateCL(r.inicio_vigencia)} → {dateCL(r.vencimiento)}
        </Dato>
        <Dato label="Documento">
          {r.contrato_pdf ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAbrir(r.contrato_pdf);
              }}
              className="font-medium text-blue-600 hover:underline"
            >
              Ver contrato PDF
            </button>
          ) : (
            "—"
          )}
        </Dato>
      </div>
    </div>
  );
}

function EstadoCelda({ r, acciones }: { r: ControlRow; acciones: AccionesEstado }) {
  const marca = acciones.estados.get(r.rut_key);
  const estado: EstadoControl = marca?.estado ?? r.estado_control;
  const [editando, setEditando] = useState(false);
  const [nuevo, setNuevo] = useState<"ACTIVO" | "RETIRADO" | "INACTIVO">("RETIRADO");
  const [fecha, setFecha] = useState("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);

  const abrir = () => {
    setNuevo(marca?.estado ?? "RETIRADO");
    setFecha(marca?.fecha ?? new Date().toISOString().slice(0, 10));
    setNota(marca?.nota ?? "");
    setEditando(true);
  };

  if (editando) {
    return (
      <div className="relative" onClick={(e) => e.stopPropagation()}>
      <div className="absolute left-0 top-0 z-30 w-[250px] space-y-1.5 rounded-xl border border-zinc-200 bg-white p-3 shadow-xl">
        <select
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value as typeof nuevo)}
          className="h-8 w-full rounded-lg border border-zinc-300 bg-white px-2 text-sm outline-none focus:border-blue-400"
        >
          <option value="RETIRADO">Retirado (equipos retirados)</option>
          <option value="INACTIVO">Inactivo (cliente sin operación)</option>
          {marca && <option value="ACTIVO">Activo (volver al control)</option>}
        </select>
        {nuevo !== "ACTIVO" && (
          <>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="h-8 w-full rounded-lg border border-zinc-300 px-2 text-sm outline-none focus:border-blue-400"
            />
            <input
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Nota (quién retiró, guía, motivo...)"
              className="h-8 w-full rounded-lg border border-zinc-300 px-2 text-xs outline-none focus:border-blue-400"
            />
          </>
        )}
        <div className="flex items-center justify-end gap-2 text-xs">
          <button type="button" onClick={() => setEditando(false)} className="text-zinc-500 hover:underline">
            Cancelar
          </button>
          <button
            type="button"
            disabled={guardando}
            onClick={async () => {
              setGuardando(true);
              const ok =
                nuevo === "ACTIVO" ? await acciones.quitar(r) : await acciones.guardar(r, nuevo, fecha, nota);
              if (ok) setEditando(false);
              setGuardando(false);
            }}
            className="rounded-md bg-blue-600 px-2.5 py-1 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {guardando ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      <div className="inline-flex items-center gap-1">
        <span
          className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${controlBadge(estado)}`}
          title={
            marca
              ? [marca.nota, marca.editado_por ? `Marcado por ${marca.editado_por} el ${dateCL(marca.editado_en)}` : ""]
                  .filter(Boolean)
                  .join("\n")
              : undefined
          }
        >
          {controlTexto(estado)}
        </span>
        {acciones.puedeEditar && (
          <button
            type="button"
            onClick={abrir}
            title="Marcar como retirado / inactivo"
            className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-blue-600"
          >
            ✎
          </button>
        )}
      </div>
      {marca?.fecha && <div className="text-[11px] text-zinc-500">desde {dateCL(marca.fecha)}</div>}
      {(estado === "RETIRADO" || estado === "INACTIVO") && num(r.inversion_neta) > 0 && (
        <div
          className="text-[11px] font-medium text-red-600"
          title="El cliente sigue con inversión neta en SAP: falta registrar la Entrada de comodato."
        >
          Sin entrada en SAP
        </div>
      )}
      {marca && r.estado_control !== marca.estado && !["RETIRADO", "INACTIVO"].includes(r.estado_control) && (
        <div className="text-[11px] text-zinc-400">cierre: {controlTexto(r.estado_control)}</div>
      )}
    </div>
  );
}

function CompromisoCelda({ r, acciones }: { r: ControlRow; acciones: AccionesCompromiso }) {
  const man = acciones.manuales.get(r.rut_key);
  const [editando, setEditando] = useState(false);
  const [monto, setMonto] = useState("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);

  const abrir = () => {
    const base = man?.compromiso_mensual ?? r.compromiso_mensual;
    setMonto(base ? String(Math.round(base)) : "");
    setNota(man?.nota ?? "");
    setEditando(true);
  };

  const valor = Number(String(monto).replace(/[^0-9]/g, ""));

  if (editando) {
    return (
      <div className="relative" onClick={(e) => e.stopPropagation()}>
      <div className="absolute right-0 top-0 z-30 w-[240px] space-y-1.5 rounded-xl border border-zinc-200 bg-white p-3 text-left shadow-xl">
        <input
          autoFocus
          inputMode="numeric"
          value={monto ? `$${Number(String(monto).replace(/[^0-9]/g, "") || 0).toLocaleString("es-CL")}` : ""}
          onChange={(e) => setMonto(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="$ mensual"
          className="h-8 w-full rounded-lg border border-zinc-300 px-2 text-right text-sm tabular-nums outline-none focus:border-blue-400"
        />
        <input
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Nota (motivo, acuerdo...)"
          className="h-8 w-full rounded-lg border border-zinc-300 px-2 text-xs outline-none focus:border-blue-400"
        />
        <div className="flex items-center justify-end gap-2 text-xs">
          {man && (
            <button
              type="button"
              disabled={guardando}
              onClick={async () => {
                setGuardando(true);
                if (await acciones.quitar(r)) setEditando(false);
                setGuardando(false);
              }}
              className="mr-auto text-red-600 hover:underline disabled:opacity-50"
            >
              Quitar
            </button>
          )}
          <button type="button" onClick={() => setEditando(false)} className="text-zinc-500 hover:underline">
            Cancelar
          </button>
          <button
            type="button"
            disabled={guardando || !valor}
            onClick={async () => {
              setGuardando(true);
              if (await acciones.guardar(r, valor, nota)) setEditando(false);
              setGuardando(false);
            }}
            className="rounded-md bg-blue-600 px-2.5 py-1 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {guardando ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
      </div>
    );
  }

  return (
    <div className="inline-flex flex-col items-end">
      <div className="inline-flex items-center gap-1.5">
        <span className="tabular-nums">
          {man ? money(man.compromiso_mensual) : r.compromiso_mensual ? money(r.compromiso_mensual) : "—"}
        </span>
        {acciones.puedeEditar && (
          <button
            type="button"
            onClick={abrir}
            title={man ? "Editar compromiso manual" : "Fijar compromiso a mano"}
            className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-blue-600"
          >
            ✎
          </button>
        )}
      </div>
      {man && (
        <span
          className="mt-0.5 rounded-full border border-violet-200 bg-violet-50 px-1.5 text-[10px] font-semibold text-violet-700"
          title={[
            man.nota,
            r.compromiso_mensual ? `Compromiso de evaluación: ${money(r.compromiso_mensual)}` : "Sin compromiso de evaluación",
            man.editado_por ? `Editado por ${man.editado_por} el ${dateCL(man.editado_en)}` : "",
          ]
            .filter(Boolean)
            .join("\n")}
        >
          Manual
        </span>
      )}
    </div>
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
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-zinc-100">
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
