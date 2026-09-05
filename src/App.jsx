import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import TopBar from './components/TopBar.jsx'
import CategoryRail from './components/CategoryRail.jsx'
import CardDeck from './components/CardDeck.jsx'
import HelpOverlay from './components/HelpOverlay.jsx'
import StateScreen from './components/StateScreen.jsx'

import { readJSON, writeJSON, readString, writeString } from './lib/storage.js'

const DATA_URL = `${import.meta.env.BASE_URL}data/news.json`
const SAVED_ID = '__saved__'
const KIDS_ID = 'kids'

/**
 * 키즈 모드 첫 상태를 정한다.
 * 주소 뒤에 ?kids 를 붙이면 켜지고 ?kids=0 이면 꺼집니다. 그 선택은 기억됩니다.
 * 아이 폰에는 ?kids 를 붙인 주소로 홈 화면에 추가해 주면 됩니다.
 */
function initialKidsMode() {
  try {
    const q = new URLSearchParams(window.location.search)
    if (q.has('kids')) {
      const on = q.get('kids') !== '0' && q.get('kids') !== 'false'
      writeString('kidsMode', on ? '1' : '0')
      return on
    }
  } catch {
    /* 주소를 못 읽어도 저장된 값으로 넘어간다 */
  }
  return readString('kidsMode', '0') === '1'
}

export default function App() {
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)

  const [catIndex, setCatIndex] = useState(0)
  const [indexByCat, setIndexByCat] = useState(() => readJSON('position', {}))
  const [bookmarks, setBookmarks] = useState(() => readJSON('bookmarks', []))
  const [seen, setSeen] = useState(() => new Set(readJSON('seen', [])))
  const [theme, setTheme] = useState(() => readString('theme', 'dark'))
  const [showHelp, setShowHelp] = useState(false)
  const [online, setOnline] = useState(() => navigator.onLine !== false)
  const [installPrompt, setInstallPrompt] = useState(null)
  const [catDir, setCatDir] = useState(0)
  const [scrubbing, setScrubbing] = useState(false)
  const [revealed, setRevealed] = useState(() => new Set())
  const [kidsMode, setKidsMode] = useState(initialKidsMode)

  /* ── 데이터 불러오기 ─────────────────────────────────────── */

  const load = useCallback(async (bustCache = false) => {
    setStatus('loading')
    setError(null)
    try {
      const url = bustCache ? `${DATA_URL}?t=${Date.now()}` : DATA_URL
      const res = await fetch(url, { cache: bustCache ? 'reload' : 'default' })
      if (!res.ok) throw new Error(`데이터 파일을 읽지 못했습니다 (HTTP ${res.status})`)
      const json = await res.json()
      if (!json || !Array.isArray(json.cards) || !json.cards.length) {
        throw new Error('카드 데이터가 비어 있습니다')
      }
      setData(json)
      setStatus('ready')
    } catch (err) {
      setError(err.message || String(err))
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  /* ── 저장 ────────────────────────────────────────────────── */

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    writeString('theme', theme)
    // 폰 주소 표시줄 색을 테마에 맞춘다
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0a0c11' : '#f4f6fa')
  }, [theme])

  // 주의: useEffect 본문에서 값을 반환하면 React가 정리 함수로 오해한다. 반드시 중괄호로 감쌀 것.
  useEffect(() => {
    writeJSON('bookmarks', bookmarks)
  }, [bookmarks])

  // 스크러버를 끄는 동안에는 위치가 매 프레임 바뀌므로, 잠잠해진 뒤에 한 번만 저장한다
  useEffect(() => {
    const t = setTimeout(() => writeJSON('position', indexByCat), 250)
    return () => clearTimeout(t)
  }, [indexByCat])

  // 읽음 기록은 최근 1500개만 유지한다
  useEffect(() => {
    writeJSON('seen', [...seen].slice(-1500))
  }, [seen])

  useEffect(() => {
    if (status !== 'ready') return
    if (readString('helpSeen', '') !== '1') {
      setShowHelp(true)
      writeString('helpSeen', '1')
    }
  }, [status])

  /* ── 네트워크 상태와 홈 화면 설치 ────────────────────────── */

  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  useEffect(() => {
    // 안드로이드 크롬 등에서 '홈 화면에 추가'가 가능해지면 버튼을 띄운다
    const onPrompt = (e) => {
      e.preventDefault()
      setInstallPrompt(e)
    }
    const onInstalled = () => setInstallPrompt(null)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = useCallback(async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    try {
      await installPrompt.userChoice
    } catch {
      /* 사용자가 취소한 경우 */
    }
    setInstallPrompt(null)
  }, [installPrompt])

  /* ── 파생 상태 ───────────────────────────────────────────── */

  // 지금 보고 있는 카드. 콜백에서 최신 값을 읽으려고 ref 에 담아 둔다.
  const activeCardRef = useRef(null)

  const bookmarkSet = useMemo(() => new Set(bookmarks), [bookmarks])

  const cardsById = useMemo(() => {
    const map = new Map()
    for (const c of data?.cards ?? []) map.set(c.id, c)
    return map
  }, [data])

  const hasKidsTab = useMemo(
    () => (data?.categories ?? []).some((c) => c.id === KIDS_ID),
    [data]
  )

  const categories = useMemo(() => {
    const base = data?.categories ?? []
    // 키즈 모드에서는 '오늘의 문제' 탭만 남긴다. 뉴스에는 아이에게 맞지 않는 기사가 있을 수 있다.
    if (kidsMode && base.some((c) => c.id === KIDS_ID)) {
      return base.filter((c) => c.id === KIDS_ID)
    }
    if (!bookmarks.length) return base
    return [
      ...base,
      { id: SAVED_ID, label: '저장함', emoji: '🔖', accent: '#f0b84b', count: bookmarks.length },
    ]
  }, [data, bookmarks.length, kidsMode])

  const cardsByCat = useMemo(() => {
    const map = new Map()
    for (const c of data?.cards ?? []) {
      if (!map.has(c.category)) map.set(c.category, [])
      map.get(c.category).push(c)
    }
    // 저장함은 저장한 순서대로 (최근 저장이 위)
    map.set(
      SAVED_ID,
      bookmarks
        .map((id) => cardsById.get(id))
        .filter(Boolean)
        .reverse()
    )
    return map
  }, [data, bookmarks, cardsById])

  const safeCatIndex = Math.min(catIndex, Math.max(0, categories.length - 1))
  const category = categories[safeCatIndex]
  const cards = (category && cardsByCat.get(category.id)) || []

  const cardIndex = Math.min(Math.max(0, indexByCat[category?.id] ?? 0), Math.max(0, cards.length - 1))

  activeCardRef.current = cards[cardIndex] ?? null

  /* ── 조작 ────────────────────────────────────────────────── */

  const setCardIndex = useCallback(
    (next) => {
      if (!category) return
      setIndexByCat((prev) => ({ ...prev, [category.id]: next }))
    },
    [category]
  )

  const changeCategory = useCallback(
    (dir) => {
      setCatIndex((prev) => {
        const n = categories.length
        if (n === 0) return prev
        setCatDir(dir)
        return (prev + dir + n) % n
      })
    },
    [categories.length]
  )

  // 칩을 직접 눌렀을 때도 어느 쪽에서 밀려 들어올지 정해 준다
  const selectCategory = useCallback(
    (next) => {
      setCatIndex((prev) => {
        if (next === prev) return prev
        setCatDir(next > prev ? 1 : -1)
        return next
      })
    },
    []
  )

  const toggleBookmark = useCallback((id) => {
    setBookmarks((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }, [])

  const toggleReveal = useCallback((id) => {
    setRevealed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else {
        next.add(id)
        try {
          if (navigator.vibrate) navigator.vibrate(6)
        } catch {
          /* 진동을 지원하지 않는 기기는 넘어간다 */
        }
      }
      return next
    })
  }, [])

  // 카드를 톡 누르면 퀴즈 카드의 정답이 열린다
  const handleTap = useCallback(() => {
    const card = activeCardRef.current
    if (card?.kind === 'quiz') toggleReveal(card.id)
  }, [toggleReveal])

  const toggleKidsMode = useCallback(() => {
    setKidsMode((on) => {
      const next = !on
      writeString('kidsMode', next ? '1' : '0')
      setCatIndex(0)
      return next
    })
  }, [])

  const markSeen = useCallback((id) => {
    setSeen((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  // 카테고리를 바꿀 때마다 접근성 안내를 위해 제목을 갱신한다
  useEffect(() => {
    document.title = category ? `${category.label} · 데일리 카드` : '데일리 카드'
  }, [category])

  /* ── 키보드 ──────────────────────────────────────────────── */

  const handlers = useRef({})
  handlers.current = {
    setCardIndex,
    changeCategory,
    cardIndex,
    cards,
    category,
    toggleBookmark,
    toggleReveal,
  }

  useEffect(() => {
    function onKey(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      const h = handlers.current
      const last = Math.max(0, h.cards.length - 1)

      switch (e.key) {
        case 'ArrowDown':
        case 'PageDown':
        case ' ':
        case 'j':
          e.preventDefault()
          h.setCardIndex(Math.min(last, h.cardIndex + 1))
          break
        case 'ArrowUp':
        case 'PageUp':
        case 'k':
          e.preventDefault()
          h.setCardIndex(Math.max(0, h.cardIndex - 1))
          break
        case 'ArrowRight':
        case 'l':
          e.preventDefault()
          h.changeCategory(1)
          break
        case 'ArrowLeft':
        case 'h':
          e.preventDefault()
          h.changeCategory(-1)
          break
        case 'Home':
          e.preventDefault()
          h.setCardIndex(0)
          break
        case 'End':
          e.preventDefault()
          h.setCardIndex(last)
          break
        case 's': {
          const card = h.cards[h.cardIndex]
          if (card) h.toggleBookmark(card.id)
          break
        }
        case 'Enter': {
          const card = h.cards[h.cardIndex]
          if (!card) break
          // 퀴즈 카드는 정답 열기, 뉴스 카드는 원문 열기
          if (card.kind === 'quiz') {
            e.preventDefault()
            h.toggleReveal(card.id)
          } else if (card.link) {
            window.open(card.link, '_blank', 'noopener,noreferrer')
          }
          break
        }
        case '?':
          setShowHelp(true)
          break
        case 'Escape':
          setShowHelp(false)
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /* ── 화면 ────────────────────────────────────────────────── */

  if (status === 'loading') {
    return <StateScreen kind="loading" theme={theme} />
  }

  if (status === 'error') {
    return <StateScreen kind="error" theme={theme} message={error} onRetry={() => load(true)} />
  }

  return (
    <div className="app" style={{ '--accent': category?.accent || '#5b8cff' }}>
      <TopBar
        generatedAt={data.generatedAt}
        total={cards.length}
        current={cards.length ? cardIndex + 1 : 0}
        cards={cards}
        theme={theme}
        online={online}
        canInstall={Boolean(installPrompt)}
        onInstall={install}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        onRefresh={() => load(true)}
        onHelp={() => setShowHelp(true)}
        onSeek={setCardIndex}
        onScrubChange={setScrubbing}
        onFirst={() => setCardIndex(0)}
        kidsMode={kidsMode}
      />

      <CategoryRail
        categories={categories}
        activeIndex={safeCatIndex}
        onSelect={selectCategory}
      />

      <CardDeck
        key={category?.id}
        cards={cards}
        index={cardIndex}
        accent={category?.accent}
        categoryLabel={category?.label}
        enterFrom={catDir}
        scrubbing={scrubbing}
        bookmarkSet={bookmarkSet}
        seen={seen}
        revealed={revealed}
        onIndexChange={setCardIndex}
        onCategoryChange={changeCategory}
        onToggleBookmark={toggleBookmark}
        onSeen={markSeen}
        onTap={handleTap}
      />

      {showHelp && (
        <HelpOverlay
          onClose={() => setShowHelp(false)}
          kidsMode={kidsMode}
          hasKidsTab={hasKidsTab}
          onToggleKidsMode={toggleKidsMode}
        />
      )}
    </div>
  )
}
