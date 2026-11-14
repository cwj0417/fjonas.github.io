# blog-rag

基于历史文章的语气检索层。不是给模型查资料用的，是给它**学你怎么写**用的。

检索器是 BM25 + 中文 bigram，无模型、无 embedding、无外部 API，全离线。

## 现状

| 指标 | 实测值 |
|---|---|
| 语料 | 196 篇 → 2066 个片段 |
| 索引产物 | 2.5 MB，`rag/.index/index.json`（已 gitignore） |
| 冷启动 | ~0.35s（读缓存索引，不扫 md） |
| eval 覆盖率 | 99.5%（189 篇样本） |
| eval 纯度 | 100%（top5 全同分类） |
| selftest | 100% / 100% / 平均生词 0.0 |

## 它做什么

给一段**新提纲的小节**，返回历史上写法最接近的**原文片段**，加上该类目的**语气画像**（段长、句长、标点密度、加粗密度、口头词排行）。

产出直接进 LLM 的 context。不摘要、不改写——语气没法被摘要，只有原文的句长和断句才是能模仿的东西。

## 四个能力

| 命令 | 作用 |
|---|---|
| `voice_search` | 按小节检索原文片段 + 语气画像 |
| `structure_reference` | 按整篇提纲挑一篇结构最接近的历史文章：完整标题骨架 + 开头 500 字 |
| `post_read` | 取某篇全文（片段不够时用） |
| `draft_review` | 草稿对照历史语料：重合度、生词、段落节奏、加粗密度 |

`voice_search` 的 `purpose` 参数区分意图：

- `exemplar`（默认）——找语气范文，默认每节 3 条
- `material`——找旧素材防重复，默认每节 6 条

`structure_reference` 解决的是另一个问题：片段只能学句子，学不到整篇怎么排。它按「每一节是否都能命中同一篇」排序，返回**完整标题骨架 + 开头 500 字**，用来对齐"开头怎么起"和"分几节"。正文默认只给开头，是因为结构信息集中在起手式，不是全文。命中节数低于一半时说明没有真正结构相近的文章，不该硬套。

## 结构

```
rag/
├── corpus.js    读 md、清代码块、按小节切段、bigram 分词
├── bm25.js      倒排表 + 饱和打分（k1=1.4, b=0.75）
├── profile.js   语气画像统计
├── index.js     索引落盘/懒重建 + 三个 API 的实现
├── cli.js       命令行：index / stats / query / review / eval / selftest
├── server.js    MCP 适配层（stdio）
└── .index/      索引产物（gitignore）
```

**分层原则**：`index.js` 是纯逻辑，不依赖 MCP。所有调试都在 CLI 层完成，MCP 只是 schema 包装。检索出问题改 `index.js`，包装出问题才看 `server.js`。

## 索引

下文所有 CLI 命令都是在 `rag/` 目录下执行的，别在仓库根目录跑。

索引是**产物**，不是源码。构建时算三样东西：切段结果、BM25 倒排表、语气画像。

```
node cli.js index     # 手动重建
```

一般不用手动跑。`index.js` 里有指纹校验，两种情况自动重建：

- `_posts` 下任一 md 的 mtime 或 size 变了
- `SEGMENT_CONFIG`（切段参数）改了

`K1` / `B` 是运行时计算的，改完立即生效，不触发重建。

**没有训练过程。** BM25 不需要训练，也没有权重文件。所谓"训练产出"就是上面那个索引 json。

## 调试

### 四层，按顺序来

**第 1 层：看单条查询**

```bash
node cli.js query --section "办健身卡 年卡 价格 去的次数" --category "生活吐槽" --topK 3
```

命令行里不方便敲中文时，用文件输入（一行一节）：

```bash
node cli.js query --file /tmp/sections.txt --topK 3
```

看整体结构参考（传整篇提纲，一行一节）：

```bash
node cli.js structure --file /tmp/outline.md
```

**第 2 层：回归检查**

```bash
node cli.js eval
```

只看有没有变坏。同分类有 36 篇，纯度天然高，100% 不代表召回好。

**第 3 层：自命中测试（唯一有标准答案的）**

```bash
node cli.js selftest
```

拿每篇自己的第 2 段当草稿，看 `draft_review` 能不能指出它来自哪篇。标准答案已知，零人工成本。

基线：**认出来源 100% / 相似度≥45% 100% / 平均生词 0.0**。任何一项掉了，说明索引或分词断了，后面的测试都不用看。

**第 4 层：草稿自检**

```bash
node cli.js review --file /tmp/draft.md --category "生活吐槽"
```

### 判据：六条，每条对应一个参数

| 判据 | 不合格说明什么 |
|---|---|
| 话题匹配 | query 太抽象，补具体名词 |
| 层级匹配（问流程却召回总览） | 切段太大，`maxChunk` 调小 |
| 句子完整 | 切段太小，`maxChunk` 调大 |
| 上下文独立（开头是"这个/上述"） | 切段太小，同上 |
| 代表性（是列表/引用/备注） | 多半是 query 引到了边角 |
| 多样性（3 条来自 3 篇） | `maxPerPost` 调成 1 |

注意第 2、3 条方向相反：**增大切段修好"句子完整"，同时恶化"层级匹配"。** 只看一条会越调越偏。

### 调参顺序（收益从高到低）

| 顺序 | 参数 | 位置 | 何时动 |
|---|---|---|---|
| 1 | `maxChunk` / `minChunk` / `minKeep` | [corpus.js](corpus.js#L8) `SEGMENT_CONFIG` | 片段被切坏或混主题时。可试 360 / 480 / 640 |
| 2 | `maxPerPost` | [index.js](index.js) `search` | 想多看几篇文章时调 1 |
| 3 | 退化阈值 `poolSegments < 20` | [index.js](index.js) `search` | 一般不用动 |
| 4 | `K1` / `B` | [bm25.js](bm25.js#L1-L2) | 最后才碰，短 query 下差别很小 |

**规则：一次只改一个，改完跑 `selftest` + `eval`，再抽查一条 query。**

### 什么时候算调好

不是"看起来都挺好"，是**边际收益归零**：把参数改一档，再跑同样 5 条 query，如果没有一条从"不合格"变"合格"，就停手。

验收三条：

1. `selftest` = 100% / 100% / ≤0.5
2. `eval` 覆盖率 ≥99%，纯度 100%
3. 自己写 5 条**真实提纲**（不是成品标题），4 条以上能当范文

### 已知的边界

- **bigram 会有碎片**：`代社`、`共图` 这类半截词会出现在 `draft_review` 的生词列表里。看生词时只认能组成完整词的那几个。要消掉得引入 jieba，代价是多一个原生依赖。
- **原文固有的跨节引用修不了**：比如《关于目标论的思考》某段以"于是我想到了记忆里另一个事"开头，那是作者自己承接上文，不是切段造成的。调 `maxChunk` 也救不回来。
- **无时间加权**：2018 年的片段和 2025 年的权重一样。实测你的逗号密度从 24/千字（2016）涨到 52/千字（2026），句长稳定在 26-31 字。如果要的是"现在的你"，需要加时间段过滤。

## 接入

### MCP（stdio）

```json
{
  "mcpServers": {
    "blog-voice-rag": {
      "command": "/Users/cwj/.nvm/versions/node/v22.18.0/bin/node",
      "args": ["/Users/cwj/repo/blog/rag/server.js"]
    }
  }
}
```

用**绝对 node 路径**，别写 `node`——skill 的启动环境里 PATH 通常没有 nvm。

新机器首次要装依赖：

```bash
cd /Users/cwj/repo/blog/rag && npm install
```

### 冒烟测试

```bash
printf '%s\n' \
'{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"t","version":"1"}}}' \
'{"jsonrpc":"2.0","method":"notifications/initialized"}' \
'{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
| node server.js
```

三个 tool 都列出来就算通。`tools/list` 少一个说明 schema 语法错，stderr 里有堆栈。

## 给 skill 的用法约束

这几条必须写进 skill 的 prompt，否则检索再好也白搭：

1. **模仿形式，禁止复述内容。** 片段是语气样本，不是素材。
2. **按小节查，不要整篇提纲塞一个 query。** 整篇会向话题词坍缩。
3. **`category` 必传。** 站里技术文和生活吐槽是两个腔调，混了必然串味。
4. **3 条够用。** 再多不会更像，只会增加抄句子概率和 context 占用。
5. **写完调 `draft_review`。** 重合度报 100% 就是抄了，生词太多就是跑味了。
