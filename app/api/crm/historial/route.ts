import { NextResponse } from 'next/server'

const APPS_SCRIPT_URL =
  process.env.CRM_HISTORIAL_APPS_SCRIPT_URL as string

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const folio = searchParams.get('folio')

    if (!folio) {
      return NextResponse.json(
        { ok: false, error: 'Folio es obligatorio' },
        { status: 400 }
      )
    }

    const payload = {
      action: 'GET_HISTORIAL',
      data: { folio },
    }

    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(text)
    }

    const data = await response.json()
    return NextResponse.json({ ok: true, data })
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Error interno' },
      { status: 500 }
    )
  }
}
