/**
 * 문제 은행 검사 — 인터넷 없이 동작합니다.
 *   npm test
 *
 * 아이가 보는 내용이라 정답이 비거나 중복된 문항, 틀린 계산이 섞이면 안 됩니다.
 * 이 파일이 그것을 막아 줍니다.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  loadBanks,
  validateBanks,
  pickDaily,
  seededShuffle,
  dayIndexKST,
  todayKST,
  DAILY_MIX,
} from './kids.mjs'

const banks = await loadBanks()

test('문제 은행이 모두 읽힌다', () => {
  for (const type of Object.keys(DAILY_MIX)) {
    assert.ok(banks[type], `${type} 은행이 없습니다`)
    assert.ok(banks[type].items.length > 0, `${type} 은행이 비어 있습니다`)
  }
  const total = Object.values(banks).reduce((s, b) => s + b.items.length, 0)
  console.log(
    `    문항 수: ` +
      Object.entries(banks)
        .map(([t, b]) => `${b.label} ${b.items.length}`)
        .join(' · ') +
      ` = 모두 ${total}문항`
  )
})

test('모든 문항이 형식·중복·길이 검사를 통과한다', () => {
  const problems = validateBanks(banks)
  assert.deepEqual(problems, [], `\n  - ${problems.join('\n  - ')}`)
})

test('수학 문항의 계산이 실제로 맞다', () => {
  const checked = banks.school.items.filter((i) => i.check)
  assert.ok(checked.length >= 10, `계산 검사가 붙은 문항이 ${checked.length}개뿐입니다`)
  // validateBanks 가 이미 계산을 확인하지만, 여기서 한 번 더 눈에 보이게 확인한다
  for (const item of checked) {
    const got = Function(`"use strict"; return (${item.check.expr})`)()
    assert.equal(got, item.check.value, `${item.id}: ${item.check.expr}`)
  }
})

test('하루에 정확히 50문항을 고른다', () => {
  const cards = pickDaily(banks, new Date('2026-09-05T03:00:00Z'))
  const want = Object.values(DAILY_MIX).reduce((a, b) => a + b, 0)
  assert.equal(cards.length, want)
  assert.equal(want, 50)
})

test('같은 날이면 늘 같은 문제가 나온다', () => {
  // 같은 날 안의 다른 시각 (한국시간 9/5 낮 12시와 밤 11시)
  const a = pickDaily(banks, new Date('2026-09-05T03:00:00Z'))
  const b = pickDaily(banks, new Date('2026-09-05T14:00:00Z'))
  assert.deepEqual(
    a.map((c) => c.id),
    b.map((c) => c.id),
    '폰과 PC에서 같은 문제가 나와야 합니다'
  )
})

test('날이 바뀌면 문제도 바뀐다', () => {
  const a = pickDaily(banks, new Date('2026-09-05T03:00:00Z'))
  const b = pickDaily(banks, new Date('2026-09-06T03:00:00Z'))
  const sameIds = a.filter((c) => b.some((d) => d.id === c.id)).length
  assert.equal(sameIds, 0, `어제와 겹치는 문제가 ${sameIds}개 있습니다`)
})

test('하루 안에 같은 문제가 두 번 나오지 않는다', () => {
  for (let d = 0; d < 30; d++) {
    const day = new Date(Date.UTC(2026, 8, 5 + d, 3, 0, 0))
    const cards = pickDaily(banks, day)
    const ids = new Set(cards.map((c) => c.id))
    assert.equal(ids.size, cards.length, `${d + 1}일째에 같은 문제가 두 번 나왔습니다`)
  }
})

test('은행을 한 바퀴 돌기 전에는 문제가 되풀이되지 않는다', () => {
  // 가장 빨리 도는 종류를 기준으로 몇 밤을 버티는지 확인한다
  const cycles = Object.entries(DAILY_MIX).map(([type, take]) => ({
    type,
    days: Math.floor(banks[type].items.length / take),
  }))
  const shortest = Math.min(...cycles.map((c) => c.days))
  console.log(
    `    되풀이까지: ` + cycles.map((c) => `${banks[c.type].label} ${c.days}일`).join(' · ')
  )
  assert.ok(shortest >= 5, `가장 짧은 주기가 ${shortest}일뿐입니다`)

  // 주기 안에서는 실제로 겹치지 않아야 한다
  const seen = new Set()
  for (let d = 0; d < shortest; d++) {
    const day = new Date(Date.UTC(2026, 8, 5 + d, 3, 0, 0))
    for (const c of pickDaily(banks, day)) {
      if (c.quizType !== 'quiz') continue // 가장 큰 은행 하나로 확인
      assert.ok(!seen.has(c.id), `${d + 1}일째에 ${c.id} 가 다시 나왔습니다`)
      seen.add(c.id)
    }
  }
})

test('종류가 한쪽에 몰리지 않고 섞여 나온다', () => {
  const cards = pickDaily(banks, new Date('2026-09-05T03:00:00Z'))
  // 앞의 10문항 안에 두 종류 이상이 있어야 한다
  const firstTen = new Set(cards.slice(0, 10).map((c) => c.quizType))
  assert.ok(firstTen.size >= 2, `앞 10문항이 ${[...firstTen]} 한 종류로만 채워졌습니다`)

  const counts = {}
  for (const c of cards) counts[c.quizType] = (counts[c.quizType] ?? 0) + 1
  for (const [type, take] of Object.entries(DAILY_MIX)) {
    assert.equal(counts[type], take, `${type} 문항 수가 ${counts[type]} 입니다`)
  }
})

test('카드에 앱이 필요로 하는 값이 모두 들어 있다', () => {
  const cards = pickDaily(banks, new Date('2026-09-05T03:00:00Z'))
  for (const c of cards) {
    assert.equal(c.kind, 'quiz')
    assert.equal(c.category, 'kids')
    assert.ok(c.title && c.answer && c.explain, `${c.id} 에 빠진 값이 있습니다`)
    assert.equal(c.summary, '', '정답이 미리 보이면 안 됩니다')
    assert.equal(c.link, null, '퀴즈 카드에는 원문 링크가 없어야 합니다')
    assert.ok(c.badge, `${c.id} 에 과목 표시가 없습니다`)
  }
})

test('날짜 계산이 한국 시간을 따른다', () => {
  // 한국시간 9/6 00:30 = UTC 9/5 15:30 → 9월 6일이어야 한다
  assert.equal(todayKST(new Date('2026-09-05T15:30:00Z')), '2026-09-06')
  // 한국시간 9/5 23:30 = UTC 9/5 14:30 → 아직 9월 5일
  assert.equal(todayKST(new Date('2026-09-05T14:30:00Z')), '2026-09-05')
  assert.equal(
    dayIndexKST(new Date('2026-09-05T15:30:00Z')) - dayIndexKST(new Date('2026-09-05T14:30:00Z')),
    1
  )
})

test('씨앗이 같으면 같은 순서로 섞인다', () => {
  const list = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  assert.deepEqual(seededShuffle(list, 42), seededShuffle(list, 42))
  assert.notDeepEqual(seededShuffle(list, 42), seededShuffle(list, 43))
  assert.deepEqual([...seededShuffle(list, 42)].sort((a, b) => a - b), list, '원소가 사라지면 안 된다')
})
