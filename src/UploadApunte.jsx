import { useState } from 'react'
import { supabase } from './lib/supabase'

export default function UploadApunte() {
  const [file, setFile] = useState(null)
  const [titulo, setTitulo] = useState('')
  const [materiaId, setMateriaId] = useState('')
  const [loading, setLoading] = useState(false)
  const [ok, setOk] = useState(false)

 const handleSubmit = async () => {
  if (!file || !titulo || !materiaId) {
    console.log('Faltan campos:', { file, titulo, materiaId })
    return
  }
  setLoading(true)

  const filename = `${Date.now()}_${file.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '')}`
  
  const { error: uploadError } = await supabase.storage
    .from('apuntes')
    .upload(filename, file)

  console.log('Upload error:', uploadError)
  if (uploadError) { setLoading(false); return }

  const { data: urlData } = supabase.storage
    .from('apuntes')
    .getPublicUrl(filename)

  console.log('URL:', urlData.publicUrl)

  const { error: insertError } = await supabase.from('apuntes').insert({
    titulo,
    materia_id: materiaId,
    archivo_url: urlData.publicUrl,
  })

  console.log('Insert error:', insertError)

  if (!insertError) {
    setOk(true)
    setFile(null)
    setTitulo('')
  }
  
  setLoading(false)
}

  return (
    <div style={{ padding: 24, maxWidth: 480 }}>
      <h2>Subir apunte</h2>

      <input
        placeholder="Título del apunte"
        value={titulo}
        onChange={e => setTitulo(e.target.value)}
        style={{ display: 'block', width: '100%', marginBottom: 12 }}
      />

      <input
        placeholder="ID de la materia"
        value={materiaId}
        onChange={e => setMateriaId(e.target.value)}
        style={{ display: 'block', width: '100%', marginBottom: 12 }}
      />

      <input
        type="file"
        accept=".pdf,.doc,.docx,.png,.jpg"
        onChange={e => setFile(e.target.files[0])}
        style={{ display: 'block', marginBottom: 12 }}
      />

      <button onClick={handleSubmit} disabled={loading}>
        {loading ? 'Subiendo...' : 'Subir'}
      </button>

      {ok && <p style={{ color: 'green' }}>¡Apunte subido con éxito!</p>}
    </div>
  )
}