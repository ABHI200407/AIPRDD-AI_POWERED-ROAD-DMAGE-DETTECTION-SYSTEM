export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'
export const GOV_API = `${API_BASE}/gov`

function getDashboardToken() {
  return import.meta.env.VITE_API_TOKEN || localStorage.getItem('gov_auth_token') || ''
}

export async function apiFetch(path, options = {}) {
  const headers = { ...options.headers }
  const token = getDashboardToken()

  if (token) headers.Authorization = `Bearer ${token}`

  return fetch(`${GOV_API}${path}`, { ...options, headers })
}

export async function apiFetchBase(path, options = {}) {
  const headers = { ...options.headers }
  const token = getDashboardToken()

  if (token) headers.Authorization = `Bearer ${token}`

  return fetch(`${API_BASE}${path}`, { ...options, headers })
}

export function getWebSocketUrl(path = '/ws') {
  const apiRoot = new URL(API_BASE)
  const wsProtocol = apiRoot.protocol === 'https:' ? 'wss:' : 'ws:'
  const wsUrl = new URL(path, `${wsProtocol}//${apiRoot.host}`)
  const token = getDashboardToken()

  if (token) wsUrl.searchParams.set('token', token)

  return wsUrl.toString()
}
