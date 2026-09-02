/**
 * RSS 파서 단위 테스트 — 인터넷 없이 동작합니다.
 *   npm test
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { parseFeed, toPlainText, decodeEntities, clamp, normalizeTitle, extractEntries } from './fetch-news.mjs'

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
