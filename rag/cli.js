import fs from "node:fs";
import {
  ensure,
  rebuild,
  stats,
  search,
  formatSearch,
  review,
  formatReview,
  structureReference,
  formatStructure,
  paths,
} from "./index.js";

function parseArgs(argv) {
  const opts = { section: [], tag: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    const value = next && !next.startsWith("--") ? (i += 1, next) : true;
    if (key === "section") opts.section.push(value);
    else if (key === "tag") opts.tag.push(value);
    else opts[key] = value;
  }
  return opts;
}

function cmdIndex() {
  const engine = rebuild();
  const size = Math.round(fs.statSync(paths.INDEX_FILE).size / 1024);
  console.log(`索引已重建：${engine.posts.length} 篇 / ${engine.segments.length} 段 / ${engine.vocabulary.size} 词，${size} KB`);
  console.log(`产物：${paths.INDEX_FILE}`);
}

function cmdStats() {
  const s = stats();
  console.log(`文章 ${s.posts} 篇，检索单元 ${s.segments} 段，词表 ${s.vocabulary} 项`);
  console.log("分类画像：");
  for (const [key, profile] of Object.entries(s.categories)) {
    if (key === "__all__") continue;
    console.log(
      `  ${key}（${profile.posts} 篇） 段长 ${profile.avgParagraphChars} 字 · 句长 ${profile.avgSentenceChars} 字 · 问号 ${profile.punctuation.question}/千字`
    );
  }
}

function cmdQuery(opts) {
  let sections = opts.section.length ? opts.section : [];
  // --file 里一行一个小节，避免在命令行里敲中文
  if (opts.file) {
    sections = fs
      .readFileSync(opts.file, "utf8")
      .split(/\n/)
      .map((line) => line.replace(/^[-*]\s*/, "").trim())
      .filter(Boolean);
  }
  if (opts.q) sections = [opts.q];
  if (!sections[0]) {
    console.error('缺少查询：--section "小节内容" 或 --file sections.txt');
    process.exit(1);
  }
  const payload = search({
    sections,
    category: opts.category,
    tags: opts.tag,
    topK: Number(opts.topK || 3),
  });
  console.log(formatSearch(payload));
}

/** 按整篇提纲挑一篇结构最接近的历史文章，用来看整体排版 */
function cmdStructure(opts) {
  let sections = opts.section.length ? opts.section : [];
  if (opts.file) {
    // 提纲文件：去掉标题的 # 号和列表符号，空行跳过
    sections = fs
      .readFileSync(opts.file, "utf8")
      .split(/\n/)
      .map((line) => line.replace(/^#{1,6}\s*/, "").replace(/^[-*]\s*/, "").trim())
      .filter(Boolean);
  }
  if (!sections[0]) {
    console.error('缺少提纲：--file outline.md 或 --section "小节内容"');
    process.exit(1);
  }
  const payload = structureReference({
    sections,
    category: opts.category,
    tags: opts.tag,
    maxChars: Number(opts.maxChars || 500),
  });
  console.log(formatStructure(payload));
}

function cmdReview(opts) {
  const draft = opts.file ? fs.readFileSync(opts.file, "utf8") : opts.draft;
  if (!draft) {
    console.error("用法: node cli.js review --file /tmp/draft.md [--category 分类]");
    process.exit(1);
  }
  console.log(formatReview(review({ draft, category: opts.category })));
}

/** 用历史文章副标题反向构造查询，检验"能不能找到同类目、同语气的段落" */
function cmdEval() {
  const engine = ensure();
  const posts = engine.posts.filter((p) => p.segments.length >= 3 && p.title.length >= 4 && p.category);
  let coverage = 0;
  let puritySum = 0;
  let purityCount = 0;
  const failures = [];

  for (const post of posts) {
    const payload = search({ sections: [post.title], category: post.category, topK: 5, excludeSlugs: [post.slug] });
    const hits = payload.results[0].hits;
    if (hits.length === 0) {
      failures.push({ title: post.title, category: post.category, note: "无召回" });
      continue;
    }
    const same = hits.filter((h) => h.category === post.category).length;
    const asked = hits.length;
    puritySum += same / asked;
    purityCount += 1;
    if (same > 0) coverage += 1;
    else failures.push({ title: post.title, category: post.category, note: `top5 无同类目（${hits.map((h) => h.category).join("/")}）` });
  }

  const purity = purityCount ? (puritySum / purityCount) * 100 : 0;
  console.log(`样本 ${posts.length} 篇`);
  console.log(`覆盖率（至少召回 1 条同类目）: ${((coverage / posts.length) * 100).toFixed(1)}%`);
  console.log(`纯度（top5 中同类目占比）: ${purity.toFixed(1)}%`);
  if (failures.length) {
    console.log(`\n失败样例（${failures.length} 例，取前 8）：`);
    failures.slice(0, 8).forEach((f) => console.log(`  · ${f.title} [${f.category}] — ${f.note}`));
  }

  const probe = engine.posts.find((p) => p.category && p.title.length > 6);
  if (probe) {
    const payload = search({ sections: [probe.title], category: probe.category, topK: 3, excludeSlugs: [probe.slug] });
    console.log(`\n人工抽查：用《${probe.title}》标题去检索「${probe.category}」，看召回是否同调`);
    for (const hit of payload.results[0].hits) {
      console.log(`  · [${hit.category}] ${hit.title} ${hit.date} — ${hit.text.slice(0, 60)}…`);
    }
  }
}

/**
 * 自命中测试：拿每篇文章自己的段落当草稿，review 必须能指出同源文章。
 * 这是唯一零人工成本、又有标准答案的测试，改任何参数后都应该跑。
 */
function cmdSelfTest() {
  const engine = ensure();
  let tested = 0;
  let sameSource = 0;
  let strong = 0;
  let termTotal = 0;
  const misses = [];

  for (const post of engine.posts) {
    if (post.segments.length < 2) continue;
    const segment = post.segments[1];
    if (segment.text.length < 60) continue;

    tested += 1;
    const payload = review({ draft: segment.text, category: post.category });
    termTotal += payload.unknownTerms.length;
    const hit = payload.duplicates.find((d) => d.source.slug === post.slug);
    if (hit) sameSource += 1;
    if (hit && hit.similarity >= 0.45) strong += 1;
    else misses.push({ slug: post.slug, similarity: hit ? hit.similarity : 0 });
  }

  const pct = (n) => ((n / Math.max(tested, 1)) * 100).toFixed(1);
  console.log(`自命中测试：${tested} 篇`);
  console.log(`  认出来源文章：${pct(sameSource)}%  （应接近 100，掉了说明索引或分词断了）`);
  console.log(`  相似度 ≥45%：  ${pct(strong)}%  （应接近 100，掉了说明阈值或切段有问题）`);
  console.log(
    `  平均生词：     ${(termTotal / Math.max(tested, 1)).toFixed(1)} 个  （应接近 0，偏高说明分词与语料不一致）`
  );
  if (misses.length) {
    console.log(`\n失败样例（${misses.length} 例，取前 6）：`);
    misses.slice(0, 6).forEach((m) => console.log(`  · ${m.slug} — 最高同源相似度 ${m.similarity}`));
  }
}

const [command, ...rest] = process.argv.slice(2);
const opts = parseArgs(rest);

switch (command) {
  case "index":
    cmdIndex();
    break;
  case "stats":
    cmdStats();
    break;
  case "query":
    cmdQuery(opts);
    break;
  case "structure":
    cmdStructure(opts);
    break;
  case "review":
    cmdReview(opts);
    break;
  case "eval":
    cmdEval();
    break;
  case "selftest":
    cmdSelfTest();
    break;
  default:
    console.log(`用法:
  node rag/cli.js index                     重建索引
  node rag/cli.js stats                     查看语料与画像统计
  node rag/cli.js query --file sections.txt 按小节检索（一行一节）
  node rag/cli.js structure --file outline.md 找一篇结构最像的全文
  node rag/cli.js review --file draft.md    草稿自检
  node rag/cli.js eval                      跑召回评测
  node rag/cli.js selftest                  自命中测试（有标准答案的回归检查）`);
    process.exit(command ? 1 : 0);
}
