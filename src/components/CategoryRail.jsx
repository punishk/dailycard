import { useEffect, useRef } from 'react'

export default function CategoryRail({ categories, activeIndex, onSelect }) {
  const railRef = useRef(null)
  const activeRef = useRef(null)

  // 선택된 칩이 항상 보이도록 가로 스크롤을 맞춘다
  useEffect(() => {
    const chip = activeRef.current
    const rail = railRef.current
    if (!chip || !rail) return
    const left = chip.offsetLeft - rail.clientWidth / 2 + chip.clientWidth / 2
    rail.scrollTo({ left: Math.max(0, left), behavior: 'smooth' })
  }, [activeIndex])

  return (
    <nav className="rail" ref={railRef} aria-label="카테고리">
      {categories.map((cat, i) => {
        const active = i === activeIndex
        return (
          <button
            key={cat.id}
            ref={active ? activeRef : null}
            type="button"
            className={`rail__chip ${active ? 'is-active' : ''}`}
            style={{ '--chip-accent': cat.accent || '#5b8cff' }}
            onClick={() => onSelect(i)}
            aria-current={active ? 'true' : undefined}
          >
            <span className="rail__emoji" aria-hidden="true">
              {cat.emoji}
            </span>
            {cat.label}
            <span className="rail__count">{cat.count}</span>
          </button>
        )
      })}
    </nav>
  )
}
