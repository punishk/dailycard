#!/usr/bin/env node
/**
 * 뉴스 RSS + 위키백과 상식을 모아 public/data/news.json 으로 저장합니다.
 *
 *   npm run fetch          수집해서 저장
 *   npm run fetch:check    수집만 해보고 저장은 안 함 (피드 상태 점검용)
 *
 * 외부 패키지 없이 Node 18+ 내장 기능만 사용합니다.
 */

import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

import { CATEGORIES, KNOWLEDGE, OPTIONS } from './feeds.config.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT_FILE = path.join(ROOT, 'public', 'data', 'news.json')

const CHECK_ONLY = process.argv.includes('--check')

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

/* ────────────────────────────────────────────────────────────
 * 문자열 유틸
 * ──────────────────────────────────────────────────────────── */

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’',
  hellip: '…', mdash: '—', ndash: '–', middot: '·',
  laquo: '«', raquo: '»', deg: '°', trade: '™',
  copy: '©', reg: '®', euro: '€', pound: '£', yen: '¥',
}

function decodeEntities(str = '') {
  return str.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (whole, body) => {
    if (body[0] === '#') {
      const code =
        body[1] === 'x' || body[1] === 'X'
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10)
      if (Number.isFinite(code) && code > 0 && code <= 0x10ffff) {
        try {
          return String.fromCodePoint(code)
        } catch {
          return whole
        }
      }
      return whole
    }
    const named = NAMED_ENTITIES[body] ?? NAMED_ENTITIES[body.toLowerCase()]
    return named !== undefined ? named : whole
  })
}

/** CDATA 껍데기를 벗기고 실체만 남긴다 */
function stripCdata(str = '') {
  return str.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
}

/** 줄바꿈처럼 취급해야 하는 블록 태그 */
const BLOCK_TAGS =
  /<\/?(?:p|div|br|li|ul|ol|dl|dt|dd|h[1-6]|tr|td|th|table|tbody|thead|section|article|header|footer|aside|blockquote|figure|figcaption|pre|hr)\b[^>]*>/gi

/**
 * HTML 태그를 제거하고 공백을 정리한 순수 텍스트.
 * 일부 언론사 RSS는 HTML을 한 번 더 이스케이프해서 보내므로(&lt;p&gt;),
 * 태그가 사라질 때까지 최대 3번 "태그 제거 → 엔티티 복원"을 반복한다.
 */
function toPlainText(raw = '') {
  let s = stripCdata(raw)
  for (let pass = 0; pass < 3; pass++) {
    s = s.replace(/<(script|style)[\s\S]*?<\/\1\s*>/gi, ' ')
    s = s.replace(BLOCK_TAGS, ' ')
    s = s.replace(/<[^>]*>/g, '') // b, i, a, span 같은 인라인 태그는 붙여 쓴다
    const decoded = decodeEntities(s)
    if (decoded === s) break
    s = decoded
    if (!/<[a-zA-Z!/]/.test(s)) break // 더 이상 태그가 없으면 그만
  }
  s = s.replace(/<[^>]*>/g, '')
  s = s.replace(/[​-‍﻿­]/g, '')
  s = s.replace(/\s+/g, ' ').trim()
  return s
}

function clamp(text, max) {
  if (!text) return ''
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  // 문장 끝에서 자를 수 있으면 거기서 자른다
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('다. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '))
  if (stop > max * 0.55) return cut.slice(0, stop + 1).trim()
  return cut.replace(/\s+\S*$/, '').trim() + '…'
}

function hashId(...parts) {
  return createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 12)
}

/** 중복 판정을 위한 제목 정규화 */
function normalizeTitle(title = '') {
  return title
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[^가-힣a-z0-9]/g, '')
    .slice(0, 60)
}

/* ────────────────────────────────────────────────────────────
 * 아주 관대한 RSS / Atom 파서
 * ──────────────────────────────────────────────────────────── */

/** <tag ...>내용</tag> 중 첫 번째의 내용을 반환 */
function tagContent(xml, ...names) {
  for (const name of names) {
    const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i')
    const m = xml.match(re)
    if (m && m[1] != null) return m[1]
  }
  return ''
}

/** <tag attr="값" ... /> 형태에서 특정 속성값을 반환 */
function tagAttr(xml, name, attr) {
  const re = new RegExp(`<${name}(?:\\s[^>]*)?\\b${attr}\\s*=\\s*["']([^"']+)["']`, 'i')
  const m = xml.match(re)
  return m ? decodeEntities(m[1]) : ''
}

function extractEntries(xml) {
  const items = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi)
  if (items && items.length) return { entries: items, kind: 'rss' }
  const atom = xml.match(/<entry(?:\s[^>]*)?>[\s\S]*?<\/entry>/gi)
  if (atom && atom.length) return { entries: atom, kind: 'atom' }
  return { entries: [], kind: 'unknown' }
}

function extractLink(chunk, kind) {
  if (kind === 'atom') {
    // rel="alternate" 를 우선
    const alts = chunk.match(/<link\b[^>]*>/gi) || []
    for (const tag of alts) {
      if (/rel\s*=\s*["']alternate["']/i.test(tag) || !/\brel\s*=/i.test(tag)) {
        const href = tag.match(/href\s*=\s*["']([^"']+)["']/i)
        if (href) return decodeEntities(href[1])
      }
    }
  }
  const inner = toPlainText(tagContent(chunk, 'link'))
  if (inner && /^https?:\/\//i.test(inner)) return inner
  const href = tagAttr(chunk, 'link', 'href')
  if (href) return href
  const guid = toPlainText(tagContent(chunk, 'guid'))
  if (guid && /^https?:\/\//i.test(guid)) return guid
  return ''
}

function extractImage(chunk) {
  const candidates = [
    tagAttr(chunk, 'media:content', 'url'),
    tagAttr(chunk, 'media:thumbnail', 'url'),
    tagAttr(chunk, 'enclosure', 'url'),
    tagAttr(chunk, 'image', 'href'),
  ]
  for (const c of candidates) {
    if (c && /^https?:\/\//i.test(c)) return c
  }
  let html = stripCdata(
    tagContent(chunk, 'content:encoded') || tagContent(chunk, 'description') || ''
  )
  // HTML을 한 번 더 이스케이프해 보내는 피드 대응
  if (/&lt;/i.test(html)) html = decodeEntities(html)
  const img = html.match(/<img[^>]*\bsrc\s*=\s*(?:["']([^"']+)["']|([^\s>]+))/i)
  const src = img ? decodeEntities(img[1] || img[2] || '') : ''
  if (/^https?:\/\//i.test(src)) return src
  return null
}

function parseDate(raw) {
  const s = toPlainText(raw)
  if (!s) return null
  const t = Date.parse(s)
  if (Number.isFinite(t)) return new Date(t)
  // "2026-09-01 14:30:00" 처럼 T가 없는 형태 보정
  const alt = Date.parse(s.replace(' ', 'T'))
  return Number.isFinite(alt) ? new Date(alt) : null
}

/** 구글뉴스는 제목 뒤에 " - 출처명" 을 붙이고, 본문 대신 링크 뭉치를 준다 */
function isGoogleNews(url) {
  return /news\.google\.com/i.test(url)
}

function parseFeed(xml, feed) {
  const { entries, kind } = extractEntries(xml)
  const out = []
  for (const chunk of entries) {
    let title = toPlainText(tagContent(chunk, 'title'))
    if (!title) continue

    const link = extractLink(chunk, kind)
    if (!link) continue

    let sourceName = feed.name
    let summary = toPlainText(
      tagContent(chunk, 'description') ||
        tagContent(chunk, 'summary') ||
        tagContent(chunk, 'content:encoded') ||
        tagContent(chunk, 'content')
    )

    if (isGoogleNews(feed.url)) {
      const src = toPlainText(tagContent(chunk, 'source'))
      if (src) sourceName = src
      const m = title.match(/^(.*)\s[-–—]\s([^-–—]{2,25})$/)
      if (m) {
        title = m[1].trim()
        if (!src) sourceName = m[2].trim()
      }
      // 구글뉴스 description 은 링크 목록이라 요약으로 쓸 수 없다
      summary = ''
    }

    // 요약이 제목을 그대로 반복하면 버린다
    if (summary && normalizeTitle(summary).startsWith(normalizeTitle(title)) && summary.length < title.length * 1.4) {
      summary = ''
    }

    const publishedAt =
      parseDate(tagContent(chunk, 'pubDate', 'published', 'updated', 'dc:date', 'date')) || null

    out.push({
      title,
      link,
      summary: clamp(summary, OPTIONS.summaryMaxChars),
      source: sourceName,
      image: extractImage(chunk),
      publishedAt: publishedAt ? publishedAt.toISOString() : null,
    })
  }
  return out
}

/* ────────────────────────────────────────────────────────────
 * 네트워크
 * ──────────────────────────────────────────────────────────── */

async function fetchText(url, timeoutMs = OPTIONS.timeoutMs) {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      redirect: 'follow',
      headers: {
        'user-agent': UA,
        accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
        'accept-language': 'ko-KR,ko;q=0.9,en;q=0.6',
      },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

async function fetchJson(url, timeoutMs = OPTIONS.timeoutMs) {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      redirect: 'follow',
      headers: { 'user-agent': UA, accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

/* ────────────────────────────────────────────────────────────
 * 위키백과 상식 카드
 * ──────────────────────────────────────────────────────────── */

/** 상식 카드로 쓸 만한 문서인지 (토막글·목록·동음이의 제외) */
function isUsefulArticle(title = '', extract = '', type = 'standard') {
  if (type && type !== 'standard') return false
  if (extract.trim().length < 55) return false
  if (/(동음이의|목록|일람|틀:|분류:|위키백과:)/.test(title)) return false
  return true
}

async function collectKnowledge(report) {
  if (!KNOWLEDGE?.enabled) return []
  const lang = KNOWLEDGE.wikiLang || 'ko'
  const api = `https://${lang}.wikipedia.org/api/rest_v1`
  const wikiBase = `https://${lang}.wikipedia.org`
  const cards = []
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const dayLabel = `${Number(mm)}월 ${Number(dd)}일`

  const pushHistory = (year, text, link, image) => {
    cards.push({
      kind: 'knowledge',
      title: year ? `${year}년, 오늘` : '오늘 있었던 일',
      summary: clamp(text, OPTIONS.summaryMaxChars),
      source: '위키백과 · 오늘의 역사',
      link: link || `${wikiBase}/wiki/${encodeURIComponent(dayLabel)}`,
      image: image || null,
      publishedAt: now.toISOString(),
      badge: dayLabel,
    })
  }

  /* ── 1) featured 피드: 알찬 글 · 오늘의 역사 · 많이 읽은 문서 ───── */
  let featured = null
  try {
    featured = await fetchJson(`${api}/feed/featured/${yyyy}/${mm}/${dd}`)
  } catch (err) {
    report.push({ label: '위키백과 · featured 피드', ok: false, count: 0, error: err.message })
  }

  if (featured) {
    let added = 0

    if (KNOWLEDGE.includeFeatured && featured.tfa?.titles?.normalized) {
      const tfa = featured.tfa
      cards.push({
        kind: 'knowledge',
        title: tfa.titles.normalized,
        summary: clamp(tfa.extract || '', OPTIONS.summaryMaxChars),
        source: '위키백과 · 오늘의 알찬 글',
        link: tfa.content_urls?.desktop?.page || `${wikiBase}/wiki/${encodeURIComponent(tfa.titles.canonical)}`,
        image: tfa.thumbnail?.source || tfa.originalimage?.source || null,
        publishedAt: now.toISOString(),
        badge: '오늘의 알찬 글',
      })
      added++
    }

    for (const ev of (Array.isArray(featured.onthisday) ? featured.onthisday : []).slice(
      0,
      KNOWLEDGE.onThisDayCount ?? 6
    )) {
      if (!ev?.text) continue
      const page = ev.pages?.[0]
      pushHistory(ev.year, ev.text, page?.content_urls?.desktop?.page, page?.thumbnail?.source)
      added++
    }

    // 오늘 많이 읽은 문서 — 언어와 무관하게 제공되며 내용이 알찬 편이다
    const mostRead = featured.mostread?.articles ?? []
    let mostReadAdded = 0
    for (const a of mostRead) {
      if (mostReadAdded >= (KNOWLEDGE.mostReadCount ?? 6)) break
      const title = a.titles?.normalized || a.title || ''
      const extract = (a.extract || '').trim()
      if (!isUsefulArticle(title, extract, a.type)) continue
      cards.push({
        kind: 'knowledge',
        title,
        summary: clamp(extract, OPTIONS.summaryMaxChars),
        source: '위키백과 · 오늘 많이 찾아본',
        link: a.content_urls?.desktop?.page || `${wikiBase}/wiki/${encodeURIComponent(title)}`,
        image: a.thumbnail?.source || null,
        publishedAt: now.toISOString(),
        badge: '오늘의 관심사',
      })
      mostReadAdded++
      added++
    }

    report.push({
      label: '위키백과 · featured 피드',
      ok: added > 0,
      count: added,
      error: added > 0 ? null : '이 언어판은 알찬 글/오늘의 역사를 제공하지 않는 듯합니다',
    })
  }

  /* ── 2) 오늘의 역사가 비었으면 'M월 D일' 문서에서 직접 뽑는다 ──── */
  const historyCount = cards.filter((c) => c.source.includes('오늘의 역사')).length
  const wantHistory = KNOWLEDGE.onThisDayCount ?? 6
  if (historyCount === 0 && wantHistory > 0) {
    try {
      const url =
        `${wikiBase}/w/api.php?action=parse&format=json&formatversion=2&prop=text` +
        `&page=${encodeURIComponent(dayLabel)}`
      const res = await fetchJson(url)
      const html = res?.parse?.text
      if (typeof html !== 'string') throw new Error("'M월 D일' 문서를 읽지 못했습니다")

      // '사건' 소제목 다음부터 다음 소제목 전까지의 <li> 항목들
      const idx = html.search(/id\s*=\s*["']사건["']/)
      if (idx < 0) throw new Error("'사건' 항목을 찾지 못했습니다")
      const after = html.slice(idx)
      const end = after.search(/<h2[\s>]/)
      const section = end > 0 ? after.slice(0, end) : after

      const items = [...section.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)]
      let added = 0
      for (const m of items) {
        if (added >= wantHistory) break
        const raw = m[1]
        const text = toPlainText(raw)
        if (text.length < 12) continue
        // "1969년 - 아폴로 11호가 …" 형태에서 연도와 본문을 분리
        const ym = text.match(/^(기원전\s*)?(\d{1,4})년\s*[-–—:]?\s*(.+)$/)
        const year = ym ? `${ym[1] ? '기원전 ' : ''}${ym[2]}` : null
        const body = ym ? ym[3] : text
        if (body.length < 8) continue
        // 항목 안 첫 링크를 원문 링크로 쓴다
        const href = raw.match(/href\s*=\s*["']\/wiki\/([^"'#]+)["']/)
        const link = href ? `${wikiBase}/wiki/${href[1]}` : null
        pushHistory(year, body, link, null)
        added++
      }
      report.push({
        label: `위키백과 · '${dayLabel}' 문서`,
        ok: added > 0,
        count: added,
        error: added > 0 ? null : '사건 목록이 비어 있습니다',
      })
    } catch (err) {
      report.push({ label: `위키백과 · '${dayLabel}' 문서`, ok: false, count: 0, error: err.message })
    }
  }

  /* ── 3) 무작위 문서로 나머지를 채운다 ─────────────────────────── */
  const randomCount = KNOWLEDGE.randomCount ?? 8
  if (randomCount > 0) {
    const seenTitles = new Set(cards.map((c) => c.title))
    let ok = 0
    let tries = 0
    let lastErr = null
    const maxTries = randomCount * 6 // 한국어판은 토막글이 많아 넉넉히 시도한다
    while (ok < randomCount && tries < maxTries) {
      tries++
      try {
        const s = await fetchJson(`${api}/page/random/summary`, 8000)
        const extract = (s.extract || '').trim()
        if (!isUsefulArticle(s.title || '', extract, s.type)) continue
        if (seenTitles.has(s.title)) continue
        seenTitles.add(s.title)
        cards.push({
          kind: 'knowledge',
          title: s.title,
          summary: clamp(extract, OPTIONS.summaryMaxChars),
          source: '위키백과',
          link: s.content_urls?.desktop?.page || `${wikiBase}/wiki/${encodeURIComponent(s.title)}`,
          image: s.thumbnail?.source || null,
          publishedAt: now.toISOString(),
          badge: '알아두면 좋은',
        })
        ok++
      } catch (err) {
        lastErr = err
      }
    }
    report.push({
      label: '위키백과 · 무작위 상식',
      ok: ok > 0,
      count: ok,
      error:
        ok >= randomCount
          ? null
          : ok > 0
            ? `${tries}번 시도해 ${ok}장 (나머지는 토막글이라 제외)`
            : lastErr?.message || '가져온 문서 없음',
    })
  }

  return cards
}

/* ────────────────────────────────────────────────────────────
 * 메인
 * ──────────────────────────────────────────────────────────── */

function isExcluded(title) {
  return OPTIONS.excludeKeywords.some((k) => title.includes(k))
}

async function collectCategory(cat, report) {
  const results = await Promise.all(
    cat.feeds.map(async (feed) => {
      try {
        const xml = await fetchText(feed.url)
        const items = parseFeed(xml, feed)
        const used = items.slice(0, OPTIONS.maxPerFeed)
        report.push({
          label: `${cat.label} · ${feed.name}`,
          ok: used.length > 0,
          count: used.length,
          error: used.length ? null : '기사를 하나도 못 읽음 (주소가 바뀌었을 수 있음)',
        })
        return used
      } catch (err) {
        report.push({ label: `${cat.label} · ${feed.name}`, ok: false, count: 0, error: err.message })
        return []
      }
    })
  )

  const cutoff = OPTIONS.maxAgeHours > 0 ? Date.now() - OPTIONS.maxAgeHours * 3600_000 : null
  const seenTitle = new Set()
  const seenLink = new Set()
  const merged = []

  // 피드별로 한 개씩 번갈아 뽑아, 한 언론사가 화면을 독점하지 않게 한다
  const maxLen = Math.max(0, ...results.map((r) => r.length))
  for (let i = 0; i < maxLen; i++) {
    for (const list of results) {
      const item = list[i]
      if (!item) continue
      if (isExcluded(item.title)) continue
      if (cutoff && item.publishedAt && Date.parse(item.publishedAt) < cutoff) continue

      const tKey = normalizeTitle(item.title)
      if (!tKey || seenTitle.has(tKey)) continue
      if (seenLink.has(item.link)) continue
      seenTitle.add(tKey)
      seenLink.add(item.link)

      merged.push({
        id: hashId(cat.id, item.link, item.title),
        kind: 'news',
        category: cat.id,
        ...item,
      })
      if (merged.length >= OPTIONS.maxPerCategory) return merged
    }
  }
  return merged
}

function printReport(report) {
  const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n)
  const width = Math.min(38, Math.max(20, ...report.map((r) => [...r.label].length)))
  console.log('\n  피드 상태')
  console.log('  ' + '─'.repeat(width + 22))
  for (const r of report) {
    const mark = !r.ok ? '❌' : r.error ? '⚠️ ' : '✅'
    const count = `${String(r.count).padStart(3)}건`
    const note = r.error ? `  ← ${r.error}` : ''
    console.log(`  ${mark} ${pad(r.label, width)} ${count}${note}`)
  }
  console.log('  ' + '─'.repeat(width + 22))
  const bad = report.filter((r) => !r.ok)
  if (bad.length) {
    console.log(
      `\n  ⚠️  ${bad.length}개 피드가 실패했습니다. 나머지로 계속 진행합니다.\n` +
        `     계속 실패하면 scripts/feeds.config.mjs 에서 그 줄을 지우거나 주소를 고치세요.`
    )
  }
}

async function main() {
  const started = Date.now()
  console.log(`\n📥 뉴스와 상식을 모으는 중… (${new Date().toLocaleString('ko-KR')})`)

  const report = []
  const [newsByCat, knowledgeCards] = await Promise.all([
    Promise.all(CATEGORIES.map((cat) => collectCategory(cat, report))),
    collectKnowledge(report),
  ])

  const categories = []
  const cards = []

  CATEGORIES.forEach((cat, i) => {
    const list = newsByCat[i]
    if (!list.length) return
    categories.push({ id: cat.id, label: cat.label, emoji: cat.emoji, accent: cat.accent, count: list.length })
    cards.push(...list)
  })

  if (knowledgeCards.length) {
    const k = KNOWLEDGE
    categories.push({ id: k.id, label: k.label, emoji: k.emoji, accent: k.accent, count: knowledgeCards.length })
    cards.push(
      ...knowledgeCards.map((c) => ({
        id: hashId(k.id, c.link, c.title),
        category: k.id,
        ...c,
      }))
    )
  }

  printReport(report)

  if (!cards.length) {
    console.error(
      '\n❌ 카드를 하나도 만들지 못했습니다. 인터넷 연결 또는 방화벽을 확인해 주세요.\n' +
        '   기존 데이터가 있다면 그대로 두고 종료합니다.\n'
    )
    process.exitCode = 1
    return
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    categories,
    cards,
  }

  console.log(
    `\n  총 ${cards.length}장의 카드 · ${categories.length}개 카테고리 · ${((Date.now() - started) / 1000).toFixed(1)}초`
  )
  console.log('  ' + categories.map((c) => `${c.emoji} ${c.label} ${c.count}`).join('   '))

  if (CHECK_ONLY) {
    console.log('\n  (--check 모드라 저장하지 않았습니다)\n')
    return
  }

  await mkdir(path.dirname(OUT_FILE), { recursive: true })
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf8')
  console.log(`\n✅ 저장 완료 → ${path.relative(ROOT, OUT_FILE)}`)
  console.log('   이제 `npm run dev` 로 앱을 열어 보세요.\n')
}

// 테스트에서 불러다 쓸 수 있도록 내보낸다
export { parseFeed, toPlainText, decodeEntities, clamp, normalizeTitle, extractImage, extractLink, extractEntries }

const isEntry =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))

if (isEntry) {
  main().catch((err) => {
    console.error('\n❌ 예상치 못한 오류:', err)
    process.exitCode = 1
  })
}
