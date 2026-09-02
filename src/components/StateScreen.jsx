export default function StateScreen({ kind, message, onRetry }) {
  if (kind === 'loading') {
    return (
      <div className="state">
        <div className="state__spinner" aria-hidden="true" />
        <p className="state__text">카드를 불러오는 중…</p>
      </div>
    )
  }

  return (
    <div className="state">
      <div className="state__emoji" aria-hidden="true">📭</div>
      <h1 className="state__title">아직 읽을 카드가 없어요</h1>
      <p className="state__text">{message}</p>

      <div className="state__steps">
        <p>터미널에서 아래를 실행하면 오늘의 뉴스와 상식을 받아옵니다.</p>
        <pre><code>npm run fetch</code></pre>
        <p className="state__hint">
          받아온 뒤 이 화면의 <strong>다시 시도</strong>를 누르거나 브라우저를 새로고침하세요.
        </p>
      </div>

      {onRetry && (
        <button type="button" className="state__retry" onClick={onRetry}>
          다시 시도
        </button>
      )}
    </div>
  )
}
