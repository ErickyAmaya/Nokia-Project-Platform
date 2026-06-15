import { useEffect, useState } from 'react'
import { useParams }          from 'react-router-dom'
import { createClient }       from '@supabase/supabase-js'

// Cliente directo — la ruta es pública y no pasa por initSupabaseClient()
const db = createClient(
  import.meta.env.VITE_INGETEL_URL,
  import.meta.env.VITE_INGETEL_KEY
)

export default function ScytelReporteViewer() {
  const { id }               = useParams()
  const [html, setHtml]      = useState(null)
  const [err,  setErr]       = useState(null)

  useEffect(() => {
    db.from('scytel_reports').select('html_content').eq('id', id).single()
      .then(({ data, error }) => {
        if (error || !data) setErr('Reporte no encontrado o enlace inválido.')
        else setHtml(data.html_content)
      })
  }, [id])

  if (err) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
      height:'100vh', fontFamily:'sans-serif', color:'#6b7280', fontSize:14 }}>
      {err}
    </div>
  )
  if (!html) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
      height:'100vh', fontFamily:'sans-serif', color:'#6b7280', fontSize:14 }}>
      Cargando reporte…
    </div>
  )

  return (
    <iframe
      srcDoc={html}
      style={{ width:'100%', height:'100vh', border:'none', display:'block' }}
      title="Reporte Facturación SCYTEL"
    />
  )
}
