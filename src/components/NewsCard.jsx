import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { timeAgo } from '../lib/time.js'

export default function NewsCard({
  card,
  active,
  offset,
  accent,
  bookmarked,
  seenAlready,
  onToggleBookmark,
}) {
  const [imageFailed, setImageFailed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [scrollable, setScrollable] = useState(false)
  const bodyRef = useRef(null)

  const hasImage = Boolean(card.image) && !imageFailed
  const isKnowledge = card.kind === 'knowledge'

  // 내용이 카드 높이를 넘칠 때만 카드 안 스크롤을 허용한다
  useLayoutEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const check = () => setScrollable(el.scrollHeight - el.clientHeight > 4)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [card.id, hasImage])

  // 카드가 바뀌면 스크롤 위치를 맨 위로 되돌린다
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0
  }, [card.id])

  async function share() {
    const text = `${card.title}\n${card.link}`
    try {
      if (navigator.share) {
        await navigator.share({ title: card.title, url: card.link })
        return
      }
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* 사용자가 취소했거나 권한이 없는 경우 — 조용히 넘어간다 */
    }
  }

  return (
    <article
      className={[
        'card',
        active ? 'is-active' : 'is-idle',
        isKnowledge ? 'card--knowledge' : 'card--news',
        hasImage ? 'has-image' : 'no-image',
        seenAlready && !active ? 'is-seen' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ '--accent': accent, '--depth': Math.min(Math.abs(offset), 2) }}
    >
      {hasImage && (
        <div className="card__media">
          <img
            src={card.image}
            alt=""
            loading={Math.abs(offset) <= 1 ? 'eager' : 'lazy'}
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
          />
          <div className="card__mediaFade" />
        </div>
      )}

      <div className={`card__body ${scrollable ? 'is-scrollable' : ''}`} ref={bodyRef}>
        <header className="card__meta">
          <span className="card__badge">{card.badge || card.source}</span>
          {!card.badge && card.publishedAt && (
            <span className="card__time">{timeAgo(card.publishedAt)}</span>
          )}
          {card.badge && card.source && <span className="card__time">{card.source}</span>}
          {seenAlready && !active && (
            <span className="card__seen" title="이미 본 카드">
              읽음
            </span>
          )}
        </header>

        <h2 className="card__title">{card.title}</h2>

        {card.summary ? (
          <p className="card__summary">{card.summary}</p>
        ) : (
          <p className="card__summary card__summary--muted">
            요약이 제공되지 않는 기사예요. 아래에서 원문을 열어 보세요.
          </p>
        )}

        <footer className="card__actions">
          <a
            className="card__open"
            href={card.link}
            target="_blank"
            rel="noopener noreferrer"
            tabIndex={active ? 0 : -1}
          >
            원문 보기
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
              <path
                d="M7 17L17 7M17 7H9M17 7v8"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>

          <div className="card__iconRow">
            <button
              type="button"
              className={`iconBtn ${bookmarked ? 'is-on' : ''}`}
              onClick={() => onToggleBookmark(card.id)}
              aria-pressed={bookmarked}
              aria-label={bookmarked ? '저장 해제' : '저장하기'}
              title={bookmarked ? '저장 해제 (S)' : '저장하기 (S)'}
              tabIndex={active ? 0 : -1}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path
                  d="M6 4.5h12v15l-6-4-6 4z"
                  fill={bookmarked ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <button
              type="button"
              className="iconBtn"
              onClick={share}
              aria-label="링크 복사"
              title="링크 복사"
              tabIndex={active ? 0 : -1}
            >
              {copied ? (
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path
                    d="M5 13l4 4 10-10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path
                    d="M10 13.5a3.5 3.5 0 005 0l3-3a3.54 3.54 0 00-5-5l-1 1M14 10.5a3.5 3.5 0 00-5 0l-3 3a3.54 3.54 0 005 5l1-1"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          </div>
        </footer>
      </div>
    </article>
  )
}
