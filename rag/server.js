#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import {
  ensure,
  search,
  formatSearch,
  readPost,
  review,
  formatReview,
  structureReference,
  formatStructure,
  paths,
} from "./index.js";

const log = (msg) => process.stderr.write(`[blog-rag] ${msg}\n`);

const TOOLS = [
  {
    name: "voice_search",
    description:
      "按小节检索作者历史文章里的段落，返回可直接照抄语气的片段，外加该分类的语气画像。" +
      "写完每一节前调用一次，sections 传该小节的内容或标题。不要用它查事实，它是语气样本库。",
    inputSchema: {
      type: "object",
      properties: {
        sections: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          description: "要检索的小节，按提纲拆开，每节一个短句。不要把整篇提纲塞进一个字符串。",
        },
        category: {
          type: "string",
          description: "文章分类，例如「生活吐槽」「ai」。中文站里不同分类是两个腔调，务必传。",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "标签，可选。用于进一步收窄样本池。",
        },
        purpose: {
          type: "string",
          enum: ["exemplar", "material"],
          description: "exemplar=找语气样本（默认）；material=找旧素材，避免重复写过的话",
        },
        topK: { type: "number", description: "每节返回条数，默认 exemplar 3 条 / material 6 条" },
        excludeSlugs: {
          type: "array",
          items: { type: "string" },
          description: "要排除的文章 slug，避免反复引用同一篇",
        },
      },
      required: ["sections"],
    },
  },
  {
    name: "post_read",
    description: "读取指定 slug 的完整历史文章。用于确认某篇值得全文参考，而不是只看片段。",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "文章 slug（文件名去 .md）" },
        maxChars: { type: "number", description: "最大返回字符数，默认 12000" },
      },
      required: ["slug"],
    },
  },
  {
    name: "draft_review",
    description:
      "草稿写完后调用。对照历史语料检查：段落/句子节奏是否偏离、有没有和历史段落高度重合、有没有从没用过的词。" +
      "返回的是可修改的具体证据，不是笼统评分。",
    inputSchema: {
      type: "object",
      properties: {
        draft: { type: "string", description: "草稿正文（markdown）" },
        category: { type: "string", description: "目标分类，决定对比的语气画像" },
        tags: { type: "array", items: { type: "string" } },
      },
      required: ["draft"],
    },
  },
  {
    name: "structure_reference",
    description:
      "按整篇提纲挑一篇「每一节都能命中」的历史文章全文，用来对照整体结构：分几节、每节多长、开头怎么起、结尾怎么收。" +
      "在 voice_search 之后调用一次。它是结构参考，不是内容素材，正文不要照搬。",
    inputSchema: {
      type: "object",
      properties: {
        sections: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          description: "整篇提纲的所有小节，每节一个短句。要传全篇，不是只传一节。",
        },
        category: {
          type: "string",
          description: "文章分类，建议传。不同分类的成文结构习惯不同。",
        },
        tags: {
          type: "array",
          items: { type: "string" },
        },
        maxChars: { type: "number", description: "开头正文的字符数，默认 500。标题骨架总是完整返回" },
      },
      required: ["sections"],
    },
  },
];

const server = new Server(
  { name: "blog-voice-rag", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

function text(value) {
  return { content: [{ type: "text", text: value }] };
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  try {
    if (name === "voice_search") {
      const topK = Number(args.topK) || (args.purpose === "material" ? 6 : 3);
      const payload = search({
        sections: args.sections || [],
        category: args.category,
        tags: args.tags,
        topK,
        excludeSlugs: args.excludeSlugs || [],
      });
      const header =
        args.purpose === "material"
          ? "下面这些旧文已经写过相关话题，避免复述同样的话；可引用作为对照。\n"
          : "下面是作者本人写过的片段，模仿它们的句子长度、断句和口吻，不要模仿内容。\n";
      return text(header + formatSearch(payload));
    }

    if (name === "post_read") {
      const result = readPost({ slug: args.slug, maxChars: Number(args.maxChars) || 12000 });
      if (!result.found) return text(result.message);
      return text(
        [
          `# ${result.title}`,
          `slug: ${result.slug} · ${result.date} · ${result.category || "未分类"}${
            result.tags.length ? ` · #${result.tags.join(" #")}` : ""
          }`,
          "",
          result.body,
        ].join("\n")
      );
    }

    if (name === "structure_reference") {
      const payload = structureReference({
        sections: args.sections || [],
        category: args.category,
        tags: args.tags,
        maxChars: Number(args.maxChars) || 500,
      });
      return text(`这一篇用来对照整体结构，不要照搬内容。\n\n${formatStructure(payload)}`);
    }

    if (name === "draft_review") {
      const payload = review({ draft: args.draft, category: args.category, tags: args.tags });
      return text(formatReview(payload));
    }

    return { content: [{ type: "text", text: `未知工具: ${name}` }], isError: true };
  } catch (err) {
    return { content: [{ type: "text", text: `调用失败: ${err.message}` }], isError: true };
  }
});

async function main() {
  const engine = ensure();
  log(`索引就绪：${engine.posts.length} 篇 / ${engine.segments.length} 段`);
  log(`索引文件：${paths.INDEX_FILE}`);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("MCP server 已连接（stdio）");
}

main().catch((err) => {
  log(`启动失败: ${err.stack || err.message}`);
  process.exit(1);
});
