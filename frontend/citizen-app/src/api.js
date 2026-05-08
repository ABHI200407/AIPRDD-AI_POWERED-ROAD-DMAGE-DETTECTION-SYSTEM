import { auth } from './firebase'

export const API_BASE = import.meta.env.VITE_API_URL || 'http://192.168.80.72:8000/api/v1'

export async function getAuthHeaders(headers = {}) {
  const nextHeaders = { ...headers }
  if (auth.currentUser) {
    const token = await auth.currentUser.getIdToken()
    nextHeaders.Authorization = `Bearer ${token}`
  }
  return nextHeaders
}

export async function fetchWithAuth(url, options = {}) {
  const headers = await getAuthHeaders(options.headers)
  return fetch(url, { ...options, headers })
}

export async function getWebSocketUrl(path = '/ws') {
  const apiRoot = new URL(API_BASE)
  const wsProtocol = apiRoot.protocol === 'https:' ? 'wss:' : 'ws:'
  const wsUrl = new URL(path, `${wsProtocol}//${apiRoot.host}`)

  if (auth.currentUser) {
    const token = await auth.currentUser.getIdToken()
    wsUrl.searchParams.set('token', token)
  }

  return wsUrl.toString()
}
