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

/** 구글뉴스 검색 결과를 RSS 로 받는 주소. when:7d 는 최근 7일로 좁힌다. */
const googleNewsSearch = (query) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`

export const CATEGORIES = [
  {
    id: 'top',
    label: '주요',
    emoji: '📰',
    accent: '#5b8cff',
    // 다른 카테고리를 다 채운 뒤 남은 기사로 채운다.
    // 이렇게 해야 세계·경제 기사가 주요에도 또 뜨는 일이 없다.
    fillLast: true,
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
  {
    id: 'warm',
    label: '따뜻한',
    emoji: '🌱',
    accent: '#e8795a',
    // 이 탭만 특별합니다.
    //  · warm: true      → 아래 WARM_FILTER 로 훈훈한 기사만 걸러 담습니다
    //  · harvestOthers   → 다른 탭이 받아온 기사 중에서도 훈훈한 것을 데려옵니다
    //  · fillFirst       → 가장 먼저 채워서, 여기 실린 기사가 다른 탭에 또 나오지 않게 합니다
    warm: true,
    harvestOthers: true,
    fillFirst: true,
    // 사회·지역면에는 미담이 많지만 그만큼 어두운 기사도 많아,
    // 넉넉히 받아 놓고 키워드로 걸러냅니다.
    maxPerFeed: 60,
    feeds: [
      { name: '연합뉴스', url: 'https://www.yna.co.kr/rss/society.xml' },
      { name: '한겨레', url: 'https://www.hani.co.kr/rss/society/' },
      { name: '경향신문', url: 'https://www.khan.co.kr/rss/rssdata/society_news.xml' },
      { name: '오마이뉴스', url: 'https://rss.ohmynews.com/rss/ohmynews.xml' },
      { name: '에이블뉴스', url: 'https://www.ablenews.co.kr/rss/allArticle.xml' },
      // 구글뉴스에서 훈훈한 키워드로 직접 검색합니다
      { name: '구글뉴스', url: googleNewsSearch('미담 when:7d') },
      { name: '구글뉴스', url: googleNewsSearch('선행 화제 when:7d') },
      { name: '구글뉴스', url: googleNewsSearch('기부 전달 when:7d') },
      { name: '구글뉴스', url: googleNewsSearch('훈훈 감동 when:7d') },
      { name: '구글뉴스', url: googleNewsSearch('의인 구조 when:7d') },
      { name: '구글뉴스', url: googleNewsSearch('나눔 봉사 when:7d') },
    ],
  },
]

/**
 * '따뜻한' 탭에 실을 기사를 고르는 기준.
 *
 * include 중 하나라도 있어야 하고, exclude 가 하나라도 있으면 뺍니다.
 * exclude 가 중요합니다 — "기부금 횡령", "구조 작업 중 사망" 처럼
 * 훈훈한 단어를 쓰면서 실제로는 어두운 기사가 많기 때문입니다.
 *
 * 원하시는 단어를 자유롭게 더하거나 빼세요. 고친 뒤 `npm run fetch` 하면 반영됩니다.
 */
export const WARM_FILTER = {
  /**
   * 이 중 하나라도 제목이나 요약에 있으면 후보가 된다.
   *
   * 넓은 단어는 일부러 뺐습니다.
   *  · '응원' → 스포츠 기사가 통째로 딸려 옵니다
   *  · '연탄', '김장' → "연탄값 인상", "배추값 폭등" 이 걸립니다
   *    (이런 기사는 대개 '나눔'·'봉사'가 함께 들어 있어 어차피 걸립니다)
   *  · '구한' → "요구한", "촉구한" 에도 들어 있습니다
   */
  include: [
    '미담', '선행', '훈훈', '온정', '나눔', '기부', '성금', '후원금', '장학금',
    '봉사', '헌혈', '기증', '의인', '감동', '사랑의', '재능기부', '무료급식',
    '무료 진료', '이웃사랑', '자원봉사', '위문',
    '구했다', '구해낸', '살려낸', '살렸다', '목숨을 구',
    '구조돼', '구조된', '구조됐', '구조했', '무사 구조', '전원 구조', '극적 구조',
    '되찾아', '되찾은', '돌려줬', '돌려준', '찾아줬', '찾아준',
    '감사패', '표창', '선한', '천사', '은인', '보답', '상봉', '완치',
    '기적적', '희망을', '익명의',
  ],

  /** 이 중 하나라도 제목에 있으면 아무리 훈훈해 보여도 뺀다 */
  exclude: [
    // 죽음·사고
    '숨져', '숨진', '숨졌', '사망', '시신', '주검', '참사', '참변', '유족',
    '빈소', '영결', '추모', '분향', '희생자', '중태', '중상', '위독',
    // '화재로', '고립' 은 일부러 뺐습니다 —
    // "화재로 집 잃은 이웃 돕기", "고립된 등산객 구조" 는 훈훈한 기사입니다.
    '붕괴', '폭발', '추락', '침몰', '매몰', '실종',
    // 범죄·법정
    '횡령', '유용', '배임', '사기', '편취', '뇌물', '리베이트',
    '징역', '실형', '벌금', '구속', '기소', '송치', '입건', '체포', '검거',
    '피소', '고소', '고발', '수사', '압수수색', '영장', '재판', '선고',
    '학대', '폭행', '성추행', '성폭행', '성범죄', '음주운전', '마약', '도박',
    '갑질', '협박', '절도', '유괴', '납치',
    // 갈등·부정
    '논란', '의혹', '파문', '규탄', '반발', '갈등', '소송', '분쟁',
    '적발', '은폐', '조작', '허위', '위조', '부실', '비리', '특혜', '유착',
    '파업', '해고', '감원', '체불', '부도', '파산',
    // 자해
    '자살', '극단적 선택', '투신',
  ],

  /** 이 탭에 담을 최대 카드 수 */
  maxCards: 30,
}

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
