---
title: 通过vue的例子入门服务端渲染
categories: 工作笔记
date: 2024-06-17 14:26:54
tags: [ssr,vue,nuxt]
---
现在前端语境里的服务器渲染 ( ssr ) 指的是同构渲染 ( isomorphic rendering ). 与上个年代 jsp, php 的模板引擎是有区别的.

下文中讨论的 服务端渲染( ssr ) 都指同构渲染 ( isomorphic rendering ), 并且只与我们最长用的 csr 做一些对比, 不提到模板引擎.

<!--more-->

## ssr 与 csr 的区别

### 如何直观区分 ssr 与 csr

右击网页, 点击`查看页面资源`, 如果看到`body`标签里只有一个`<div id="app"></div>`, 表示这一开始是个空页面, 是加载了 js 后, js 创建了 dom 元素, 并贴到 div#app 上的. 

我们平时写的 vue, react 的 sfc 或 jsx 的信息, 都会在 js 文件里, 被引入后渲染 html, 来丰富 div#app.

上面说的是 csr (客户端渲染,  client-side rendering), 指服务端返回空的 div 标签, 浏览器(客户端)加载 js, 执行 js 的时候渲染目标 div.

对应地, ssr 指服务器的返回已经是用户第一眼可以看到的完整 html 了. 下个章节就说对比着 csr 流程, 说一下 ssr 的流程.

### ssr 与 csr 的流程

csr 的资源 (html, js) 都只需要托管在静态的 web 容器里就可以了.

我们先访问 html 文件, 浏览器分析 html 文件后, 加载 js, 执行 js.

js 的执行会创建 dom, 为 dom 绑定事件, 并贴到对应的 节点上, 让用户看到并可以交互.

---

ssr 的服务器, 就不是静态服务器, 一般是个 node 服务器.

当服务器收到首页请求, 会读取应用(application)页面, 并转化为 html 字符串, 直接返回给浏览器.

浏览器虽然获取到了完整的 html 页面, 但没有 js, 是不能绑定事件, 产生可交互页面的, 所以还是需要加载 js, 并给存在的页面绑定事件, 让页面成为一个可交互的应用.

浏览器端 js 为元素绑定事件的过程叫做 hydrate. 像是为干尸注水, 让他活起来.

## 最简单的 ssr 示例

csr 的资源分为2个部分:  html文件, 与 js 文件.

ssr 也分为2部分:

+ js 文件部分, 形式上与 csr 是一样的, 区别是 render 改为了 hydrate.
+ html 部分, 比起 csr 返回空节点, 需要返回完整应用. 所以需要读取应用并渲染成 html 字符串.

可以感受到, js 部分与 html 部分, 都需要读取 "应用(application)的代码", 所以代码结构会是**html 文件与 js 文件都会读取 应用(application)文件**.

上面说的 html 部分就是 server 部分, js 部分就是 client 部分 (静态部分).

所以我们写个最简单的实例, 只有3个文件: 

+ `app.js`, 具体的应用, 会被其他2个入口同时引用.
+ `server.js`, 引用`app.js`后渲染成 html 字符串, 并返回给浏览器.
+ `client.js`, 与 csr 的 js 资源一样, 被打包成静态资源等待被浏览器加载.

`app.js`:

```js
import { createSSRApp } from 'vue';

export function createApp() {
  return createSSRApp({
    data: () => ({ count: 1 }),
    template: `<div @click="count++">{{ count }}</div>`,
  });
}
```

`client.js`:

```js
import { createApp } from './app.js';

createApp().mount('#app');
```

调用`createSSRApp`, 在 mount 的时候就会调用 hydrate 来替代 render.

`server.js`:

```js
import express from 'express';
import { renderToString } from 'vue/server-renderer';
import { createApp } from './app.js';

const server = express();

server.get('/', (req, res) => {
  const app = createApp();

  renderToString(app).then((html) => {
    res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Vue SSR Example</title>
        <script type="importmap">
          {
            "imports": {
              "vue": "https://unpkg.com/vue@3/dist/vue.esm-browser.js"
            }
          }
        </script>
        <script type="module" src="/client.js"></script>
      </head>
      <body>
        <div id="app">${html}</div>
      </body>
    </html>
    `);
  });
});

server.use(express.static('.'));

server.listen(3000, () => {
  console.log('ready');
});
```

使用`renderToString`把 app 渲染成 html 字符串, 并返回给浏览器.

[完整代码可以点这里](https://stackblitz.com/edit/vue-ssr-example-gnad6z?file=server.js).

> 看完最简单的例子, 敏感的同学应该已经发现, 用 node 服务替代静态 web 容器, 是个很大的坑.
>
> 这也代表了在这个 node 服务需要做监控, 负载均衡, 缓存等运维工作. 部署, ci/cd也变得更复杂.
>
> 而因为有了 node 服务, bff (backend-for-frontend) 也顺便可以用起来了.
>
> 另外也可以发现, ssr 的开发/打包脚本, 也会产生非常大的复杂度.
>
> 我对相关脚本只知道 next / nuxt, 所以之后会以 nuxt 为例进行学习并记录.

## ssr 的优缺点

ssr 的最明显有点就是 seo. 另外是减少首屏加载的 http 请求次数. (另外可能有一些 bff 需求, 公司政治, 个人成长相关的)

接下来谈不上缺点, 只能说是 ssr 产生额外的复杂度有三个部分:

+ 写业务代码需要增加一些限制.
+ 对于开发/打包脚本的工作量.
+ 对于部署/ci的工作量.

越上面是越靠近日常开发的.

下个文章会简单讲一下 vue ssr 的简单实现, 这样就很容易理解业务代码需要有哪些限制了.
