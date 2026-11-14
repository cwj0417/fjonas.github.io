import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readCorpus, tokenize, SEGMENT_CONFIG } from "./corpus.js";
import { buildBm25, bm25Search } from "./bm25.js";
import { buildProfiles, formatProfile, emphasisStats } from "./profile.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const POSTS_DIR = path.join(ROOT, "source", "_posts");
const INDEX_DIR = path.join(ROOT, "rag", ".index");
const INDEX_FILE = path.join(INDEX_DIR, "index.json");
const INDEX_VERSION = 1;

/** 源文件指纹：任一文章改动都会让索引失效并重建 */
function buildManifest(postsDir) {
  const manifest = {};
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith(".md")) {
        const stat = fs.statSync(full);
        manifest[path.relative(postsDir, full)] = `${Math.round(stat.mtimeMs)}:${stat.size}`;
      }
    }
  };
  walk(postsDir);
  return manifest;
}

function manifestMatches(a, b) {
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => a[k] === b[k]);
}

function flatten(posts) {
  const segments = [];
  posts.forEach((post, postIndex) => {
    for (const seg of post.segments) {
      segments.push({
        postIndex,
        slug: post.slug,
        title: post.title,
        date: post.date,
        category: post.category,
        tags: post.tags,
        heading: seg.heading,
        order: seg.order,
        text: seg.text,
        tokens: tokenize(`${seg.heading} ${seg.text}`),
      });
    }
  });
  return segments;
}

let state = null;

function loadFromDisk() {
  const raw = JSON.parse(fs.readFileSync(INDEX_FILE, "utf8"));
  if (raw.version !== INDEX_VERSION) throw new Error("索引版本不匹配");
  if (JSON.stringify(raw.segmentConfig) !== JSON.stringify(SEGMENT_CONFIG)) throw new Error("切段参数变更");
  const manifest = buildManifest(POSTS_DIR);
  if (!manifestMatches(raw.manifest, manifest)) throw new Error("索引已过期");
  return raw;
}

export function rebuild() {
  const posts = readCorpus(POSTS_DIR);
  const manifest = buildManifest(POSTS_DIR);
  fs.mkdirSync(INDEX_DIR, { recursive: true });
  fs.writeFileSync(
    INDEX_FILE,
    JSON.stringify({
      version: INDEX_VERSION,
      segmentConfig: SEGMENT_CONFIG,
      builtAt: new Date().toISOString(),
      manifest,
      posts,
    })
  );
  state = hydrate(posts);
  return state;
}

function hydrate(posts) {
  const segments = flatten(posts);
  return {
    posts,
    segments,
    bm25: buildBm25(segments),
    profiles: buildProfiles(posts),
    vocabulary: new Set(segments.flatMap((s) => s.tokens)),
  };
}

export function ensure() {
  if (state) return state;
  try {
    const raw = loadFromDisk();
    state = hydrate(raw.posts);
    process.stderr.write(`[rag] 载入索引缓存（${raw.builtAt}）\n`);
    return state;
  } catch (err) {
    process.stderr.write(`[rag] 索引重建：${err.message}\n`);
    return rebuild();
  }
}

export function stats() {
  const engine = ensure();
  return {
    posts: engine.posts.length,
    segments: engine.segments.length,
    vocabulary: engine.vocabulary.size,
    categories: engine.profiles,
    indexPath: INDEX_FILE,
  };
}

function poolIndices(engine, { category, tags, excludeSlugs }) {
  const allowed = new Set();
  const excluded = new Set(excludeSlugs || []);
  let poolPosts = 0;

  engine.segments.forEach((seg, id) => {
    if (excluded.has(seg.slug)) return;
    if (category && seg.category !== category) return;
    if (tags && tags.length) {
      const tagSet = new Set(seg.tags);
      if (!tags.some((t) => tagSet.has(t))) return;
    }
    allowed.add(id);
    poolPosts += 1;
  });

  return { allowed, hardFiltered: Boolean(category || (tags && tags.length)), poolSegments: poolPosts };
}

export function search({ sections, category, tags, topK = 5, excludeSlugs = [], maxPerPost = 2 }) {
  const engine = ensure();
  if (!sections || sections.length === 0) throw new Error("sections 不能为空");

  let { allowed, hardFiltered, poolSegments } = poolIndices(engine, { category, tags, excludeSlugs });
  let relaxed = false;

  // 过滤后语料太少时退化为全库检索，避免新分类直接空结果
  if (poolSegments < 20) {
    allowed = null;
    hardFiltered = false;
    relaxed = true;
  }

  const used = new Set();
  const perSlug = new Map();

  const results = sections.map((section) => {
    const hits = [];
    for (const candidate of bm25Search(engine.bm25, tokenize(section), {
      allowed,
      limit: topK * 6,
    })) {
      if (hits.length >= topK) break;
      if (used.has(candidate.docId)) continue;
      const seg = engine.segments[candidate.docId];
      const taken = perSlug.get(seg.slug) || 0;
      // 同一篇最多取 maxPerPost 段，保证样本来自多篇文章而不是一篇
      if (taken >= maxPerPost) continue;
      used.add(candidate.docId);
      perSlug.set(seg.slug, taken + 1);
      hits.push({
        slug: seg.slug,
        title: seg.title,
        date: seg.date,
        category: seg.category,
        heading: seg.heading,
        text: seg.text,
        score: Math.round(candidate.score * 100) / 100,
      });
    }
    return { section, hits };
  });

  const profile =
    engine.profiles[category] || (relaxed && category ? null : engine.profiles["__all__"]);

  return {
    relaxed,
    hardFiltered,
    poolSegments,
    profile,
    profileLabel: engine.profiles[category] && !relaxed ? category : "全站",
    results,
  };
}

/** 按句子边界截断，避免把半句话喂给模型；找不到句末就退化为硬截 */
function clip(text, limit) {
  if (text.length <= limit) return text;
  const window = text.slice(0, limit);
  const cut = Math.max(
    window.lastIndexOf("。"),
    window.lastIndexOf("."),
    window.lastIndexOf("？"),
    window.lastIndexOf("?"),
    window.lastIndexOf("！"),
    window.lastIndexOf("!"),
    window.lastIndexOf("\n")
  );
  if (cut <= limit * 0.6) return `${window.trim()}…`;
  return `${window.slice(0, cut + 1).trim()}…`;
}

export function formatSearch(payload) {
  const lines = [];
  if (payload.relaxed && payload.hardFiltered) {
    lines.push("> 注意：该筛选条件下语料不足 20 段，已退化为全站检索。", "");
  }
  if (payload.profile) {
    lines.push(formatProfile(payload.profile, payload.profileLabel), "");
  }

  let budget = 7000;
  for (const group of payload.results) {
    if (budget <= 0) break;
    lines.push(`### 检索：${group.section}`);
    if (group.hits.length === 0) {
      lines.push("_无命中，可能是全新话题，别硬套旧文。_", "");
      continue;
    }
    group.hits.forEach((hit, i) => {
      const text = clip(hit.text, 320);
      lines.push(
        `${i + 1}. 《${hit.title}》 · ${hit.date} · ${hit.category || "未分类"}${hit.heading ? ` · 小节「${hit.heading}」` : ""} · slug:${hit.slug}`,
        "",
        ...text.split("\n").map((t) => `   ${t}`),
        ""
      );
      budget -= text.length + 80;
    });
  }
  if (budget <= 0) lines.push("_（输出已达长度上限，后续结果省略）_");
  return lines.join("\n").trim();
}

export function readPost({ slug, maxChars = 12000 }) {
  const engine = ensure();
  const post = engine.posts.find((p) => p.slug === slug);
  if (!post) {
    const guesses = engine.posts.filter((p) => p.title.includes(slug) || slug.includes(p.slug)).slice(0, 5);
    return {
      found: false,
      message: guesses.length
        ? `没有 slug 为 ${slug} 的文章。可能是：${guesses.map((g) => `${g.slug}（${g.title}）`).join("，")}`
        : `没有 slug 为 ${slug} 的文章。`,
    };
  }
  return {
    found: true,
    slug: post.slug,
    title: post.title,
    date: post.date,
    category: post.category,
    tags: post.tags,
    body: post.body.length > maxChars ? `${post.body.slice(0, maxChars)}\n\n…（已截断）` : post.body,
  };
}

/**
 * 结构参考：按整篇提纲挑一篇「每一节都能命中」的历史文章。
 * 只用来学整体排版，不是内容素材。
 */
export function structureReference({ sections = [], category, tags, maxChars = 500 }) {
  const engine = ensure();
  if (!sections.length) throw new Error("sections 不能为空");

  let { allowed } = poolIndices(engine, { category, tags });
  if (!allowed || allowed.size === 0) allowed = null;

  // 每节取前 3 篇不同文章：命中的节数越多、分数越高，整篇结构越像
  const agg = new Map();
  for (const section of sections) {
    const perSlug = new Map();
    for (const cand of bm25Search(engine.bm25, tokenize(section), { allowed, limit: 30 })) {
      const seg = engine.segments[cand.docId];
      if (perSlug.has(seg.slug)) continue;
      perSlug.set(seg.slug, cand.score);
      if (perSlug.size >= 3) break;
    }
    for (const [slug, score] of perSlug) {
      const cur = agg.get(slug) || { score: 0, sections: 0 };
      cur.score += score;
      cur.sections += 1;
      agg.set(slug, cur);
    }
  }

  const ranked = [...agg.entries()].sort((a, b) => b[1].score - a[1].score);
  if (ranked.length === 0) return { found: false };

  const [slug, top] = ranked[0];
  const post = engine.posts.find((p) => p.slug === slug);
  const headings = post.body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^#{2,4}\s+\S/.test(line));

  return {
    found: true,
    slug: post.slug,
    title: post.title,
    date: post.date,
    category: post.category,
    sectionsHit: top.sections,
    sectionsTotal: sections.length,
    chars: post.body.length,
    headings,
    body: post.body.length > maxChars ? `${post.body.slice(0, maxChars)}\n\n…（已截断）` : post.body,
    alternates: ranked.slice(1, 3).map(([s, v]) => ({
      slug: s,
      title: engine.posts.find((p) => p.slug === s)?.title || s,
      sectionsHit: v.sections,
    })),
  };
}

export function formatStructure(payload) {
  if (!payload.found) return "没有找到结构相近的文章。";
  const lines = [
    `## 结构参考：《${payload.title}》`,
    `${payload.date} · ${payload.category || "未分类"} · ${payload.chars} 字 · 命中 ${payload.sectionsHit}/${payload.sectionsTotal} 节 · slug:${payload.slug}`,
    "",
    "只看它的结构：分几节、开头怎么起。内容是正文样例，不要照搬。",
    "",
    payload.headings.length ? payload.headings.join("\n") : "（这篇没有二级以下标题）",
    "",
    payload.body,
  ];
  if (payload.alternates.length) {
    lines.push("", `备选结构：${payload.alternates.map((a) => `《${a.title}》(${a.sectionsHit} 节)`).join(" / ")}`);
  }
  return lines.join("\n");
}

function tokenSet(tokens) {
  return new Set(tokens);
}

function containment(a, b) {
  let hit = 0;
  for (const t of a) if (b.has(t)) hit += 1;
  return hit / Math.max(a.size, 1);
}

export function review({ draft, category, tags }) {
  const engine = ensure();
  if (!draft || draft.trim().length < 40) throw new Error("草稿太短，无法评估");

  const profile = engine.profiles[category] || engine.profiles["__all__"];
  const paragraphs = draft
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 40);

  const duplicates = [];
  for (const [index, para] of paragraphs.entries()) {
    const tokens = tokenSet(tokenize(para));
    if (tokens.size < 8) continue;
    const candidates = bm25Search(engine.bm25, Array.from(tokens), { limit: 12 });
    let best = null;
    for (const cand of candidates) {
      const seg = engine.segments[cand.docId];
      const ratio = containment(tokens, tokenSet(seg.tokens));
      if (!best || ratio > best.ratio) best = { ratio, seg, score: cand.score };
    }
    if (best && best.ratio >= 0.3) {
      const flat = para.replace(/\s*\n\s*/g, " ");
      duplicates.push({
        paragraph: index + 1,
        excerpt: flat.length > 80 ? `${flat.slice(0, 80)}…` : flat,
        similarity: Math.round(best.ratio * 100) / 100,
        source: {
          slug: best.seg.slug,
          title: best.seg.title,
          date: best.seg.date,
          heading: best.seg.heading,
          text: best.seg.text.length > 120 ? `${best.seg.text.slice(0, 120)}…` : best.seg.text,
        },
      });
    }
  }

  const draftTokens = tokenize(draft);
  const fresh = new Map();
  for (const token of draftTokens) {
    if (engine.vocabulary.has(token)) continue;
    if (token.length < 2 || /^\d+$/.test(token)) continue;
    fresh.set(token, (fresh.get(token) || 0) + 1);
  }
  const unknownTerms = Array.from(fresh.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([term, count]) => ({ term, count }));

  const sentences = draft.split(/[。！？!?]+/).map((s) => s.trim()).filter(Boolean);
  const draftAvgParagraphChars = Math.round(
    paragraphs.reduce((s, p) => s + p.replace(/\s/g, "").length, 0) / Math.max(paragraphs.length, 1)
  );
  const draftAvgSentenceChars = Math.round(
    sentences.reduce((s, x) => s + x.replace(/\s/g, "").length, 0) / Math.max(sentences.length, 1)
  );

  const draftEmphasis = emphasisStats(draft);
  const refEmphasis = profile.emphasis || { perK: 0, coverage: 0, avgChars: 0 };

  return {
    profile,
    duplicates,
    unknownTerms,
    style: {
      draftAvgParagraphChars,
      draftAvgSentenceChars,
      referenceAvgParagraphChars: profile.avgParagraphChars,
      referenceAvgSentenceChars: profile.avgSentenceChars,
      paragraphRatio: Math.round((draftAvgParagraphChars / Math.max(profile.avgParagraphChars, 1)) * 10) / 10,
    },
    emphasis: {
      draftChars: draft.replace(/\s/g, "").length,
      draftPerK: draftEmphasis.perK,
      draftCoverage: draftEmphasis.coverage,
      draftAvgChars: draftEmphasis.avgChars,
      referencePerK: refEmphasis.perK,
      referenceCoverage: refEmphasis.coverage,
      referenceAvgChars: refEmphasis.avgChars,
      ratio: Math.round((draftEmphasis.perK / Math.max(refEmphasis.perK, 0.1)) * 10) / 10,
    },
    paragraphCount: paragraphs.length,
  };
}

export function formatReview(payload) {
  const lines = ["## 自检结果", ""];
  const s = payload.style;
  lines.push(
    `**段落节奏**：草稿 ${payload.paragraphCount} 段，平均 ${s.draftAvgParagraphChars} 字/段；历史 ${s.referenceAvgParagraphChars} 字/段（${s.paragraphRatio}×）`,
    `**句子长度**：草稿平均 ${s.draftAvgSentenceChars} 字/句；历史 ${s.referenceAvgSentenceChars} 字/句`,
    ""
  );
  if (s.paragraphRatio >= 1.8 || s.paragraphRatio <= 0.55) {
    lines.push("> 段落长度明显偏离历史习惯，读起来会不像你。", "");
  }

  const e = payload.emphasis;
  lines.push(
    `**加粗**：草稿每千字 ${e.draftPerK} 处（覆盖 ${e.draftCoverage}%，平均 ${e.draftAvgChars} 字/处）；历史每千字 ${e.referencePerK} 处（覆盖 ${e.referenceCoverage}%，平均 ${e.referenceAvgChars} 字/处）`,
    ""
  );
  // 草稿过短时密度会被放大，不给加粗建议，避免误报
  if (e.draftChars >= 600) {
    if (e.draftPerK === 0) {
      lines.push("> 一处都没加粗。历史文章的重点结论基本都会加粗，全篇无加粗会显得没有重点。", "");
    } else if (e.ratio >= 2.5) {
      lines.push("> 加粗明显偏多，重点会被稀释。只加在判断句和关键数字上。", "");
    } else if (e.ratio <= 0.4) {
      lines.push(`> 加粗明显偏少。历史文章每千字约 ${e.referencePerK} 处。`, "");
    }
  }

  if (payload.duplicates.length === 0) {
    lines.push("**重复度**：没有和历史段落高度重合的内容。", "");
  } else {
    lines.push("**重复度**：以下段落与旧文重合度较高，考虑改写或直接删掉。", "");
    for (const dup of payload.duplicates) {
      const level = dup.similarity >= 0.45 ? "高度重合" : "部分接近";
      lines.push(
        `${dup.paragraph}. [${level} ${Math.round(dup.similarity * 100)}%] 「${dup.excerpt}」`,
        `   ↳ 出自《${dup.source.title}》${dup.source.date} ${dup.source.heading ? `· ${dup.source.heading}` : ""}：${dup.source.text}`,
        ""
      );
    }
  }

  if (payload.unknownTerms.length === 0) {
    lines.push("**生词**：草稿用词全部在历史语料中出现过。");
  } else {
    lines.push(
      `**生词**：这些词你从没在历史文章里用过，留意是否跑味 —— ${payload.unknownTerms
        .map((t) => `${t.term}${t.count > 1 ? `×${t.count}` : ""}`)
        .join("、")}`
    );
  }
  return lines.join("\n").trim();
}

export const paths = { ROOT, POSTS_DIR, INDEX_FILE };
