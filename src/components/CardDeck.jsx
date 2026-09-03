import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import NewsCard from './NewsCard.jsx'

/** 카드 사이 간격(px) */
const GAP = 14
/** 다음 카드로 넘기기로 판정하는 세로 이동 거리(카드 높이 대비) */
const V_COMMIT_RATIO = 0.17
/** 빠르게 튕겼을 때 거리와 무관하게 넘기는 속도 임계값(px/ms) */
const V_FLICK = 0.4
/** 카테고리 전환으로 판정하는 가로 이동 거리(px) */
const H_COMMIT_PX = 72
const H_FLICK = 0.38
/** 축을 세로/가로 중 하나로 고정하기 시작하는 이동 거리(px) */
const AXIS_LOCK_PX = 8
/** 앞뒤로 몇 장을 미리 그려둘지 */
const WINDOW = 2

/** 화면 높이에 맞춘 카드 높이. 위아래로 다음 카드가 살짝 걸쳐 보이게 남겨 둔다. */
function cardHeightFor(deckHeight) {
  if (!deckHeight) return 0
  const ideal = Math.round(deckHeight * 0.72)
  return Math.max(240, Math.min(deckHeight - 72, Math.min(ideal, 620)))
}

/** 짧은 진동 — 지원하지 않는 기기에서는 조용히 무시된다 */
function tick(ms = 8) {
  try {
    if (navigator.vibrate) navigator.vibrate(ms)
  } catch {
    /* 무시 */
  }
}

export default function CardDeck({
  cards,
  index,
  accent,
  categoryLabel,
  enterFrom = 0,
  scrubbing = false,
  bookmarkSet,
  seen,
  onIndexChange,
  onCategoryChange,
  onToggleBookmark,
  onSeen,
}) {
  const deckRef = useRef(null)
  const [height, setHeight] = useState(0)
  const [drag, setDrag] = useState({ dx: 0, dy: 0, active: false })
  const [entering, setEntering] = useState(true)

  const pointer = useRef(null)
  const last = Math.max(0, cards.length - 1)

  const cardH = useMemo(() => cardHeightFor(height), [height])
  const step = cardH + GAP
  const topGap = Math.max(0, Math.round((height - cardH) / 2))

  /* 덱의 실제 높이를 재서 픽셀 단위로 정확히 움직인다 */
  useLayoutEffect(() => {
    const el = deckRef.current
    if (!el) return
    const measure = () => setHeight(el.clientHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  /* 카테고리가 바뀌어 새로 마운트되면 방향에 맞춰 밀려 들어온다 */
  useEffect(() => {
    setEntering(true)
    const t = setTimeout(() => setEntering(false), 460)
    return () => clearTimeout(t)
  }, [])

  /* 카드를 잠깐 이상 보고 있으면 '읽음'으로 표시 */
  useEffect(() => {
    const card = cards[index]
    if (!card) return
    const t = setTimeout(() => onSeen(card.id), 700)
    return () => clearTimeout(t)
  }, [cards, index, onSeen])

  const go = useCallback(
    (delta) => {
      const next = Math.min(last, Math.max(0, index + delta))
      if (next !== index) {
        tick(9)
        onIndexChange(next)
      }
    },
    [index, last, onIndexChange]
  )

  const switchCategory = useCallback(
    (dir) => {
      tick(12)
      onCategoryChange(dir)
    },
    [onCategoryChange]
  )

  /* ── 포인터(터치·마우스·펜) 제스처 ─────────────────────── */

  const onPointerDown = useCallback((e) => {
    // 링크나 버튼을 누른 경우엔 제스처로 가로채지 않는다
    if (e.target.closest('a, button')) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    pointer.current = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      t0: performance.now(),
      axis: null,
    }
    setDrag({ dx: 0, dy: 0, active: true })
  }, [])

  const onPointerMove = useCallback(
    (e) => {
      const p = pointer.current
      if (!p || p.id !== e.pointerId) return

      const dx = e.clientX - p.x0
      const dy = e.clientY - p.y0

      if (!p.axis) {
        const adx = Math.abs(dx)
        const ady = Math.abs(dy)
        if (Math.max(adx, ady) < AXIS_LOCK_PX) return
        p.axis = ady >= adx ? 'y' : 'x'
        // 축이 정해진 뒤부터 포인터를 붙잡아 화면 밖으로 나가도 추적한다
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          /* 캡처를 못 해도 동작에는 지장 없다 */
        }
      }

      if (p.axis === 'y') {
        let v = dy
        // 첫 장 위로, 마지막 장 아래로는 고무줄처럼 저항을 준다
        if ((index === 0 && v > 0) || (index === last && v < 0)) v *= 0.3
        setDrag({ dx: 0, dy: v, active: true })
      } else {
        // 가로는 살짝 무겁게 따라오게 해서 실수로 넘어가지 않게 한다
        setDrag({ dx: dx * 0.7, dy: 0, active: true })
      }
    },
    [index, last]
  )

  const endDrag = useCallback(
    (e) => {
      const p = pointer.current
      if (!p || (e && p.id !== e.pointerId)) return
      pointer.current = null

      const dt = Math.max(1, performance.now() - p.t0)
      const dx = e ? e.clientX - p.x0 : 0
      const dy = e ? e.clientY - p.y0 : 0

      setDrag({ dx: 0, dy: 0, active: false })

      if (p.axis === 'y') {
        const speed = Math.abs(dy) / dt
        const threshold = Math.max(42, (cardH || 400) * V_COMMIT_RATIO)
        if (Math.abs(dy) > threshold || speed > V_FLICK) go(dy < 0 ? 1 : -1)
      } else if (p.axis === 'x') {
        const speed = Math.abs(dx) / dt
        if (Math.abs(dx) > H_COMMIT_PX || speed > H_FLICK) switchCategory(dx < 0 ? 1 : -1)
      }
    },
    [go, cardH, switchCategory]
  )

  /* ── 마우스 휠 / 트랙패드 ────────────────────────────────── */

  const wheel = useRef({ acc: 0, lockUntil: 0 })
  const onWheel = useCallback(
    (e) => {
      const now = performance.now()
      const w = wheel.current
      if (now < w.lockUntil) return

      // 가로 스크롤이 뚜렷하면 카테고리 전환으로 받아들인다
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.5 && Math.abs(e.deltaX) > 24) {
        w.lockUntil = now + 520
        w.acc = 0
        switchCategory(e.deltaX > 0 ? 1 : -1)
        return
      }

      w.acc += e.deltaY
      if (Math.abs(w.acc) > 42) {
        w.lockUntil = now + 340
        const dir = w.acc > 0 ? 1 : -1
        w.acc = 0
        go(dir)
      }
    },
    [go, switchCategory]
  )

  /* ── 그리기 ──────────────────────────────────────────────── */

  if (!cards.length) {
    return (
      <main className="deck deck--empty" ref={deckRef}>
        <div className="deck__emptyBox">
          <div className="deck__emptyEmoji">🗂️</div>
          <h2>{categoryLabel}에 카드가 없습니다</h2>
          <p>좌우로 넘기면 다른 카테고리를 볼 수 있어요.</p>
        </div>
      </main>
    )
  }

  const from = Math.max(0, index - WINDOW)
  const to = Math.min(last, index + WINDOW)
  const visible = []
  for (let i = from; i <= to; i++) visible.push(i)

  const translateY = topGap - index * step + drag.dy

  return (
    <main
      className={`deck ${entering ? 'is-entering' : ''} ${
        drag.active || scrubbing ? 'is-dragging' : ''
      }`}
      ref={deckRef}
      style={{ '--enter-from': `${enterFrom * 42}%` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onWheel={onWheel}
      aria-roledescription="카드 덱"
      aria-label={`${categoryLabel} 카드 ${index + 1} / ${cards.length}`}
    >
      <div className="deck__x" style={{ transform: `translate3d(${drag.dx}px, 0, 0)` }}>
        <div
          className="deck__y"
          style={{ transform: `translate3d(0, ${height ? translateY : 0}px, 0)` }}
        >
          {visible.map((i) => {
            const card = cards[i]
            const offset = i - index
            return (
              <div
                className="deck__slot"
                key={card.id}
                style={{ height: cardH || undefined, transform: `translate3d(0, ${i * step}px, 0)` }}
                aria-hidden={offset !== 0}
              >
                <NewsCard
                  card={card}
                  active={offset === 0}
                  offset={offset}
                  accent={accent}
                  bookmarked={bookmarkSet.has(card.id)}
                  seenAlready={seen.has(card.id)}
                  onToggleBookmark={onToggleBookmark}
                />
              </div>
            )
          })}
        </div>
      </div>

      <div className="deck__edge deck__edge--top" aria-hidden="true" />
      <div className="deck__edge deck__edge--bottom" aria-hidden="true" />
    </main>
  )
}
