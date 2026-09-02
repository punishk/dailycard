/**
 * 카드에 담을 카테고리와 RSS 피드 목록.
 *
 * ── 편집 방법 ────────────────────────────────────────────────
 * · 피드를 빼려면 그 줄 앞에 //  를 붙이거나 지우세요.
 * · 피드를 더하려면 { name: '표시될 출처 이름', url: 'RSS 주소' } 를 추가하세요.
 * · 카테고리를 통째로 빼려면 CATEGORIES 배열에서 해당 블록을 지우세요.
 * · 고친 뒤에는 `npm run fetch` 를 다시 실행하면 반영됩니다.
 *
 * ⚠️ 언론사 RSS 주소는 사이트 개편으로 종종 바뀝니다.
 *    `npm run fetch` 는 피드마다 성공/실패를 표로 보여주고 실패한 건 건너뜁니다.
 *    실패가 뜨면 그 줄만 지우거나 새 주소로 바꾸면 됩니다.
 * ────────────────────────────────────────────────────────────
 */

export const CATEGORIES = [
  {
    id: 'top',
    label: '주요',
    emoji: '📰',
    accent: '#5b8cff',
    feeds: [
      { name: '연합뉴스', url: 'https://www.yna.co.kr/rss/news.xml' },
      { name: '한겨레', url: 'https://www.hani.co.kr/rss/' },
      { name: '경향신문', url: 'https://www.khan.co.kr/rss/rssdata/total_news.xml' },
      { name: '노컷뉴스', url: 'https://rss.nocutnews.co.kr/nocutnews.xml' },
      { name: '구글뉴스', url: 'https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko' },
    ],
  },
  {
    id: 'world',
    label: '세계',
    emoji: '🌍',
    accent: '#3fb9a5',
    feeds: [
      { name: '연합뉴스', url: 'https://www.yna.co.kr/rss/international.xml' },
      { name: '한겨레', url: 'https://www.hani.co.kr/rss/international/' },
      { name: '경향신문', url: 'https://www.khan.co.kr/rss/rssdata/kh_world.xml' },
      {
        name: '구글뉴스',
        url: 'https://news.google.com/rss/headlines/section/topic/WORLD?hl=ko&gl=KR&ceid=KR:ko',
      },
    ],
  },
  {
    id: 'economy',
    label: '경제',
    emoji: '📈',
    accent: '#e0a33e',
    feeds: [
      { name: '연합뉴스', url: 'https://www.yna.co.kr/rss/economy.xml' },
      { name: '한겨레', url: 'https://www.hani.co.kr/rss/economy/' },
      { name: '경향신문', url: 'https://www.khan.co.kr/rss/rssdata/economy_news.xml' },
      { name: '매일경제', url: 'https://www.mk.co.kr/rss/30100041/' },
      {
        name: '구글뉴스',
        url: 'https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=ko&gl=KR&ceid=KR:ko',
      },
    ],
  },
  {
    id: 'tech',
    label: 'IT·과학',
    emoji: '🛰️',
    accent: '#a879f0',
    feeds: [
      { name: 'ZDNet Korea', url: 'https://feeds.feedburner.com/zdkorea' },
      { name: '전자신문', url: 'https://rss.etnews.com/Section901.xml' },
      { name: '경향신문', url: 'https://www.khan.co.kr/rss/rssdata/it_news.xml' },
      { name: '한겨레', url: 'https://www.hani.co.kr/rss/science/' },
      { name: '매일경제', url: 'https://www.mk.co.kr/rss/50100032/' },
      {
        name: '구글뉴스',
        url: 'https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=ko&gl=KR&ceid=KR:ko',
      },
    ],
  },
  {
    id: 'life',
    label: '문화·생활',
    emoji: '🎬',
    accent: '#ef6f8c',
    feeds: [
      { name: '연합뉴스', url: 'https://www.yna.co.kr/rss/culture.xml' },
      { name: '한겨레', url: 'https://www.hani.co.kr/rss/culture/' },
      { name: '경향신문', url: 'https://www.khan.co.kr/rss/rssdata/culture_news.xml' },
      {
        name: '구글뉴스',
        url: 'https://news.google.com/rss/headlines/section/topic/ENTERTAINMENT?hl=ko&gl=KR&ceid=KR:ko',
      },
    ],
  },
]

/**
 * '상식' 카테고리 — 뉴스가 아니라 한국어 위키백과에서 가져옵니다.
 *  · onThisDay : 오늘 날짜에 있었던 역사적 사건
 *  · mostRead  : 오늘 많이 찾아본 문서
 *  · random    : 무작위 문서 요약 (잡학 상식)
 *  · featured  : 오늘의 알찬 글
 */
export const KNOWLEDGE = {
  id: 'trivia',
  label: '상식',
  emoji: '💡',
  accent: '#4bb377',
  enabled: true,
  wikiLang: 'ko',
  onThisDayCount: 8, // 오늘의 역사 카드 수
  mostReadCount: 6, // 오늘 많이 찾아본 문서 수
  randomCount: 8, // 무작위 상식 카드 수
  includeFeatured: true, // 오늘의 알찬 글 포함 여부
}

/** 수집 동작 설정 */
export const OPTIONS = {
  /** 카테고리 하나당 담을 최대 카드 수 */
  maxPerCategory: 40,
  /** 피드 하나당 가져올 최대 기사 수 */
  maxPerFeed: 15,
  /** 이 시간(시간 단위)보다 오래된 기사는 버림. 0이면 제한 없음 */
  maxAgeHours: 48,
  /** 피드 하나당 응답 대기 시간(밀리초) */
  timeoutMs: 15000,
  /** 요약문 최대 글자 수 */
  summaryMaxChars: 220,
  /** 제목에 이 단어가 들어가면 제외 */
  excludeKeywords: ['[포토]', '[부고]', '[인사]', '[게시판]', '[전국날씨]', '오늘의 운세'],
}
