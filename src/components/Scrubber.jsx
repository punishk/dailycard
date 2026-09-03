import { useCallback, useRef, useState } from 'react'

/**
 * 상단 진행 막대. 보기만 하는 게 아니라 손가락으로 붙잡고 끌면
 * 카드가 따라 움직입니다. 끄는 동안 몇 번째인지와 제목을 말풍선으로 보여줍니다.
 */
export default function Scrubber({ total, index, cards = [], onSeek, onScrubChange }) {
  const trackRef = useRef(null)
  const pointerId = useRef(null)
  const lastIndex = useRef(index)
  const [scrubbing, setScrubbing] = useState(false)

  const usable = total > 1
  const ratio = total > 1 ? index / (total - 1) : total === 1 ? 1 : 0
  const pct = `${(ratio * 100).toFixed(2)}%`

  const indexFromEvent = useCallback(
    (clientX) => {
      const el = trackRef.current
      if (!el || total < 1) return 0
      const r = el.getBoundingClientRect()
      if (r.width <= 0) return 0
      const t = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
      return Math.round(t * (total - 1))
    },
    [total]
  )

  const apply = useCallback(
    (clientX) => {
      const next = indexFromEvent(clientX)
      if (next !== lastIndex.current) {
        lastIndex.current = next
        try {
          if (navigator.vibrate) navigator.vibrate(4)
        } catch {
          /* 진동을 지원하지 않는 기기는 그냥 넘어간다 */
        }
        onSeek(next)
      }
    },
    [indexFromEvent, onSeek]
  )

  const start = useCallback(
    (e) => {
      if (!usable) return
      if (e.pointerType === 'mouse' && e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      pointerId.current = e.pointerId
      lastIndex.current = index
      setScrubbing(true)
      onScrubChange?.(true)
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        /* 캡처를 못 해도 동작에는 지장 없다 */
      }
      apply(e.clientX)
    },
    [usable, index, apply, onScrubChange]
  )

  const move = useCallback(
    (e) => {
      if (pointerId.current !== e.pointerId) return
      e.preventDefault()
      apply(e.clientX)
    },
    [apply]
  )

  const end = useCallback(
    (e) => {
      if (pointerId.current !== e.pointerId) return
      pointerId.current = null
      setScrubbing(false)
      onScrubChange?.(false)
    },
    [onScrubChange]
  )

  const previewTitle = cards[index]?.title ?? ''
  // 말풍선이 화면 밖으로 나가지 않도록 양 끝에서 잡아 준다
  const bubbleLeft = `${Math.min(88, Math.max(12, ratio * 100)).toFixed(2)}%`

  return (
    <div className={`scrub ${scrubbing ? 'is-scrubbing' : ''}`}>
      <div
        className="scrub__hit"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        role="slider"
        tabIndex={-1}
        aria-label="카드 위치"
        aria-valuemin={1}
        aria-valuemax={Math.max(1, total)}
        aria-valuenow={index + 1}
        aria-valuetext={`${index + 1}번째 카드, 전체 ${total}장`}
      >
        <div className="scrub__track" ref={trackRef}>
          <div className="scrub__fill" style={{ width: pct }} />
          {usable && <span className="scrub__knob" style={{ left: pct }} />}
        </div>
      </div>

      {scrubbing && previewTitle && (
        <div className="scrub__bubble" style={{ left: bubbleLeft }}>
          <span className="scrub__bubbleNum">
            {index + 1} / {total}
          </span>
          <span className="scrub__bubbleTitle">{previewTitle}</span>
        </div>
      )}
    </div>
  )
}
