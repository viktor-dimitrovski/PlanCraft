import { useCallback, useState } from 'react'

export default function useAsync(fn, deps = []) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const run = useCallback(async (...args) => {
    setLoading(true); setError(null)
    try { return await fn(...args) }
    catch (e) { setError(e); throw e }
    finally { setLoading(false) }
  }, deps) // eslint-disable-line
  return [run, loading, error]
}
