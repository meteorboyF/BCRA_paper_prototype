import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '../store/authStore'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000, // 30s — never leave a request hanging forever; the caller handles the rejection
})

// ─── Request interceptor: attach JWT ────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ─── Single-flight token refresh ────────────────────────────────────────────
// If several requests fail with 401 at the same time, they must NOT each fire
// their own /auth/refresh. The first 401 starts the refresh; every other waiting
// request awaits the same promise and retries with the new token.
let refreshPromise: Promise<string> | null = null

async function doRefresh(): Promise<string> {
  const refreshToken = useAuthStore.getState().refreshToken
  if (!refreshToken) throw new Error('No refresh token')

  // Use bare axios (not `api`) so this request can never recurse through the
  // 401 interceptor and trigger an infinite refresh loop.
  const { data } = await axios.post('/api/auth/refresh', { refreshToken })
  useAuthStore.getState().setAuth(data.accessToken, data.refreshToken, {
    id: data.userId,
    email: data.email,
    fullName: data.fullName,
    role: data.role,
    firmId: data.firmId,
    mfaEnabled: data.mfaEnabled,
  })
  return data.accessToken
}

function redirectToLogin() {
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.href = '/login'
  }
}

// ─── Response interceptor ───────────────────────────────────────────────────
// Deliberately quiet: the only cross-cutting concern here is transparent token
// refresh. Every page owns its own error UX (most use Promise.allSettled and
// tolerate per-endpoint failures), so this interceptor must NOT pop global
// toasts or force navigation on 403/5xx — doing so spams the user with errors
// the page already handles. It surfaces rejections unchanged for callers.
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined

    // 401 → single-flight refresh, then retry the original request once.
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true
      try {
        if (!refreshPromise) {
          refreshPromise = doRefresh().finally(() => { refreshPromise = null })
        }
        const newToken = await refreshPromise
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      } catch {
        // Refresh token expired/invalid → session is over. Clear and bounce to login.
        useAuthStore.getState().clearAuth()
        redirectToLogin()
        return Promise.reject(error)
      }
    }

    return Promise.reject(error)
  },
)

export default api
