import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const CJK_RE = /[\u3400-\u9fff\uf900-\ufaff]/;

/** 切段参数。改动后会写进索引指纹，下次启动自动重建，不会读到旧索引 */
export const SEGMENT_CONFIG = { maxChunk: 480, minChunk: 90, minKeep: 60 };

/**
 * 中文按字面 bigram 切分，英文/数字按词切分。
 * 不依赖分词词典，代价是会有少量噪声，196 篇量级完全可控。
 */
export function tokenize(text) {
  const tokens = [];
  let latin = "";
  let run = "";
  const flushLatin = () => {
    if (latin) {
      tokens.push(latin);
      latin = "";
    }
  };
  const flushRun = () => {
    if (!run) return;
    if (run.length === 1) {
      tokens.push(run);
    } else {
      for (let i = 0; i < run.length - 1; i += 1) tokens.push(run.slice(i, i + 2));
    }
    run = "";
  };

  for (const ch of text.toLowerCase()) {
    if (CJK_RE.test(ch)) {
      flushLatin();
      run += ch;
      continue;
    }
    if (/[a-z0-9]/.test(ch)) {
      flushRun();
      latin += ch;
      continue;
    }
    flushLatin();
    flushRun();
  }
  flushLatin();
  flushRun();
  return tokens;
}

/** 去掉代码块和 hexo 语法，只留可读正文；语气统计不能被代码污染 */
export function cleanBody(body) {
  return body
    .replace(/<!--more-->/g, "")
    .replace(/```[\s\S]*?```/g, "\n")
    .replace(/{%[\s\S]*?%}/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitSections(body) {
  const sections = [];
  let heading = "";
  let buf = [];
  const flush = () => {
    const text = buf.join("\n").trim();
    if (text) sections.push({ heading, text });
    buf = [];
  };
  for (const line of body.split("\n")) {
    const m = /^#{1,6}\s+(.*)$/.exec(line);
    if (m) {
      flush();
      heading = m[1].replace(/\s+#+\s*$/, "").trim();
      continue;
    }
    buf.push(line);
  }
  flush();
  return sections;
}

/** 单段过长时按句子边界切开，避免一刀切在句中 */
function splitLong(text, max) {
  const pieces = [];
  let rest = text;
  while (rest.length > max) {
    const window = rest.slice(0, max);
    const cut = Math.max(
      window.lastIndexOf("。"),
      window.lastIndexOf("！"),
      window.lastIndexOf("？"),
      window.lastIndexOf("\n")
    );
    const at = cut > max * 0.5 ? cut + 1 : max;
    pieces.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) pieces.push(rest);
  return pieces.filter(Boolean);
}

/** 按段落合并成 90~480 字的检索单元 */
function chunkText(text, max = SEGMENT_CONFIG.maxChunk, min = SEGMENT_CONFIG.minChunk) {
  const paras = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const chunks = [];
  let cur = "";
  const flush = () => {
    if (cur.trim()) chunks.push(cur.trim());
    cur = "";
  };

  for (const para of paras) {
    const pieces = para.length > max ? splitLong(para, max) : [para];
    for (const piece of pieces) {
      if (cur && cur.length >= min && cur.length + 1 + piece.length > max) flush();
      cur = cur ? `${cur}\n${piece}` : piece;
    }
  }
  flush();
  return chunks.filter((c) => {
    if (c.length < SEGMENT_CONFIG.minKeep) return false;
    // 表格不是语气样本，整块跳过，避免模型去模仿 markdown 表格
    const lines = c.split("\n");
    const tableLines = lines.filter((line) => line.trim().startsWith("|")).length;
    return tableLines / lines.length < 0.4;
  });
}

function asList(value) {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  return String(value)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function asDate(value) {
  if (!value) return "";
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
}

export function parsePost(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(raw);
  const slug = path.basename(filePath, ".md");
  const body = cleanBody(content);
  const categories = asList(data.categories);
  const tags = asList(data.tags);
  const date = asDate(data.date);
  const segments = [];

  for (const section of splitSections(body)) {
    for (const text of chunkText(section.text)) {
      segments.push({ order: segments.length, heading: section.heading, text });
    }
  }

  return {
    slug,
    title: String(data.title || slug).trim(),
    date,
    category: categories[0] || "",
    categories,
    tags,
    body,
    segments,
  };
}

function collectMarkdown(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectMarkdown(full, out);
    else if (entry.name.endsWith(".md")) out.push(full);
  }
  return out;
}

export function readCorpus(postsDir) {
  if (!fs.existsSync(postsDir)) throw new Error(`文章目录不存在: ${postsDir}`);
  const files = collectMarkdown(postsDir).sort();
  const posts = [];
  for (const file of files) {
    try {
      const post = parsePost(file);
      post.slug = path.relative(postsDir, file).replace(/\.md$/, "");
      posts.push(post);
    } catch (err) {
      process.stderr.write(`[rag] 跳过无法解析的文件 ${file}: ${err.message}\n`);
    }
  }
  posts.sort((a, b) => (a.date < b.date ? 1 : -1));
  return posts;
}
