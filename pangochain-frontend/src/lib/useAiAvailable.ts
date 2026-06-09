import { useQuery } from '@tanstack/react-query'
import api from './api'

export function useAiAvailable() {
  const { data } = useQuery({
    queryKey: ['ai-health'],
    queryFn: () => api.get('/ai/health').then((r) => r.data),
    retry: false,
    staleTime: 60_000,
  })
  return data?.available === true
}
