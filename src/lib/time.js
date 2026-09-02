/** "3분 전", "2시간 전" 처럼 사람이 읽기 쉬운 상대 시각 */
export function timeAgo(iso, now = Date.now()) {
  if (!iso) return ''
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const diff = Math.max(0, now - t)
  const min = Math.floor(diff / 60000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}일 전`
  return new Date(t).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
}

/** "9월 1일 화요일" */
export function todayLabel(d = new Date()) {
  return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })
}

/** "오후 3:04 기준" */
export function updatedLabel(iso) {
  if (!iso) return ''
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  return new Date(t).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })
}
