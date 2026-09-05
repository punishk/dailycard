/**
 * '오늘의 문제' 탭 — 초등 4~6학년용 문제 은행에서 매일 50문항을 골라 냅니다.
 *
 * 뉴스와 달리 인터넷에서 받아오지 않습니다. data/kids/*.json 에 들어 있는
 * 문제를 날짜에 따라 고르기 때문에 인터넷이 없어도 늘 같은 결과가 나옵니다.
 * 폰에서 보든 PC에서 보든 같은 날이면 같은 50문항이 나옵니다.
 */

import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BANK_DIR = path.resolve(__dirname, '..', 'data', 'kids')

/** 하루에 종류별로 몇 문항씩 뽑을지. 합이 하루 문항 수가 됩니다. */
export const DAILY_MIX = {
  quiz: 15, // 상식 퀴즈
  story: 8, // 재밌는 이야기
  school: 12, // 학교 문제
  english: 15, // 영어 단어
}

export const KIDS_CATEGORY = {
  id: 'kids',
  label: '오늘의 문제',
  emoji: '🎒',
  accent: '#f0a132',
}

/* ────────────────────────────────────────────────────────────
 * 날마다 같은 결과를 주는 뒤섞기
 * ──────────────────────────────────────────────────────────── */

/** 문자열을 32비트 정수 씨앗으로 */
function seedFrom(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** 씨앗이 같으면 늘 같은 수열을 내는 난수 (mulberry32) */
function rng(seed) {
  let a = seed >>> 0
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 씨앗이 같으면 늘 같은 순서로 섞는다 */
export function seededShuffle(list, seed) {
  const out = [...list]
  const next = rng(seed)
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** 1970-01-01 부터 며칠째인지 (한국 시간 기준) */
export function dayIndexKST(now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return Math.floor(kst.getTime() / 86400000)
}

/** 한국 시간 기준 오늘 날짜 문자열 */
export function todayKST(now = new Date()) {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/* ────────────────────────────────────────────────────────────
 * 문제 은행 읽기와 검사
 * ──────────────────────────────────────────────────────────── */

export async function loadBanks(dir = BANK_DIR) {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort()
  const banks = {}
  for (const file of files) {
    const raw = await readFile(path.join(dir, file), 'utf8')
    const bank = JSON.parse(raw)
    if (!bank.type || !Array.isArray(bank.items)) {
      throw new Error(`${file}: type 과 items 가 있어야 합니다`)
    }
    banks[bank.type] = bank
  }
  return banks
}

/**
 * 문제 은행을 전수 검사한다. 문제가 있으면 사람이 읽을 수 있는 목록으로 돌려준다.
 * 아이가 보는 내용이라 정답이 비어 있거나 중복된 문항이 섞이면 안 된다.
 */
export function validateBanks(banks) {
  const problems = []
  const seenIds = new Set()
  const seenQuestions = new Map()

  for (const [type, bank] of Object.entries(banks)) {
    if (!bank.label) problems.push(`${type}: label 이 없습니다`)

    bank.items.forEach((item, i) => {
      const where = `${type}[${i}] ${item.id ?? '(id 없음)'}`

      if (!item.id) problems.push(`${where}: id 가 없습니다`)
      else if (seenIds.has(item.id)) problems.push(`${where}: id 가 겹칩니다`)
      else seenIds.add(item.id)

      for (const field of ['question', 'answer', 'explain', 'subject']) {
        const v = item[field]
        if (typeof v !== 'string' || !v.trim()) {
          problems.push(`${where}: ${field} 가 비어 있습니다`)
        }
      }

      if (typeof item.question === 'string') {
        const key = item.question.replace(/\s+/g, '')
        if (seenQuestions.has(key)) {
          problems.push(`${where}: "${item.question.slice(0, 24)}…" 문항이 ${seenQuestions.get(key)} 와 겹칩니다`)
        } else {
          seenQuestions.set(key, item.id)
        }
        if (item.question.length > 120) problems.push(`${where}: 문제가 너무 깁니다 (${item.question.length}자)`)
      }

      if (typeof item.answer === 'string' && item.answer.length > 80) {
        problems.push(`${where}: 정답이 너무 깁니다 (${item.answer.length}자)`)
      }
      if (typeof item.explain === 'string' && item.explain.length > 200) {
        problems.push(`${where}: 설명이 너무 깁니다 (${item.explain.length}자)`)
      }

      // 수학 문항은 계산을 실제로 확인한다
      if (item.check) {
        const { expr, value } = item.check
        if (typeof expr !== 'string' || typeof value !== 'number') {
          problems.push(`${where}: check 는 { expr, value } 여야 합니다`)
        } else if (!/^[\d+\-*/().\s]+$/.test(expr)) {
          problems.push(`${where}: check.expr 에 숫자와 사칙연산만 쓸 수 있습니다`)
        } else {
          // 숫자와 연산자만 통과시켰으므로 안전하게 계산할 수 있다
          const got = Function(`"use strict"; return (${expr})`)()
          if (Math.abs(got - value) > 1e-9) {
            problems.push(`${where}: 계산이 맞지 않습니다 — ${expr} = ${got} 인데 ${value} 로 적혀 있습니다`)
          }
          if (!String(item.answer).includes(String(value))) {
            problems.push(`${where}: 정답 "${item.answer}" 에 계산 결과 ${value} 가 없습니다`)
          }
        }
      }
    })
  }

  // 하루치를 채울 만큼 문항이 있는지
  for (const [type, take] of Object.entries(DAILY_MIX)) {
    const n = banks[type]?.items?.length ?? 0
    if (n < take) problems.push(`${type}: 하루에 ${take}문항이 필요한데 ${n}문항뿐입니다`)
  }

  return problems
}

/* ────────────────────────────────────────────────────────────
 * 오늘의 50문항 고르기
 * ──────────────────────────────────────────────────────────── */

/**
 * 종류마다 고정된 순서로 섞어 두고, 날짜에 따라 그 순서에서 다음 구간을 잘라 씁니다.
 * 이렇게 하면 은행을 한 바퀴 다 돌기 전까지 같은 문제가 다시 나오지 않습니다.
 */
export function pickDaily(banks, now = new Date(), mix = DAILY_MIX) {
  const day = dayIndexKST(now)
  const picked = []

  for (const [type, take] of Object.entries(mix)) {
    const bank = banks[type]
    if (!bank || !bank.items.length || take <= 0) continue

    // 종류마다 고정된 순서 (날짜와 무관하게 늘 같음)
    const ordered = seededShuffle(bank.items, seedFrom(`dailycard:${type}`))
    const n = ordered.length
    const start = ((day * take) % n + n) % n

    for (let i = 0; i < Math.min(take, n); i++) {
      const item = ordered[(start + i) % n]
      picked.push({
        id: `kids-${item.id}`,
        kind: 'quiz',
        category: KIDS_CATEGORY.id,
        quizType: type,
        title: item.question,
        summary: '',
        answer: item.answer,
        explain: item.explain,
        badge: item.subject,
        source: bank.label ?? type,
        link: null,
        image: null,
        publishedAt: null,
      })
    }
  }

  // 종류가 뭉치지 않도록 그날의 씨앗으로 한 번 더 섞는다
  return seededShuffle(picked, seedFrom(`dailycard:mix:${todayKST(now)}`))
}

/** 오늘의 문제 카드와 카테고리 정보를 함께 돌려준다 */
export async function buildKidsCards(now = new Date(), dir = BANK_DIR) {
  const banks = await loadBanks(dir)
  const problems = validateBanks(banks)
  if (problems.length) {
    const err = new Error(`문제 은행에 이상이 있습니다:\n  - ${problems.join('\n  - ')}`)
    err.problems = problems
    throw err
  }
  const cards = pickDaily(banks, now)
  const total = Object.values(banks).reduce((s, b) => s + b.items.length, 0)
  return { cards, banks, total }
}
