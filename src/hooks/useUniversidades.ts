import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useUniversidades() {
  const [universidades, setUniversidades] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('universidades')
      .select('*')
      .then(({ data }) => {
        if (data) setUniversidades(data)
        setLoading(false)
      })
  }, [])

  return { universidades, loading }
}