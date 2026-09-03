import { todayLabel, updatedLabel } from '../lib/time.js'
import Scrubber from './Scrubber.jsx'

export default function TopBar({
  generatedAt,
  total,
  current,
  cards,
  theme,
  online = true,
  canInstall = false,
  onInstall,
  onToggleTheme,
  onRefresh,
  onHelp,
  onSeek,
  onScrubChange,
  onFirst,
}) {
  const updated = updatedLabel(generatedAt)
  const atFirst = current <= 1

  return (
    <header className="topbar">
      <div className="topbar__row">
        <div className="topbar__left">
          <span className="topbar__date">{todayLabel()}</span>
          {updated && <span className="topbar__updated">{updated} 기준</span>}
          {!online && (
            <span className="topbar__offline" title="네트워크에 연결되어 있지 않습니다">
              오프라인
            </span>
          )}
        </div>

        <div className="topbar__right">
          {canInstall && (
            <button type="button" className="topbar__install" onClick={onInstall}>
              홈 화면에 추가
            </button>
          )}

          {!atFirst && (
            <button
              type="button"
              className="iconBtn"
              onClick={onFirst}
              title="첫 카드로 (Home)"
              aria-label="첫 카드로"
            >
              <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
                <path
                  d="M5 4.5h14M12 20V9M12 9l-4.5 4.5M12 9l4.5 4.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  transform="rotate(180 12 12)"
                />
              </svg>
            </button>
          )}

          <span className="topbar__count">
            {current}
            <span className="topbar__countSlash">/</span>
            {total}
          </span>

          <button
            type="button"
            className="iconBtn"
            onClick={onRefresh}
            title="데이터 다시 읽기"
            aria-label="데이터 다시 읽기"
          >
            <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
              <path
                d="M20 11a8 8 0 10-2.3 5.7M20 6v5h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <button
            type="button"
            className="iconBtn"
            onClick={onToggleTheme}
            title={theme === 'dark' ? '밝은 화면으로' : '어두운 화면으로'}
            aria-label={theme === 'dark' ? '밝은 화면으로' : '어두운 화면으로'}
          >
            {theme === 'dark' ? (
              <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
                <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="2" />
                <path
                  d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
                <path
                  d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>

          <button type="button" className="iconBtn" onClick={onHelp} title="사용법 (?)" aria-label="사용법">
            <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
              <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
              <path
                d="M9.6 9.3a2.5 2.5 0 114 2.2c-.9.6-1.6 1-1.6 2"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx="12" cy="16.8" r="1.1" fill="currentColor" />
            </svg>
          </button>
        </div>
      </div>

      <Scrubber
        total={total}
        index={Math.max(0, current - 1)}
        cards={cards}
        onSeek={onSeek}
        onScrubChange={onScrubChange}
      />
    </header>
  )
}
