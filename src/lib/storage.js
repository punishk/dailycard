/**
 * 브라우저 localStorage 를 감싼 얇은 유틸.
 * 사생활 보호 모드나 저장소 차단 환경에서도 앱이 죽지 않도록 전부 try/catch 로 감쌌다.
 */

const PREFIX = 'dailycard:'

export function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw == null) return fallback
    const parsed = JSON.parse(raw)
    return parsed ?? fallback
  } catch {
    return fallback
  }
}

export function writeJSON(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function readString(key, fallback) {
  try {
    return localStorage.getItem(PREFIX + key) ?? fallback
  } catch {
    return fallback
  }
}

export function writeString(key, value) {
  try {
    localStorage.setItem(PREFIX + key, value)
    return true
  } catch {
    return false
  }
}
