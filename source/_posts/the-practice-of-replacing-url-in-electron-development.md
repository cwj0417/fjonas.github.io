---
title: electron开发模式中替换url实践
date: 2021-05-12 01:00:04
categories: 工作笔记
tags: [electron,esbuild]
---
在开发流程中, 会遇到根据环境判断url的问题, 像这样的代码(真实代码):

```js
const winURL = process.env.NODE_ENV === 'development'
    ? `http://localhost:9080`
    : `file://${__dirname}/index.html`
```

这次深入这个问题, 来发掘一些更好的实践.

<!--more-->

## 缺点

这种写法的优点是不需要多思考, 节约工时. 那么一个东西有优点, 就有缺点, 列举一下:

+ 写起来麻烦和难看.
+ 在浏览器环境会依赖打包工具处理`process`.
+ 如果端口被占用, 会导致一系列意外的错误.
+ 如果引入另一个url, 就需要再写一次一样的代码.

我的问题发生在electron的主进程里, 在这个场景中, 起了主进程后不能像浏览器改个端口那么方便, 需要杀了重启, 也不存在host, 可以使用相对路径来避免问题.

所以解决这个问题就成了很必要的事, 并且从可能性来看, **本质是引用了同一个url, 获得的内容也是相同的, 理论上业务代码引入同一个url就可以了.** 

**而这种写法的本质就是把工程化代码写到了业务代码里.** 

## 方案

目标是: 在业务代码里只需要普通引入, 达到dev和build无感. 类似于:

```js
import mainHtml from '@/renderer/index.html'
// mainHtml在dev和build环境里获取到对应期望的值:
// dev: http://localhost:端口/index.html
// build: file://路径/index.html
```

所以方案是:

1. build时拦截特定路径, 根据环境返回期望的资源.
2. 在dev时先检测端口再设置拦截返回值.
3. 在build时正确获取地址.

在遇到问题的项目中用的是esbuild打包, 下面进入解决问题具体步骤.

## 详细步骤

### esbuild

从几个方面介绍下esbuild.

#### 特点

 快. 官网说打包three.js主流的打包工具分别耗时36秒~118秒, esbuild只要0.4秒.

用go写, 处理ts比tsc官方快, 处理es比babel快.

#### 用处

vite, snowpack都在使用esbuild. 但因为功能不完善, 生产环境没有使用, 在开发过程和压缩代码的时候替换现在的主流工具.

#### api

api有三种方式, 命令行, js api, go.

api有2个, `transform`和`build`. 

`transform`处理字符串, 一般用于浏览器和作为别的工具的插件.

`build`处理文件系统, 也允许把文件里的引入也bundle到一块.

那自然地, 我们这里就使用`build`的js api.

#### 概念

esbuild有许多和webpack, rollup类似的概念如: entry, out, format, target, loader, plugin 等.

这里就介绍几个用到的option.

+ entryPoints: 入口. 这里直接指到我们需要处理的文件就行了.
+ outfile: 结果存放的文件.
+ bundle: 要设为true, 如果为false就会不去resolve引入的其他模块.
+ platform: 这里填node. 这个项目的打包结果是在node运行的, esbuild会把结果打成cjs.
+ external: 希望打包结果里直接require, 运行的时候node有能力去resolve的模块. 填写以后esbuild就不会去处理这些模块. 这里要填的内容是**node可以resolve的模块**, 那就有2个部分, 分别是项目的node_modules和全局的node_modules和node api. node api在platform设为node的时候会默认添加.
+ plugin与loader: 解决这个问题的主要功能.

### 编写插件

再次明确目标:

我们要将输入`import mainHtml from '@/renderer/index.html'` 分别输出为`http://localhost:端口/index.html` 与 `file://路径/index.html`.

esbuild的loader和plugin概念与webpack不同. **我的理解是: esbuild的plugin+loader功能等于webpack的loader. webpack的plugin是可以获取ast的, 而esbuild不提供这个功能**.

+ esbuild的plugin的resolve像webpack的test. 在解析新模块时正则匹配来决定命中哪个plugin.进入plugin以后, 可以获取正在操作的模块信息. 进行操作后返回内容和loader.
+ esbuild的loader是指esbuild如何解析当前的内容. 只有一系列内置的loader.

在plugin的onLoad方法里返回了loader和loader去处理的内容就可以达到目的.

### 处理开发环境

开发环境的目标是: `http://localhost:端口/index.html`.

这里loader直接用`text`就可以, 2个变量. `index.html`直接读模块内容可以获取.

而端口需要用`detect-port`来探测未被占用的端口(这个lib是从cra里找到的, 被很多著名lib使用着), 再将这个未被占用的端口分别传入vite里和esbuild的build脚本里就行了.

### build环境处理

buidl环境的目标是: `file://路径/index.html`.

这里的难点是, 要获取到打成生产包以后的文件地址. 于是用了`pathToFileURL`这个node api.

注意是打成生产包以后的文件地址, 所以不能在build时运行. 所以选用了`js`loader. 把我们准备的变量拼接成cjs的字符串, 指定loader为`js`就搞定了.

