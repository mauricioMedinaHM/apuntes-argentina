import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useUniversidades() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('universidades')
      .select('*')
      .order('nombre')
      .then(({ data }) => {
        if (data) setData(data)
        setLoading(false)
      })
  }, [])

  return { universidades: data, loading }
}

export function useMaterias(universidadId: string | null) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!universidadId) return
    supabase
      .from('materias')
      .select('*')
      .eq('universidad_id', universidadId)
      .order('nombre')
      .then(({ data }) => {
        if (data) setData(data)
        setLoading(false)
      })
  }, [universidadId])

  return { materias: data, loading }
}

export function useApuntes(materiaId: string | null) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!materiaId) return
    supabase
      .from('apuntes')
      .select('*')
      .eq('materia_id', materiaId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setData(data)
        setLoading(false)
      })
  }, [materiaId])

  return { apuntes: data, loading }
}