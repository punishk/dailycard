/**
 * RSS 파서 단위 테스트 — 인터넷 없이 동작합니다.
 *   npm test
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  parseFeed,
  toPlainText,
  decodeEntities,
  clamp,
  normalizeTitle,
  normalizeLink,
  isSameStory,
  createDedupe,
  isWarmStory,
  WARM_FILTER,
  assembleCategories,
  extractEntries,
} from './fetch-news.mjs'

const RSS2 = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
  <title>테스트 뉴스</title>
  <item>
    <title><![CDATA[한국은행, 기준금리 동결 &quot;물가 안정 우선&quot;]]></title>
    <link>https://example.com/news/1</link>
    <description><![CDATA[<p>한국은행 금융통화위원회는 1일 기준금리를 연 2.50%로 <b>동결</b>했다.&nbsp;물가 흐름을 더 지켜보겠다는 뜻이다.</p><img src="https://img.example.com/a.jpg"/>]]></description>
    <media:content url="https://img.example.com/thumb.jpg" medium="image"/>
    <pubDate>Tue, 01 Sep 2026 09:15:00 +0900</pubDate>
  </item>
  <item>
    <title>[포토] 가을 하늘</title>
    <link>https://example.com/news/2</link>
    <description>사진 설명</description>
    <dc:date>2026-09-01T08:00:00+09:00</dc:date>
  </item>
  <item>
    <title>본문 이미지만 있는 기사</title>
    <guid isPermaLink="true">https://example.com/news/3</guid>
    <description>&lt;p&gt;앞부분 요약입니다.&lt;/p&gt;&lt;img src=&quot;https://img.example.com/inline.png&quot; /&gt;</description>
    <enclosure url="https://img.example.com/enc.jpg" type="image/jpeg"/>
  </item>
</channel>
</rss>`

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>아톰 피드</title>
  <entry>
    <title type="text">아톰 기사 제목</title>
    <link rel="alternate" href="https://atom.example.com/post/1"/>
    <link rel="edit" href="https://atom.example.com/edit/1"/>
    <summary type="html">&lt;p&gt;아톰 요약 문장입니다.&lt;/p&gt;</summary>
    <updated>2026-09-01T00:10:00Z</updated>
  </entry>
</feed>`

const GOOGLE = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <item>
    <title>전기차 보조금 개편안 발표 - 연합뉴스</title>
    <link>https://news.google.com/rss/articles/ABC123?oc=5</link>
    <description>&lt;a href="https://news.google.com/x"&gt;전기차 보조금 개편안 발표&lt;/a&gt;&amp;nbsp;&amp;nbsp;&lt;font color="#6f6f6f"&gt;연합뉴스&lt;/font&gt;</description>
    <pubDate>Mon, 31 Aug 2026 23:00:00 GMT</pubDate>
    <source url="https://www.yna.co.kr">연합뉴스</source>
  </item>
</channel></rss>`

test('엔티티를 올바르게 디코드한다', () => {
  assert.equal(decodeEntities('a&amp;b'), 'a&b')
  assert.equal(decodeEntities('&quot;따옴표&quot;'), '"따옴표"')
  assert.equal(decodeEntities('&#54620;&#44397;'), '한국')
  assert.equal(decodeEntities('&#xAC00;'), '가')
  assert.equal(decodeEntities('&unknownthing;'), '&unknownthing;')
})

test('HTML을 순수 텍스트로 바꾼다', () => {
  assert.equal(toPlainText('<p>가<b>나</b></p><br/>다'), '가나 다')
  assert.equal(toPlainText('<![CDATA[<p>씨데이타</p>]]>'), '씨데이타')
  assert.equal(toPlainText('<script>var a=1</script>본문'), '본문')
})

test('요약을 자연스럽게 잘라낸다', () => {
  assert.equal(clamp('짧은 글', 100), '짧은 글')
  const long = '첫 문장입니다. ' + '뒤에 이어지는 아주 긴 문장 '.repeat(20)
  const cut = clamp(long, 40)
  assert.ok(cut.length <= 41, `길이 ${cut.length}`)
})

test('제목 정규화가 중복 판정에 쓸 수 있게 동작한다', () => {
  assert.equal(normalizeTitle('[속보] 금리 동결!'), normalizeTitle('금리 동결'))
  assert.notEqual(normalizeTitle('금리 동결'), normalizeTitle('금리 인상'))
})

test('RSS 2.0 항목을 뽑아낸다', () => {
  const items = parseFeed(RSS2, { name: '테스트', url: 'https://example.com/rss' })
  assert.equal(items.length, 3)

  const a = items[0]
  assert.equal(a.title, '한국은행, 기준금리 동결 "물가 안정 우선"')
  assert.equal(a.link, 'https://example.com/news/1')
  assert.ok(a.summary.startsWith('한국은행 금융통화위원회는'))
  assert.ok(!a.summary.includes('<'), 'HTML 태그가 남으면 안 된다')
  assert.equal(a.image, 'https://img.example.com/thumb.jpg', 'media:content를 우선한다')
  assert.equal(a.publishedAt, new Date('Tue, 01 Sep 2026 09:15:00 +0900').toISOString())
  assert.equal(a.source, '테스트')

  const b = items[1]
  assert.equal(b.publishedAt, new Date('2026-09-01T08:00:00+09:00').toISOString(), 'dc:date도 읽는다')

  const c = items[2]
  assert.equal(c.link, 'https://example.com/news/3', 'link이 없으면 guid를 쓴다')
  assert.equal(c.image, 'https://img.example.com/enc.jpg', 'enclosure를 이미지로 쓴다')
  assert.equal(c.summary, '앞부분 요약입니다.')
})

test('Atom 피드를 읽고 alternate 링크를 고른다', () => {
  const { kind } = extractEntries(ATOM)
  assert.equal(kind, 'atom')
  const items = parseFeed(ATOM, { name: '아톰', url: 'https://atom.example.com/feed' })
  assert.equal(items.length, 1)
  assert.equal(items[0].title, '아톰 기사 제목')
  assert.equal(items[0].link, 'https://atom.example.com/post/1')
  assert.equal(items[0].summary, '아톰 요약 문장입니다.')
  assert.equal(items[0].publishedAt, '2026-09-01T00:10:00.000Z')
})

test('구글뉴스는 제목 뒤 출처를 떼고 링크뭉치 요약을 버린다', () => {
  const items = parseFeed(GOOGLE, { name: '구글뉴스', url: 'https://news.google.com/rss?hl=ko' })
  assert.equal(items.length, 1)
  assert.equal(items[0].title, '전기차 보조금 개편안 발표')
  assert.equal(items[0].source, '연합뉴스')
  assert.equal(items[0].summary, '')
})

test('빈 XML이나 쓰레기 입력에도 죽지 않는다', () => {
  assert.deepEqual(parseFeed('', { name: 'x', url: 'https://x' }), [])
  assert.deepEqual(parseFeed('<html><body>404</body></html>', { name: 'x', url: 'https://x' }), [])
  assert.deepEqual(parseFeed('<rss><channel><item><title>제목만</title></item></channel></rss>', { name: 'x', url: 'https://x' }), [])
})

/* ══════════════════════════════════════════════════════════
   중복 걸러내기
   ══════════════════════════════════════════════════════════ */

test('링크에서 추적용 쿼리와 끝 슬래시를 떼어낸다', () => {
  assert.equal(
    normalizeLink('https://www.yna.co.kr/view/AKR123?utm_source=rss&utm_medium=feed'),
    'https://www.yna.co.kr/view/akr123'
  )
  assert.equal(normalizeLink('https://a.com/b/'), 'https://a.com/b')
  assert.equal(normalizeLink('https://a.com/b#top'), 'https://a.com/b')
})

test('같은 사건을 다르게 쓴 제목을 같은 기사로 본다', () => {
  const pairs = [
    ['[속보] 금리 동결', '금리 동결'],
    ['삼성전자 3분기 영업이익 9조원 돌파', '삼성전자, 3분기 영업이익 9조 돌파'],
    ['김종철 경찰청장 대행 첫 행보는 제주', '김종철 경찰청장 대행, 첫 행보로 제주 방문'],
    ['시진핑, 10년 만에 이집트 국빈방문', '시진핑 10년 만의 이집트 국빈방문…중동 외교 시동'],
    ['尹 전 대통령 구속기소', '윤석열 전 대통령 구속기소…내란 혐의'],
    ['국민연금 개혁안 국회 통과', '국회, 국민연금 개혁안 통과시켜'],
    ['정부, 내년 예산안 확정…복지·R&D 비중 확대', '내년 예산안 확정…복지와 연구개발 비중 늘려'],
  ]
  for (const [a, b] of pairs) {
    assert.ok(isSameStory(a, b), `같은 기사로 봐야 함:\n  ${a}\n  ${b}`)
  }
})

test('닮았지만 다른 기사는 묶지 않는다', () => {
  const pairs = [
    ['정부, 내년 예산안 확정', '야당, 내년 예산안 삭감 예고'],
    ['삼성전자 3분기 영업이익 9조원 돌파', 'SK하이닉스 3분기 영업이익 7조원'],
    ['한국은행 기준금리 동결', '한국은행 총재 국회 출석'],
    ['손흥민 2골 활약 토트넘 승리', '이강인 결승골 PSG 승리'],
    ['시진핑 이집트 방문', '트럼프 이집트 방문'],
    ['서울 아파트값 3주 연속 상승', '부산 아파트값 2주 연속 하락'],
    ['애플 아이폰 신제품 공개', '애플 맥북 신제품 공개'],
    ['코스피 2600 돌파', '코스닥 800 돌파'],
    ['기상청 내일 전국 비', '기상청 주말 전국 맑음'],
    ['李 대통령 방미 일정 확정', '李 대통령 방일 일정 확정'],
  ]
  for (const [a, b] of pairs) {
    assert.ok(!isSameStory(a, b), `다른 기사로 봐야 함:\n  ${a}\n  ${b}`)
  }
})

test('등록부가 링크·제목·유사제목 중복을 모두 잡는다', () => {
  const d = createDedupe()
  const first = { title: '삼성전자 3분기 영업이익 9조원 돌파', link: 'https://a.com/1' }
  assert.equal(d.isDuplicate(first), false)
  d.add(first)

  // 같은 링크 (추적 파라미터만 다름)
  assert.ok(d.isDuplicate({ title: '전혀 다른 제목', link: 'https://a.com/1?utm_source=rss' }))
  // 같은 제목, 다른 링크
  assert.ok(d.isDuplicate({ title: '삼성전자 3분기 영업이익 9조원 돌파', link: 'https://b.com/2' }))
  // 비슷한 제목, 다른 언론사
  assert.ok(d.isDuplicate({ title: '삼성전자, 3분기 영업이익 9조 돌파', link: 'https://c.com/3' }))
  // 관련 없는 기사는 통과
  const other = { title: '기상청 내일 전국 비', link: 'https://d.com/4' }
  assert.equal(d.isDuplicate(other), false)
  d.add(other)
  assert.equal(d.size, 2)
})

test('제목이 비어 있으면 담지 않는다', () => {
  const d = createDedupe()
  assert.ok(d.isDuplicate({ title: '', link: 'https://a.com/1' }))
  assert.ok(d.isDuplicate({ title: '!!!', link: 'https://a.com/2' }))
})

/* ══════════════════════════════════════════════════════════
   '따뜻한' 탭 선별
   ══════════════════════════════════════════════════════════ */

test('훈훈한 기사를 골라낸다', () => {
  const warm = [
    ['익명의 기부천사, 올해도 쌀 100포대 두고 갔다', ''],
    ['물에 빠진 초등생 구한 20대 청년에 의인상', ''],
    ['치매 노인 무사히 가족 품으로…경찰에 감사패', ''],
    ["20년째 연탄 나눔 봉사…'이웃이 있어 삽니다'", ''],
    ['화재로 집 잃은 이웃에 성금 3000만원 전달', ''],
    ['고립된 등산객 4명 무사 구조', ''],
    ['장학금 1억 쾌척한 노부부', ''],
    ["10년간 헌혈 100회…'건강할 때 나누고 싶어'", ''],
    ['잃어버린 지갑 찾아준 중학생', ''],
    ['6·25 이산가족 70년 만의 상봉', ''],
    ['백혈병 딛고 완치…다시 교단에 선 교사', ''],
    // 제목엔 단서가 없고 요약에만 있는 경우
    ['한 시민의 조용한 결심', '20년 동안 매달 장학금을 보내 온 사실이 뒤늦게 알려졌다.'],
  ]
  for (const [t, s] of warm) {
    assert.ok(isWarmStory(t, s), `따뜻한 기사로 봐야 함: ${t}`)
  }
})

test('훈훈한 단어를 쓰지만 어두운 기사는 걸러낸다', () => {
  const traps = [
    '복지재단 후원금 3억 횡령한 대표 구속',
    '기부금 유용 의혹…시민단체 압수수색',
    '구조 작업 중 소방관 1명 숨져',
    '봉사활동 확인서 위조 적발',
    '장학금 특혜 지급 논란',
    '성금 모금 사기 일당 검거',
    '감동 실화 영화 흥행 논란',
    '기증 장기 배분 비리 수사',
    '무료급식소 강제 철거에 반발',
    '나눔재단 이사장 배임 혐의 기소',
    '헌혈 버스 추락 사고',
  ]
  for (const t of traps) {
    assert.ok(!isWarmStory(t, ''), `걸러내야 함: ${t}`)
  }
})

test('평범한 뉴스는 따뜻한 탭에 들어오지 않는다', () => {
  const plain = [
    '코스피 2600 돌파',
    '정부, 내년 예산안 확정',
    '삼성전자 3분기 영업이익 9조원',
    '기상청 내일 전국 비',
    '한국은행 기준금리 동결',
    '손흥민 2골 활약 토트넘 승리',
    '정부에 대책 마련을 요구한 시민단체', // '구한' 이 들어 있지만 훈훈하지 않다
    '연탄값 인상에 서민 부담 가중', // 넓은 단어를 뺀 덕분에 걸리지 않는다
  ]
  for (const t of plain) {
    assert.ok(!isWarmStory(t, ''), `따뜻한 기사가 아님: ${t}`)
  }
})

test('따뜻한 탭 키워드 목록이 서로 충돌하지 않는다', () => {
  // 같은 단어가 포함과 배제 양쪽에 들어가면 그 단어는 영원히 걸리지 않는다
  const both = WARM_FILTER.include.filter((w) => WARM_FILTER.exclude.includes(w))
  assert.deepEqual(both, [], `포함·배제 목록에 함께 들어간 단어: ${both.join(', ')}`)
  assert.ok(WARM_FILTER.include.length > 20, '포함 단어가 너무 적다')
  assert.ok(WARM_FILTER.exclude.length > 30, '배제 단어가 너무 적다')
})

test('탭 조립: 따뜻한 탭이 먼저, 주요가 마지막으로 채워진다', () => {
  const cats = [
    { id: 'top', label: '주요', fillLast: true, feeds: [] },
    { id: 'world', label: '세계', feeds: [] },
    { id: 'warm', label: '따뜻한', warm: true, harvestOthers: true, fillFirst: true, feeds: [] },
  ]
  const now = new Date().toISOString()
  const mk = (title) => ({ title, link: `https://ex.com/${encodeURIComponent(title)}`, summary: '', publishedAt: now })

  const rawByCat = [
    // 주요: 훈훈한 기사 하나 + 평범한 기사
    [[mk('익명의 기부천사, 쌀 100포대 두고 갔다'), mk('한국은행 기준금리 동결')]],
    // 세계: 평범한 기사 + 같은 훈훈한 기사가 또 들어옴
    [[mk('시진핑 이집트 국빈방문'), mk('익명의 기부천사, 쌀 100포대 두고 갔다')]],
    // 따뜻한: 자체 피드
    [[mk('20년째 나눔 봉사한 노부부'), mk('복지재단 후원금 횡령 구속')]],
  ]

  const { mergedByCat, stats } = assembleCategories(rawByCat, cats)
  const titles = (i) => mergedByCat[i].map((c) => c.title)

  // 따뜻한 탭: 자체 미담 + 다른 탭에서 데려온 미담. 함정 기사는 빠진다.
  assert.ok(titles(2).includes('20년째 나눔 봉사한 노부부'))
  assert.ok(titles(2).includes('익명의 기부천사, 쌀 100포대 두고 갔다'), '다른 탭 기사도 데려와야 한다')
  assert.ok(!titles(2).some((t) => t.includes('횡령')), '횡령 기사는 빠져야 한다')
  assert.equal(mergedByCat[2].length, 2)
  assert.ok(mergedByCat[2].every((c) => c.kind === 'warm'))

  // 미담은 주요·세계에 다시 나오지 않는다
  assert.ok(!titles(0).includes('익명의 기부천사, 쌀 100포대 두고 갔다'))
  assert.ok(!titles(1).includes('익명의 기부천사, 쌀 100포대 두고 갔다'))

  // 나머지는 제 자리에
  assert.deepEqual(titles(0), ['한국은행 기준금리 동결'])
  assert.deepEqual(titles(1), ['시진핑 이집트 국빈방문'])

  // 걸러낸 중복이 집계된다 (세계에 또 실린 미담 1건)
  assert.ok(stats.dropped >= 1, `중복 집계: ${stats.dropped}`)
})

test('탭 조립: 특정 탭 기사를 주요가 먼저 가져가지 않는다', () => {
  const cats = [
    { id: 'top', label: '주요', fillLast: true, feeds: [] },
    { id: 'economy', label: '경제', feeds: [] },
  ]
  const now = new Date().toISOString()
  const mk = (t) => ({ title: t, link: `https://ex.com/${encodeURIComponent(t)}`, summary: '', publishedAt: now })
  const shared = '삼성전자 3분기 영업이익 9조원 돌파'

  const { mergedByCat } = assembleCategories(
    [[[mk(shared), mk('정부 예산안 확정')]], [[mk(shared)]]],
    cats
  )
  assert.deepEqual(mergedByCat[1].map((c) => c.title), [shared], '경제가 자기 기사를 지켜야 한다')
  assert.deepEqual(mergedByCat[0].map((c) => c.title), ['정부 예산안 확정'])
})
