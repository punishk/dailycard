import { useState } from 'react'
import { timeAgo } from '../lib/time.js'

export default function NewsCard({
  card,
  active,
  offset,
  accent,
  bookmarked,
  seenAlready,
  revealed = false,
  onToggleBookmark,
  onReveal,
}) {
  const [imageFailed, setImageFailed] = useState(false)
  const [copied, setCopied] = useState(false)

  const hasImage = Boolean(card.image) && !imageFailed
  const isQuiz = card.kind === 'quiz'
  // 뉴스 / 상식 / 따뜻한 이야기 / 오늘의 문제에 따라 카드 바탕색이 조금씩 다르다
  const variant = ['knowledge', 'warm', 'quiz'].includes(card.kind) ? card.kind : 'news'

  async function share() {
    const text = isQuiz
      ? `${card.title}\n정답: ${card.answer}`
      : `${card.title}\n${card.link}`
    try {
      if (navigator.share) {
        await navigator.share(isQuiz ? { text } : { title: card.title, url: card.link })
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
        `card--${variant}`,
        hasImage ? 'has-image' : 'no-image',
        seenAlready && !active ? 'is-seen' : '',
        isQuiz && revealed ? 'is-revealed' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ '--accent': accent, '--depth': Math.min(Math.abs(offset), 2) }}
    >
      {hasImage && (
        <div className="card__media">
          {/* 뒤에 같은 사진을 흐리게 깔아 여백을 메우고, 앞의 사진은 잘리지 않게 통째로 보여준다 */}
          <img className="card__mediaBlur" src={card.image} alt="" aria-hidden="true" decoding="async" referrerPolicy="no-referrer" />
          <img
            className="card__mediaImg"
            src={card.image}
            alt=""
            loading={Math.abs(offset) <= 1 ? 'eager' : 'lazy'}
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
          />
        </div>
      )}

      <div className="card__body">
        <header className="card__meta">
          <span className="card__badge">{card.badge || card.source}</span>
          {isQuiz && card.source && <span className="card__time">{card.source}</span>}
          {!isQuiz && !card.badge && card.publishedAt && (
            <span className="card__time">{timeAgo(card.publishedAt)}</span>
          )}
          {!isQuiz && card.badge && card.source && <span className="card__time">{card.source}</span>}
          {seenAlready && !active && (
            <span className="card__seen" title="이미 본 카드">
              읽음
            </span>
          )}
        </header>

        <h2 className="card__title">{card.title}</h2>

        {isQuiz ? (
          <div className="card__text">
            {revealed ? (
              <div className="quiz__answerBox">
                <div className="quiz__answerLabel">정답</div>
                <p className="quiz__answer">{card.answer}</p>
                {card.explain && <p className="quiz__explain">{card.explain}</p>}
              </div>
            ) : (
              <p className="quiz__prompt">
                <span className="quiz__promptEmoji" aria-hidden="true">
                  🤔
                </span>
                먼저 생각해 보고, 카드를 톡 눌러 정답을 확인하세요.
              </p>
            )}
            <span className="card__textFade" aria-hidden="true" />
          </div>
        ) : (
          <div className="card__text">
            {card.summary ? (
              <p className="card__summary">{card.summary}</p>
            ) : (
              <p className="card__summary card__summary--muted">
                요약이 제공되지 않는 기사예요. 아래에서 원문을 열어 보세요.
              </p>
            )}
            <span className="card__textFade" aria-hidden="true" />
          </div>
        )}
      </div>

      <footer className="card__actions">
        {isQuiz ? (
          <button
            type="button"
            className={`card__open card__reveal ${revealed ? 'is-on' : ''}`}
            onClick={onReveal}
            tabIndex={active ? 0 : -1}
            aria-expanded={revealed}
          >
            {revealed ? '문제 다시 보기' : '정답 보기'}
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
              {revealed ? (
                <path
                  d="M6 15l6-6 6 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : (
                <path
                  d="M6 9l6 6 6-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>
          </button>
        ) : card.link ? (
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
        ) : (
          <span />
        )}

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
            aria-label={isQuiz ? '문제 복사' : '링크 복사'}
            title={isQuiz ? '문제 복사' : '링크 복사'}
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
    </article>
  )
}
