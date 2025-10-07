"use client";
import { useState } from "react";

export default function ReclamosPage() {
  const [form, setForm] = useState({
    ejecutivo: "",
    cliente: "",
    correo: "",
    rut: "",
    documento: "",
    producto: "",
    lote: "",
    dosis: "",
    superficie: "",
    tiempoAccion: "",
    aplicacion: "",
    accionMecanica: "",
    herramienta: "",
    residuo: "",
    temperatura: "",
    descripcion: "",
  });
  const [enviando, setEnviando] = useState(false);
  const [ok, setOk] = useState(false);

  const handleChange = (e: any) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  async function handleSubmit(e: any) {
    e.preventDefault();
    setEnviando(true);
    setOk(false);
    try {
      const res = await fetch("/api/save-reclamo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setOk(true);
        setForm({
          ejecutivo: "",
          cliente: "",
          correo: "",
          rut: "",
          documento: "",
          producto: "",
          lote: "",
          dosis: "",
          superficie: "",
          tiempoAccion: "",
          aplicacion: "",
          accionMecanica: "",
          herramienta: "",
          residuo: "",
          temperatura: "",
          descripcion: "",
        });
      } else alert("❌ Error al guardar el reclamo");
    } catch {
      alert("❌ Error de red al enviar el formulario");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-4xl p-8 bg-white shadow-sm rounded-2xl mt-8">
        <h1 className="text-2xl font-bold text-[#2B6CFF] mb-4">🧾 Formulario de Reclamos</h1>
        <p className="text-sm text-zinc-600 mb-6">
          Complete todos los campos marcados con * para registrar correctamente su reclamo.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            ["ejecutivo", "Ejecutivo de ventas *"],
            ["cliente", "Cliente *"],
            ["correo", "Correo de contacto *"],
            ["rut", "RUT empresa *"],
            ["documento", "Factura o guía *"],
            ["producto", "Producto *"],
            ["lote", "Lote *"],
            ["dosis", "Dosis de uso"],
            ["superficie", "Superficie donde se aplica"],
            ["tiempoAccion", "Tiempo de acción"],
          ].map(([name, label]) => (
            <label key={name} className="block">
              <span className="text-sm font-medium">{label}</span>
              <input
                required={label.includes("*")}
                type="text"
                name={name}
                value={(form as any)[name]}
                onChange={handleChange}
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
              />
            </label>
          ))}

          {/* Selects */}
          <div className="grid grid-cols-2 gap-4">
            <label>
              <span className="text-sm font-medium">Aplicación</span>
              <select name="aplicacion" value={form.aplicacion} onChange={handleChange} className="mt-1 w-full rounded border px-3 py-2 text-sm">
                <option value="">Seleccione...</option>
                <option>Manual</option>
                <option>Dilutor</option>
              </select>
            </label>

            <label>
              <span className="text-sm font-medium">¿Acción mecánica?</span>
              <select name="accionMecanica" value={form.accionMecanica} onChange={handleChange} className="mt-1 w-full rounded border px-3 py-2 text-sm">
                <option value="">Seleccione...</option>
                <option>Sí</option>
                <option>No</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label>
              <span className="text-sm font-medium">Herramienta usada para la aplicación</span>
              <input type="text" name="herramienta" value={form.herramienta} onChange={handleChange} className="mt-1 w-full rounded border px-3 py-2 text-sm" />
            </label>

            <label>
              <span className="text-sm font-medium">Residuo a eliminar</span>
              <input type="text" name="residuo" value={form.residuo} onChange={handleChange} className="mt-1 w-full rounded border px-3 py-2 text-sm" />
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium">Temperatura de solución</span>
            <select name="temperatura" value={form.temperatura} onChange={handleChange} className="mt-1 w-full rounded border px-3 py-2 text-sm">
              <option value="">Seleccione...</option>
              <option>Fría</option>
              <option>Caliente</option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium">Descripción del problema *</span>
            <textarea
              required
              name="descripcion"
              value={form.descripcion}
              onChange={handleChange}
              rows={5}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            />
          </label>

          <button
            disabled={enviando}
            className="rounded bg-[#2B6CFF] px-4 py-2 text-white font-semibold hover:bg-[#1F4ED8] disabled:bg-zinc-400"
          >
            {enviando ? "Enviando..." : "Enviar Reclamo"}
          </button>

          {ok && <p className="text-green-600 text-sm mt-2">✅ Reclamo guardado correctamente.</p>}
        </form>
      </div>
    </div>
  );
}
