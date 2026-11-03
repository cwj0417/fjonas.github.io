---
title: 给记事软件加上 mcp
categories: 工作笔记
ai: false
date: 2026-10-29 19:40:34
tags: [ai]
---
前阵子一直在折腾 ai 出图的可修改性. 用 sd 生成一张图容易, 想改其中一只手, 改完之后别的地方全变样, 这就很难受. 所有"ai 用得顺手"的领域都有一个共同点: 产物是可以被精确修改的, 代码是这样, 所以代码成了大语言模型第一个攻占的地方.
尝试把 ae 的 mcp 接入 agent, 让 agent 直接操作 ae, 但效果不理想, 因为 agent "看不到"项目效果.

倒是想到很久前写着自用的[schedule-pro](https://schedulepro.yo-cwj.com/), 觉得能让 agent 直接在上面记录东西也省去了复制-粘贴的操作.

<!--more-->

## mcp 发生在哪里

model context protocol, 目标是连接 llm 与应用, 他们之间的关系是这样的.

llm => agent => mcp client => mcp server => app.

mcp 是发生在 mcp client 和 mcp server 之间的, **只要 agent 根据协议开发 client, 应用根据协议开发 server, 任意 agent 和任意应用之间就可以互相调用**.

展开这条链路是这样的:

+ agent 和 llm 交互的时候有 function calling 的 json schema, 来告诉 llm 有哪些工具可以用, llm 回复需要用哪些. tool, skill 也是如此的.
+ agent 内部维护 mcp 的 client, 通过 client 与 server 交互, 在调用 llm 前获取到应用有哪些能力, 在 llm 需要调用应用的时候, 通过 client 与 server 去交互拿结果.
+ server 做的事除了通过协议与 client 交互, 还有根据业务去操作应用, 所以 mcp server 是应用开发者维护的.

## 协议交互的方式

准备在自己的应用里开发 mcp, 先要确定接入方式, 服务由 agent 启动, 还是由应用自己启动.

方案 A 是 stdio, 让 agent 按配置去拉起一个子进程. 这是最常见的做法, 配置里写个 command 和 args 就完事, 不用管端口, 服务随 agent 的生命周期起停.

方案 B 是应用内起一个 http 服务, agent 连过来, 配置里写一个 url 就可以.

我选 B, 理由有三个.

第一, 数据只有一份. 方案 A 里 agent 起的进程和正在运行的 app 是两个进程, 写数据只能写文件, 还得让 app 去监听文件变化再刷新界面, 中间多了一层不可靠. 方案 B 里写操作直接走 app 自己的数据层, 落盘和界面刷新是同一件事.

第二, 应用没开的时候, 写进去也没意义. 我的诉求是"看得见", 而界面只存在于正在运行的应用里. 让 agent 起一个后台进程, 数据写进去了, 但用户打开应用之前什么都看不到, 这个体验是断的.

第三, 多个客户端可以共用一个服务. 我可能同时用两个不同的 ai 客户端, 方案 A 会起两份进程, 方案 B 天然共享.

代价也明确: 用户要手动把服务打开, 端口可能被别的程序占用, 应用退出服务就没了. 这些我都接受, 因为它们都发生在"我正在用电脑"的场景里.

## 协议交互的内容

接下来要决定提供什么接口, 协议里提供的概念分这几种:

服务端提供的:

+ tools: 可执行的动作, 由模型决定何时调用.
+ resources: 只读的数据, 比如一篇文档、一条记录.
+ prompts: 预设的提示词模板, 一般是斜杠命令的形式, 由用户主动选择.

客户端提供的:

+ sampling: server 反过来请求客户端帮忙调一次模型.
+ roots: 客户端告诉 server, 你能访问的目录边界在哪.
+ elicitation: server 在干活途中向用户提问, 补充信息. 这是比较新的能力.

我这里选择了 tools 来进行读取, 写入操作.
代码实现也非常简单, 在 mcp server 里注册 tool, 触发的时候调用应用内部方法操作数据就可以.
这一系列给 mcp 调用的方法挂到一个 bridge 变量上方便管理, 我在 mcp 写入的时候增加了标志, 和应用 ui 配合展示"这条数据是由 mcp 写入的".

## 如何触发

在注册 tool 的时候填写的 description, 这个字段是让 llm 决定是否要调用这个 mcp的.
和 skill 类似, **agent 会带着 mcp 的工具列表去请求 llm, llm 通过读取 description 和 instruction 来决定是否调用 mcp, 调用哪个工具**.
所以能不能在合理的时候触发 mcp 取决于如何设置 description 和 instruction.

我的应用[schedule-pro](https://schedulepro.yo-cwj.com/)是一个记事软件, 所以会强调"记录"相关的关键词, 再根据"记录目标"的类型来决定记录到什么分类中.

## 语言和实现

electron 的应用, 主进程本来就是 node, 这一条几乎把语言选好了. mcp 官方有 typescript 的 sdk, 主进程里直接引, 不用跨语言, 不用额外运行时.

## mcp ui

mcp 有 mcp apps 的扩展协议, 可以在注册 resources 的时候设置 html 的 uri, 让 支持该协议的 agent 调用 mcp 的时候可以获取 html 并展示.
页面我也用 vue 写, 打包的时候一起 build 一下就可以了.

## 总结

给软件开发 mcp 的技术成本低, 直接拉包就可以, 主要需要花的精力是业务上的, 即设计 mcp 的具体资源和 description.
个人觉得, mcp 对 token 的开销也不大, 只是在上下文挂了个列表, mcp 调用的时候再慢也是不消耗 token 的, 但 agent 的使用者尽可能清楚自己挂了哪些 tool/skill/mcp 还是必要的.
