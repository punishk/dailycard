/**
 * 한국어 위키백과에서 '상식' 카드를 어디서 가져올 수 있는지 확인하는 진단 스크립트.
 *   node scripts/probe-wiki.mjs
 * 결과를 그대로 복사해서 알려주시면 됩니다.
 */

const LANG = 'ko'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

const now = new Date()
const MM = String(now.getMonth() + 1).padStart(2, '0')
const DD = String(now.getDate()).padStart(2, '0')
const YYYY = now.getFullYear()

async function get(url, timeout = 15000) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), timeout)
  try {
    const r = await fetch(url, {
      signal: ctl.signal,
      headers: { 'user-agent': UA, accept: 'application/json' },
    })
    const text = await r.text()
    let json = null
    try {
      json = JSON.parse(text)
    } catch {
      /* JSON이 아닐 수 있다 */
    }
    return { status: r.status, json, text }
  } catch (e) {
    return { status: 0, error: e.message }
  } finally {
    clearTimeout(t)
  }
}

const line = (s = '') => console.log(s)
const hr = () => line('─'.repeat(62))

line(`\n한국어 위키백과 진단  (${YYYY}-${MM}-${DD})`)
hr()

/* 1) featured 피드 — 어떤 키가 실제로 오는가 */
{
  const url = `https://${LANG}.wikipedia.org/api/rest_v1/feed/featured/${YYYY}/${MM}/${DD}`
  const r = await get(url)
  line(`[1] feed/featured           HTTP ${r.status}${r.error ? ' ' + r.error : ''}`)
  if (r.json) {
    const keys = Object.keys(r.json)
    line(`    키: ${keys.join(', ') || '(없음)'}`)
    line(`    tfa       : ${r.json.tfa ? '있음 — ' + (r.json.tfa.titles?.normalized ?? '?') : '없음'}`)
    line(`    onthisday : ${Array.isArray(r.json.onthisday) ? r.json.onthisday.length + '건' : '없음'}`)
    line(`    mostread  : ${r.json.mostread?.articles ? r.json.mostread.articles.length + '건' : '없음'}`)
    line(`    news      : ${Array.isArray(r.json.news) ? r.json.news.length + '건' : '없음'}`)
    if (r.json.mostread?.articles?.length) {
      const a = r.json.mostread.articles.find((x) => (x.extract || '').length > 60) || r.json.mostread.articles[0]
      line(`    mostread 예시: "${a.titles?.normalized ?? a.title}"`)
      line(`      요약 길이 ${(a.extract || '').length}자, 썸네일 ${a.thumbnail ? '있음' : '없음'}`)
    }
  }
}
hr()

/* 2) onthisday 전용 엔드포인트 */
for (const type of ['events', 'selected', 'all']) {
  const url = `https://${LANG}.wikipedia.org/api/rest_v1/feed/onthisday/${type}/${MM}/${DD}`
  const r = await get(url)
  let detail = ''
  if (r.json) {
    const arr = r.json[type] || r.json.events || r.json.selected
    if (Array.isArray(arr)) {
      detail = `${arr.length}건`
      if (arr[0]) detail += ` — 예시: ${arr[0].year ?? '?'}년 "${(arr[0].text || '').slice(0, 40)}…"`
    } else {
      detail = `키: ${Object.keys(r.json).join(', ')}`
    }
  }
  line(`[2] onthisday/${type.padEnd(9)}  HTTP ${r.status}  ${detail}${r.error ? ' ' + r.error : ''}`)
}
hr()

/* 3) 'M월 D일' 문서를 직접 읽어 사건 목록 뽑기 */
{
  const page = `${now.getMonth() + 1}월 ${now.getDate()}일`
  const url =
    `https://${LANG}.wikipedia.org/w/api.php?action=parse&format=json&formatversion=2` +
    `&prop=text&page=${encodeURIComponent(page)}`
  const r = await get(url)
  line(`[3] '${page}' 문서 파싱      HTTP ${r.status}${r.error ? ' ' + r.error : ''}`)
  const html = r.json?.parse?.text
  if (typeof html === 'string') {
    line(`    HTML 길이 ${html.length}자`)
    const headings = [...html.matchAll(/<h2[^>]*>[\s\S]*?<\/h2>/g)]
      .map((m) => m[0].replace(/<[^>]*>/g, '').trim())
      .filter(Boolean)
    line(`    소제목: ${headings.slice(0, 8).join(' / ')}`)
    // 사건 섹션의 li 개수
    const idx = html.search(/id\s*=\s*["']사건["']/)
    if (idx >= 0) {
      const after = html.slice(idx)
      const end = after.search(/<h2[\s>]/)
      const section = end > 0 ? after.slice(0, end) : after
      const lis = [...section.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)]
      line(`    '사건' 섹션 항목 수: ${lis.length}`)
      for (const li of lis.slice(0, 3)) {
        const txt = li[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
        line(`      · ${txt.slice(0, 78)}`)
      }
    } else {
      line(`    '사건' 소제목을 못 찾음`)
    }
  } else if (r.json?.error) {
    line(`    오류: ${r.json.error.info}`)
  }
}
hr()

/* 4) 무작위 문서 20번 뽑아 품질 확인 */
{
  let okCount = 0
  let tooShort = 0
  let notStandard = 0
  let failed = 0
  const lens = []
  const samples = []
  for (let i = 0; i < 20; i++) {
    const r = await get(`https://${LANG}.wikipedia.org/api/rest_v1/page/random/summary`, 8000)
    if (r.status !== 200 || !r.json) {
      failed++
      continue
    }
    const ex = (r.json.extract || '').trim()
    lens.push(ex.length)
    if (r.json.type && r.json.type !== 'standard') {
      notStandard++
      continue
    }
    if (ex.length < 60) {
      tooShort++
      continue
    }
    okCount++
    if (samples.length < 3) samples.push(`${r.json.title} (${ex.length}자)`)
  }
  lens.sort((a, b) => a - b)
  line(`[4] 무작위 문서 20회`)
  line(`    통과 ${okCount} / 너무 짧음 ${tooShort} / standard 아님 ${notStandard} / 실패 ${failed}`)
  line(`    요약 길이 중앙값 ${lens[Math.floor(lens.length / 2)] ?? '-'}자, 최소 ${lens[0] ?? '-'} 최대 ${lens.at(-1) ?? '-'}`)
  if (samples.length) line(`    예시: ${samples.join(' / ')}`)
}
hr()

/* 5) 분류별 문서 뽑기 대안 — 좋은 글 / 알찬 글 목록 */
for (const cat of ['분류:위키백과 알찬 글', '분류:위키백과 좋은 글']) {
  const url =
    `https://${LANG}.wikipedia.org/w/api.php?action=query&format=json&formatversion=2` +
    `&list=categorymembers&cmtitle=${encodeURIComponent(cat)}&cmlimit=5&cmnamespace=0`
  const r = await get(url)
  const members = r.json?.query?.categorymembers
  line(
    `[5] ${cat.padEnd(22)} HTTP ${r.status}  ${
      Array.isArray(members) ? members.length + '건 — 예: ' + members.slice(0, 3).map((m) => m.title).join(', ') : '없음'
    }`
  )
}

line('\n진단 끝. 위 내용을 그대로 복사해서 알려주세요.\n')
