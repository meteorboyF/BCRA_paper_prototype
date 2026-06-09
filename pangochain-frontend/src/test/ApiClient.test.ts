import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Toast is fired from the interceptor — mock it so we can assert on messages.
vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}))

import axios, { AxiosError, type AxiosAdapter } from 'axios'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'

const REFRESH_PAYLOAD = {
  accessToken: 'new-access',
  refreshToken: 'new-refresh',
  userId: 'u1',
  email: 'u@firm.com',
  fullName: 'U Ser',
  role: 'CLIENT_PRIMARY',
  firmId: null,
  mfaEnabled: false,
}

/** Resolve helper that produces an axios-shaped 2xx response. */
function res(config: any, status: number, data: unknown = { ok: true }) {
  return { data, status, statusText: '', headers: {}, config }
}

/**
 * Reject helper. A custom axios adapter is itself responsible for rejecting
 * non-2xx statuses (the built-in adapters do this via `settle`), so error-path
 * tests must reject with a proper AxiosError carrying the response.
 */
function err(config: any, status: number, data: unknown = { error: 'x' }) {
  const response = { data, status, statusText: '', headers: {}, config }
  return Promise.reject(
    new AxiosError('Request failed with status code ' + status, String(status), config, null, response as any),
  )
}

describe('api client', () => {
  let originalAdapter: AxiosAdapter | undefined

  beforeEach(() => {
    vi.clearAllMocks()
    originalAdapter = api.defaults.adapter as AxiosAdapter
    useAuthStore.setState({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      user: null,
      isAuthenticated: true,
    })
    // Replace window.location so href assignment in redirects is a harmless no-op.
    Object.defineProperty(window, 'location', {
      value: { pathname: '/', href: '' },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    api.defaults.adapter = originalAdapter
  })

  it('attaches the Authorization header automatically', async () => {
    const adapter = vi.fn(async (config: any) => res(config, 200))
    api.defaults.adapter = adapter as unknown as AxiosAdapter

    await api.get('/cases')

    const sentConfig: any = adapter.mock.calls[0][0]
    expect(String(sentConfig.headers.Authorization)).toBe('Bearer access-1')
  })

  it('does exactly ONE refresh for two concurrent 401s, then retries both', async () => {
    const postSpy = vi.spyOn(axios, 'post').mockResolvedValue({ data: REFRESH_PAYLOAD } as any)

    // 401 on the first attempt; 200 once the interceptor has flagged the retry.
    const adapter = vi.fn(async (config: any) => {
      if (config._retry) return res(config, 200)
      return err(config, 401, { error: 'unauthorized' })
    })
    api.defaults.adapter = adapter as unknown as AxiosAdapter

    const [a, b] = await Promise.all([api.get('/a'), api.get('/b')])

    expect(a.status).toBe(200)
    expect(b.status).toBe(200)
    expect(postSpy).toHaveBeenCalledTimes(1) // single-flight
    expect(useAuthStore.getState().accessToken).toBe('new-access')

    postSpy.mockRestore()
  })

  it('clears the auth store when the refresh itself fails after a 401', async () => {
    const postSpy = vi.spyOn(axios, 'post').mockRejectedValue(new Error('refresh expired'))
    const adapter = vi.fn(async (config: any) => err(config, 401, { error: 'unauthorized' }))
    api.defaults.adapter = adapter as unknown as AxiosAdapter

    await expect(api.get('/protected')).rejects.toBeTruthy()

    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)

    postSpy.mockRestore()
  })

  // The interceptor is intentionally quiet: pages own their error UX (most use
  // Promise.allSettled and tolerate per-endpoint failures), so the interceptor must
  // never pop a global toast or force navigation on network/403/5xx errors.
  it('rejects quietly on a network error (no global toast)', async () => {
    const adapter = vi.fn(async () => {
      throw Object.assign(new Error('Network Error'), { code: undefined })
    })
    api.defaults.adapter = adapter as unknown as AxiosAdapter

    await expect(api.get('/down')).rejects.toBeTruthy()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('rejects 403 without clobbering the auth session or toasting', async () => {
    const adapter = vi.fn(async (config: any) => err(config, 403, { error: 'FORBIDDEN' }))
    api.defaults.adapter = adapter as unknown as AxiosAdapter

    await expect(api.get('/forbidden')).rejects.toBeTruthy()
    expect(toast.error).not.toHaveBeenCalled()
    expect(useAuthStore.getState().accessToken).toBe('access-1') // session untouched
  })

  it('rejects 503 unchanged for the caller to handle (no global toast)', async () => {
    const adapter = vi.fn(async (config: any) => err(config, 503, { error: 'FABRIC_UNAVAILABLE' }))
    api.defaults.adapter = adapter as unknown as AxiosAdapter

    await expect(api.get('/fabric')).rejects.toMatchObject({ response: { status: 503 } })
    expect(toast.error).not.toHaveBeenCalled()
  })
})
