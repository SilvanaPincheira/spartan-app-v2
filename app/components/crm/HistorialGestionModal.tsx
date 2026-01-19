'use client'

import { useEffect, useState } from 'react'

type HistorialItem = {
  id: string
  fecha: string
  usuario_email: string
  rol: string
  accion: string
  mensaje?: string
  campo?: string
  valor_anterior?: string
  valor_nuevo?: string
}

interface Props {
  open: boolean
  onClose: () => void
  folio: string
  rolUsuario: 'ejecutivo' | 'jefatura'
  usuarioEmail: string
}

const accionLabel: Record<string, string> = {
  MENSAJE_JEFATURA: 'Mensaje de jefatura',
  CAMBIO_ESTADO: 'Cambio de estado',
  CAMBIO_ETAPA: 'Cambio de etapa',
  UPDATE_DATOS: 'Actualización de datos',
  OBSERVACION: 'Observación',
  AUTO_ESTADO: 'Cambio automático de estado',
  AUTO_ETAPA: 'Cambio automático de etapa',
}

export default function HistorialGestionModal({
  open,
  onClose,
  folio,
  rolUsuario,
  usuarioEmail,
}: Props) {
  const [historial, setHistorial] = useState<HistorialItem[]>([])
  const [mensaje, setMensaje] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Cargar historial
  useEffect(() => {
    if (!open) return

    setLoading(true)
    fetch(`/api/crm/historial?folio=${folio}`)
      .then(r => r.json())
      .then(res => setHistorial(res.ok ? res.data : []))
      .finally(() => setLoading(false))
  }, [open, folio])

  // Guardar mensaje de jefatura
  async function guardarMensaje() {
    if (!mensaje.trim() || saving) return

    setSaving(true)
    await fetch('/api/crm/historial/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        folio,
        accion: 'MENSAJE_JEFATURA',
        mensaje,
        usuario_email: usuarioEmail,
        rol: 'jefatura',
      }),
    })

    setMensaje('')
    const res = await fetch(`/api/crm/historial?folio=${folio}`).then(r => r.json())
    setHistorial(res.ok ? res.data : [])
    setSaving(false)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-3xl max-h-[80vh] rounded-lg shadow-lg overflow-y-auto p-6"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">
            Historial de gestión – {folio}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-black text-lg"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Contenido */}
        {loading ? (
          <p className="text-sm text-gray-500">Cargando historial…</p>
        ) : historial.length === 0 ? (
          <p className="text-sm text-gray-500">Sin registros</p>
        ) : (
          <div className="space-y-3">
            {historial.map(item => (
              <div
                key={item.id}
                className={`border rounded p-3 ${
                  item.accion === 'MENSAJE_JEFATURA'
                    ? 'bg-yellow-50 border-yellow-300'
                    : 'bg-gray-50'
                }`}
              >
                <div className="text-xs text-gray-500 flex justify-between">
                  <span>{new Date(item.fecha).toLocaleString()}</span>
                  <span>
                    {item.rol} · {item.usuario_email}
                  </span>
                </div>

                <div className="text-sm font-medium mt-1">
                  {accionLabel[item.accion] ?? item.accion}
                </div>

                {item.mensaje && (
                  <div className="text-sm mt-1 whitespace-pre-wrap">
                    {item.mensaje}
                  </div>
                )}

                {item.campo && (
                  <div className="text-xs text-gray-500 mt-1">
                    {item.campo}: {item.valor_anterior} → {item.valor_nuevo}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Mensaje de jefatura */}
        {rolUsuario === 'jefatura' && (
          <div className="mt-6 border-t pt-4">
            <p className="text-sm font-medium mb-2">Mensaje de jefatura</p>
            <textarea
              className="w-full border rounded p-2 text-sm"
              rows={3}
              value={mensaje}
              onChange={e => setMensaje(e.target.value)}
              placeholder="Ej: Aplicar 10% de descuento para cerrar negocio"
            />
            <button
              onClick={guardarMensaje}
              disabled={saving || !mensaje.trim()}
              className={`mt-2 px-4 py-2 rounded text-sm text-white ${
                saving || !mensaje.trim()
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-black hover:bg-gray-800'
              }`}
            >
              {saving ? 'Guardando…' : 'Guardar mensaje'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
