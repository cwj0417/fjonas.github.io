---
title: webpack-dev-server基本流程
categories: 工作笔记
date: 2023-08-31 17:22:24
tags: [webpack]
---
之前都在了解webpack的build流程. 现在来了解下dev流程是怎么样的.

<!--more-->

## 目标

webpack的build结果是产出一堆文件. 

dev的时候没有文件, 访问一个localhost就能预览代码结果.

我们的目标就是知道webpack-dev-server是如何做到这个效果的.

## TL;DR

先总结, 后面的章节再看细节:

前置知识提要: build的api是`compiler.run()`, dev的api是`devserver(option, compiler)`, 把compiler传给devserver.

**webpack-dev-server会建立server, 让compiler的文件系统指向内存(memfs), 再运行compiler.**

**在收到请求的时候分析出文件名, 并从内存文件里读取, 返回给页面. **

所以webpack-dev-server做的事就约等于: 先build, 再到dist目录起一个web容器.

在此基础上, 还开发了许多能力, 随手举例有: 

+ 可以对compiler进行操作, 从而实现代码热更新. (开启watch模式并加载插件)
+ 接口http代理.
+ 选择协议. (http/https/http2)

到这里, 总结已经结束了. 接下来深入细节, 找到具体哪些关键代码完成了基本效果.

## 深入流程

webpack-dev-server启动的api是`.start()`, 就从这里开始看.

### start()

去掉ipc, bonjour, log, listen等. 重要的流程有以下.

+ `this.normalizeOptions()`. 整理配置, 设置一些默认值.
+ `this.initialize()`. 初始化.
+ `createWebSocketServer()`. 创建ws连接. 与客户端的交互都是通过这里交互的. 即使自己没设置, 也会通过`this.normalizeOptions()`被设置默认值.

这里我们关心的部分是`this.initialize()`, 所以点到这个方法里去.

### initialize()

这里也调用了一系列方法, 我会简单说下每个方法的效果, 并继续深入我们关心的方向.

+ 如果有ws, 加载3个插件: provide, hmr, progress.
+ `setupHooks()`. 在compiler的一些hook里更新自己状态, 并通过ws发送消息.
+ `setupApp()`. 新建express实例.
+ `setupHostHeaderCheck()`. 检查host, 开发的时候自己会改host来避免token跨域, 就在这个方法被拦的, 需要配置忽略host检查.
+ `setupDevMiddleware()`. 使用compiler和option准备好一个express的middleware. 这个方法会展开, 甚至还另起了个repo和npm包.
+ `setupBuiltInRoutes()`. 为express设置一些特殊路由的返回值. (通过url打开ide也是这里配置的)
+ `watchFiles`. 注册检测文件变化后进行的操作.
+ `setupMiddlewares()`. 为express设置middleware. 这个需要在下个部分展开.
+ `createServer()`. 根据配置用express起一个server. 这里会根据配置来决定起http还是https/http2.
+ 监测ctrl+c来调用stop方法, 和代理ws.

到这个步骤, server已经起起来了. 那么为什么我们可以访问到目标代码, 就要继续深入看middleware了.

### setupDevMiddleware()

这个方法里, 为express设置了一系列middleware.

在列举这个方法中设置的middleware前, 先一句话介绍下express的middleware.

类似于redux的reducer, 每个请求的返回值会经过所有middleware瀑布式处理. (前面的返回是后面的输入)

要注意的是, 也和redux的middleware一样, middleware的执行是逆序的. (是不是用compose我没看)

下面开始列举这个方法里设置的middleware:

1. 处理preflight请求的middleware.
2. 根据配置, magicHtml的middleware.
3. 根据配置, 处理静态资源的middleware.
4. 根据配置, 处理historyApiFallback的middleware.
5. 根据配置, 处理proxy的middleware.
6. 在initialize步骤的`setupDevMiddleware()`方法准备好的middleware.
7. 根据配置, 处理header的middleware.
8. 根据配置, 压缩资源的middleware.

其中好几个是express内置的middleware. 而我们能从url中访问到需要的资源的关键, 在于`setupDevMiddleware()`就准备好的middleware. 下一节展开.

### webpack-dev-middleware

```js
setupDevMiddleware() {
  const webpackDevMiddleware = require("webpack-dev-middleware");

  // middleware for serving webpack bundle
  this.middleware = webpackDevMiddleware(
    this.compiler,
    this.options.devMiddleware
  );
}
```

从注释就可以看出来, 我们想要知道的东西就在这里.

并且能猜出: 这个方法接受了compiler和options, 并且返回了一个express的middleware.

接下来的方法调用比较零碎, 大多处理一些细节, 以下就只描述调用`webpackDevMiddleware()`发生的重点了.

1. 建立`context`变量, 用来保存compiler, option和一些状态.

2. tap compiler的一些hook, 以更新`context`里的完成状态`stats`.

3. 把compiler的`outputFileSystem`设为memfs.

4. 调用compiler的`watch()`方法, 以调用compiler的`.compile()`. 

   因为在上一步已经把`outputFileSystem`设置为memfs, 所以compile的emit阶段就会调用memfs的api, 把文件写到内存里了.

   (进一步解释`watch()`到`.compile()`的流程: `watch()` =>  `new Wathcing()` => (constructor)`_invalidate()` => `_go()` => `compile()`)

5. 在middleware中, 先检查compile状态, 如果没编译好就返回`wait until bundle finished (url)`. 直到compile完成. (通过步骤2tap的hook来更新`stats`变量)

6. 在middleware中, 尝试用请求的url来映射文件名.

   如果映射到了文件名, 就从memfs中读取, 并返回.

## 接下来

大概了解了webpack-dev-server, 接下来就可以配合hmr再深一步了解, 还可以配合看一些loader是怎么对资源处理来配合hmr的. (下篇post见)
