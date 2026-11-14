const MARKERS = [
  "其实", "真的", "特别", "大概", "应该", "然后", "所以", "但是", "不过", "就是",
  "感觉", "觉得", "可能", "反正", "直接", "有点", "基本", "估计", "这种", "那种",
  "一下子", "不是", "还是", "干脆", "稍微", "确实", "挺", "蛮", "居然", "竟然",
  "需要说的是", "看起来", "另外", "顺便", "顺手", "发现",
];

function countOf(text, needle) {
  let count = 0;
  let at = 0;
  while ((at = text.indexOf(needle, at)) !== -1) {
    count += 1;
    at += needle.length;
  }
  return count;
}

function countRe(text, re) {
  return (text.match(re) || []).length;
}

function nonSpaceLength(text) {
  return text.replace(/\s/g, "").length;
}

/** 加粗统计。加粗是排版语气的一部分：加多少、加多长，都能被量化 */
export function emphasisStats(text) {
  const matches = [...text.matchAll(/\*\*([^*\n]+)\*\*/g)];
  const chars = Math.max(nonSpaceLength(text), 1);
  const boldChars = matches.reduce((sum, m) => sum + nonSpaceLength(m[1]), 0);
  return {
    count: matches.length,
    perK: Math.round((matches.length / chars) * 1000 * 10) / 10,
    coverage: Math.round((boldChars / chars) * 100 * 10) / 10,
    avgChars: Math.round(boldChars / Math.max(matches.length, 1)),
  };
}

/** 这个站用英文标点写中文，句号是 ". " 而不是 "。"，两种都得认 */
const SENTENCE_BREAK = /[。！？!?]+|\n+|\.(?=\s|$)/;

/**
 * 语气画像：全部是确定性统计，不是模型生成。
 * 这些数字才是"像不像"里真正能被验证的部分。
 */
export function buildProfile(posts) {
  const body = posts.map((p) => p.body).join("\n");
  const chars = Math.max(nonSpaceLength(body), 1);
  const perK = (n) => Math.round((n / chars) * 1000 * 10) / 10;

  const sentences = body
    .split(SENTENCE_BREAK)
    .map((s) => s.trim())
    .filter(Boolean);
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  const punctuation = {
    comma: perK(countRe(body, /，|,/g)),
    question: perK(countRe(body, /？|\?/g)),
    exclaim: perK(countRe(body, /！|!/g)),
    dash: perK(countRe(body, /——|\s-\s/g)),
    paren: perK(countRe(body, /（|\(/g)),
    ellipsis: perK(countRe(body, /…|\.\.\./g)),
    colon: perK(countRe(body, /：|:/g)),
  };

  const markers = MARKERS.map((word) => ({ word, count: countOf(body, word) }))
    .filter((m) => m.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    posts: posts.length,
    chars,
    avgSentenceChars: Math.round(sentences.reduce((s, x) => s + nonSpaceLength(x), 0) / Math.max(sentences.length, 1)),
    avgParagraphChars: Math.round(
      paragraphs.reduce((s, x) => s + nonSpaceLength(x), 0) / Math.max(paragraphs.length, 1)
    ),
    avgParagraphsPerPost: Math.round(paragraphs.length / Math.max(posts.length, 1)),
    punctuation,
    markers,
    emphasis: emphasisStats(body),
  };
}

/** 按分类建画像；样本少于 5 篇的分类不单独建，避免统计失真 */
export function buildProfiles(posts) {
  const byCategory = new Map();
  for (const post of posts) {
    const key = post.category || "未分类";
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key).push(post);
  }

  const profiles = {};
  for (const [key, list] of byCategory) {
    if (list.length < 5) continue;
    profiles[key] = buildProfile(list);
  }
  profiles["__all__"] = buildProfile(posts);
  return profiles;
}

export function formatProfile(profile, label) {
  if (!profile) return "";
  const p = profile.punctuation;
  const e = profile.emphasis;
  const markers = profile.markers.map((m) => `${m.word}×${m.count}`).join(" · ");
  return [
    `### 语气画像（${label}，${profile.posts} 篇）`,
    `- 平均段长 ${profile.avgParagraphChars} 字，平均句长 ${profile.avgSentenceChars} 字，每篇约 ${profile.avgParagraphsPerPost} 段`,
    `- 标点密度（每千字）：逗号 ${p.comma} · 问号 ${p.question} · 感叹号 ${p.exclaim} · 破折号 ${p.dash} · 括号 ${p.paren} · 省略号 ${p.ellipsis}`,
    `- 加粗：每千字 ${e.perK} 处，覆盖 ${e.coverage}% 的正文，平均每处 ${e.avgChars} 字`,
    markers ? `- 高频口头词：${markers}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
