import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import TopBar from './components/TopBar.jsx'
import CategoryRail from './components/CategoryRail.jsx'
import CardDeck from './components/CardDeck.jsx'
import HelpOverlay from './components/HelpOverlay.jsx'
import StateScreen from './components/StateScreen.jsx'

import { readJSON, writeJSON, readString, writeString } from './lib/storage.js'

const DATA_URL = `${import.meta.env.BASE_URL}data/news.json`
const SAVED_ID = '__saved__'

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

  const bookmarkSet = useMemo(() => new Set(bookmarks), [bookmarks])

  const cardsById = useMemo(() => {
    const map = new Map()
    for (const c of data?.cards ?? []) map.set(c.id, c)
    return map
  }, [data])

  const categories = useMemo(() => {
    const base = data?.categories ?? []
    if (!bookmarks.length) return base
    return [
      ...base,
      { id: SAVED_ID, label: '저장함', emoji: '🔖', accent: '#f0b84b', count: bookmarks.length },
    ]
  }, [data, bookmarks.length])

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
  handlers.current = { setCardIndex, changeCategory, cardIndex, cards, category, toggleBookmark }

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
          if (card?.link) window.open(card.link, '_blank', 'noopener,noreferrer')
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
        onIndexChange={setCardIndex}
        onCategoryChange={changeCategory}
        onToggleBookmark={toggleBookmark}
        onSeen={markSeen}
      />

      {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}
    </div>
  )
}
