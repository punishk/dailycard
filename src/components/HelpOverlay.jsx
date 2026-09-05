export default function HelpOverlay({ onClose, kidsMode = false, hasKidsTab = false, onToggleKidsMode }) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="사용법" onClick={onClose}>
      <div className="overlay__panel" onClick={(e) => e.stopPropagation()}>
        <h2 className="overlay__title">넘기는 방법</h2>

        <ul className="overlay__list">
          <li>
            <span className="overlay__gesture" aria-hidden="true">↕</span>
            <div>
              <strong>위·아래로 스와이프</strong>
              <p>이전 / 다음 카드. 마우스 휠, <kbd>↑</kbd> <kbd>↓</kbd>, <kbd>Space</kbd> 도 같습니다.</p>
            </div>
          </li>
          <li>
            <span className="overlay__gesture" aria-hidden="true">↔</span>
            <div>
              <strong>좌·우로 스와이프</strong>
              <p>카테고리 전환. <kbd>←</kbd> <kbd>→</kbd> 또는 위쪽 칩을 눌러도 됩니다.</p>
            </div>
          </li>
          <li>
            <span className="overlay__gesture" aria-hidden="true">⇥</span>
            <div>
              <strong>맨 위 막대를 끌면 건너뛰기</strong>
              <p>
                제목을 미리 보면서 원하는 카드로 단번에 갑니다. 막대를 톡 눌러도 그 지점으로
                이동하고, 왼쪽 <kbd>⤒</kbd> 버튼은 첫 카드로 돌아갑니다.
              </p>
            </div>
          </li>
          <li>
            <span className="overlay__gesture" aria-hidden="true">🤔</span>
            <div>
              <strong>퀴즈는 카드를 톡</strong>
              <p>
                '오늘의 문제' 탭에서는 카드를 누르면 정답과 설명이 열립니다. <kbd>Enter</kbd> 로도
                열려요. 먼저 생각해 보고 누르는 게 좋아요.
              </p>
            </div>
          </li>
          <li>
            <span className="overlay__gesture" aria-hidden="true">🔖</span>
            <div>
              <strong>저장</strong>
              <p><kbd>S</kbd> 를 누르면 저장함에 담깁니다. 저장한 카드는 브라우저에 남습니다.</p>
            </div>
          </li>
          <li>
            <span className="overlay__gesture" aria-hidden="true">↗</span>
            <div>
              <strong>원문 열기</strong>
              <p><kbd>Enter</kbd> 를 누르면 새 탭에서 원문이 열립니다.</p>
            </div>
          </li>
        </ul>

        {hasKidsTab && (
          <div className="overlay__kids">
            <div className="overlay__kidsText">
              <strong>키즈 모드</strong>
              <p>
                켜면 <b>'오늘의 문제' 탭만</b> 남고 뉴스 탭이 숨겨집니다. 아이 폰에는 주소 뒤에{' '}
                <code>?kids</code> 를 붙여 홈 화면에 추가해 주세요.
              </p>
            </div>
            <button
              type="button"
              className={`overlay__switch ${kidsMode ? 'is-on' : ''}`}
              onClick={onToggleKidsMode}
              role="switch"
              aria-checked={kidsMode}
              aria-label="키즈 모드"
            >
              <span className="overlay__switchDot" />
            </button>
          </div>
        )}

        <p className="overlay__note">
          <strong>폰에서 앱처럼 쓰기</strong>
          <br />
          <b>아이폰</b> — 사파리 아래쪽 공유 버튼 → “홈 화면에 추가”
          <br />
          <b>안드로이드</b> — 크롬 메뉴(⋮) → “홈 화면에 추가”
          <br />
          홈 화면에서 열면 주소창 없이 전체화면으로 뜨고, 한 번 본 카드는 네트워크가 끊겨도 다시
          열립니다.
        </p>

        <button type="button" className="overlay__close" onClick={onClose} autoFocus>
          시작하기
        </button>
      </div>
    </div>
  )
}
