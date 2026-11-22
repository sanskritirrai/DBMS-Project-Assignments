const ENV_URL = import.meta.env.VITE_API_URL

// A localhost URL is only valid during local development. A production build
// always talks to the same origin that served it, so a stale local .env file
// can never point a deployed site at http://localhost.
const LOCAL_HOST = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i

export const API_BASE = import.meta.env.DEV
  ? ENV_URL || 'http://localhost:8000/api'
  : ENV_URL && !LOCAL_HOST.test(ENV_URL)
    ? ENV_URL
    : '/api'

export const DOCS_URL = `${API_BASE.replace(/\/api\/?$/, '')}/docs`

export function getToken() {
  return localStorage.getItem('pharmacy_token')
}

export async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let response
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers })
  } catch {
    throw new Error('Cannot reach the API server. Check that the backend is running.')
  }

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    let errorMsg = 'Something went wrong'
    if (data.detail) {
      if (typeof data.detail === 'string') errorMsg = data.detail
      else if (Array.isArray(data.detail)) errorMsg = data.detail.map(err => err.msg || JSON.stringify(err)).join(', ')
      else if (typeof data.detail === 'object') errorMsg = JSON.stringify(data.detail)
    } else if (data.message) {
      errorMsg = typeof data.message === 'string' ? data.message : JSON.stringify(data.message)
    }
    throw new Error(errorMsg)
  }

  return data
}
