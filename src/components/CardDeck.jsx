import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import NewsCard from './NewsCard.jsx'

/** 다음 카드로 넘기기로 판정하는 세로 이동 거리(카드 높이 대비) */
const V_COMMIT_RATIO = 0.16
/** 빠르게 튕겼을 때 거리와 무관하게 넘기는 속도 임계값(px/ms) */
const V_FLICK = 0.45
/** 카테고리 전환으로 판정하는 가로 이동 거리(px) */
const H_COMMIT_PX = 78
const H_FLICK = 0.42
/** 축을 세로/가로 중 하나로 고정하기 시작하는 이동 거리(px) */
const AXIS_LOCK_PX = 10
/** 앞뒤로 몇 장을 미리 그려둘지 */
const WINDOW = 2

export default function CardDeck({
  cards,
  index,
  accent,
  categoryLabel,
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
  const [enter, setEnter] = useState('')

  const pointer = useRef(null)
  const last = Math.max(0, cards.length - 1)

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

  /* 카테고리가 바뀌어 새로 마운트되면 살짝 슬라이드해 들어온다 */
  useEffect(() => {
    setEnter('is-entering')
    const t = setTimeout(() => setEnter(''), 300)
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
      if (next !== index) onIndexChange(next)
    },
    [index, last, onIndexChange]
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
      moved: false,
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
        p.moved = true
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
        if ((index === 0 && v > 0) || (index === last && v < 0)) v *= 0.32
        setDrag({ dx: 0, dy: v, active: true })
      } else {
        setDrag({ dx: dx * 0.85, dy: 0, active: true })
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
        const threshold = Math.max(48, (height || 600) * V_COMMIT_RATIO)
        if (Math.abs(dy) > threshold || speed > V_FLICK) {
          go(dy < 0 ? 1 : -1)
        }
      } else if (p.axis === 'x') {
        const speed = Math.abs(dx) / dt
        if (Math.abs(dx) > H_COMMIT_PX || speed > H_FLICK) {
          onCategoryChange(dx < 0 ? 1 : -1)
        }
      }
    },
    [go, height, onCategoryChange]
  )

  /* ── 마우스 휠 / 트랙패드 ────────────────────────────────── */

  const wheel = useRef({ acc: 0, lockUntil: 0 })
  const onWheel = useCallback(
    (e) => {
      const now = performance.now()
      const w = wheel.current
      if (now < w.lockUntil) return

      // 내용이 긴 카드 안에서는 카드 스크롤이 먼저다. 끝에 닿으면 그때 다음 카드로.
      const body = e.target.closest?.('.card__body.is-scrollable')
      if (body) {
        const atTop = body.scrollTop <= 0
        const atBottom = body.scrollHeight - body.clientHeight - body.scrollTop <= 1
        if ((e.deltaY < 0 && !atTop) || (e.deltaY > 0 && !atBottom)) return
      }

      // 가로 스크롤이 뚜렷하면 카테고리 전환으로 받아들인다
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.5 && Math.abs(e.deltaX) > 24) {
        w.lockUntil = now + 420
        w.acc = 0
        onCategoryChange(e.deltaX > 0 ? 1 : -1)
        return
      }

      w.acc += e.deltaY
      if (Math.abs(w.acc) > 42) {
        w.lockUntil = now + 260
        const dir = w.acc > 0 ? 1 : -1
        w.acc = 0
        go(dir)
      }
    },
    [go, onCategoryChange]
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

  const translateY = -index * height + drag.dy

  return (
    <main
      className={`deck ${enter} ${drag.active ? 'is-dragging' : ''}`}
      ref={deckRef}
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
                style={{ transform: `translate3d(0, ${i * height}px, 0)` }}
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

      {index < last && !drag.active && (
        <button
          type="button"
          className="deck__next"
          onClick={() => go(1)}
          aria-label="다음 카드"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              d="M6 9l6 6 6-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
    </main>
  )
}
