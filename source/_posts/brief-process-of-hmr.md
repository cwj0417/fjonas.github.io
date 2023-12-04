---
title: hmr简要流程
categories: 工作笔记
date: 2023-11-29 16:27:47
tags: [webpack]
---
时隔好久, 终于进入了hmr的简要流程分析.

<!--more-->

## hmr功能介绍

### 使用hmr

[这里](https://github.com/cwj0417/webpack-explorer/tree/main/hmr)写了一个例子, 用webpack-dev-server起项目. **不需要任何配置.**

只要在能接受hmr的父module里调用`module.accpet()`来注册hmr行为就可以了.

而hmr行为在一般的框架开发中都以loader, plugin的形式被包装了.

这种包装加上webpack配置的包装, 就使hmr如果没有预期工作会让大部分人debug无力.

### 默认配置

虽然什么都没配置, 但其实是在`normalizeOptions()`里处理了默认配置, 和hmr相关的有:

+ webSocketServer: `{ type: 'ws', options: { path: '/ws' } }
+ hot: `true`

(如果手动把这2个配置关了, 那么就会关闭hmr)

## 建立ws连接

从文件变化到页面变化, 页面和服务端是需要有信息交换的. 所以我们从ws连接的建立开始.

### server端创建ws服务

在`Server.js`的`createWebSocketServer()`方法里创建了ws服务.

具体的可以顺着: `createWebSocketServer` => `getServerTransport` => `require("./servers/WebsocketServer")` => `new WebSocket.Server(options);` 看到是用了`ws`包来创建ws服务.

### server端维护clients

在上一步的`WebsocketServer`类的构造方法中.

把ws服务的实例赋值给了`this.implementation`, 并注册了`connection`事件, 把连上自己的clients维护到`this.clients`中.

这样, server端广播的实现就是: 遍历`this.webSocketServer.clients`, 并调用`client.send`发送给浏览器了.

### client建立ws连接

> client端在开启hmr的时候, 被插入了许多代码.
>
> 为保证我们看流程的连贯, 会在后面章节进行解释来源.

在`client-src/index.js`下, 调用了`socket(socketURL, onSocketMessage, options.reconnect)`方法建立了与server的ws连接. 分别说一下这些方法参数:

+ socketURL: 是根据配置产生的server的url.
+ socket方法: 我们可以顺着: `socket` => `new Client(url)` => `WebSocketClient` 看到, 最后调用的是浏览器原生的`WebSocket` api.
+ onSocketMessage: 是一个对象, 键值分别为ws接受到的事件名字, 和执行的脚本. 在`client.onMessage`时被注册.

## 文件更新到页面响应

ws连接完成了, 接下来继续讲: 从文件变化到页面执行业务逻辑的流程.

### compiler.compile()的两种调用方式

众所周知webpack的编译工作是由`compiler.compile()`发起的.

而除了`compiler.run()`以外, 还有`compiler.watch()`可以触发`compiler.compile()`.

`.run()`方法是手动调用, 或者在`.webpack()`方法有回调的时候自动调用. 是之前了解过的.

而运行`webpack-devserver`的时候并没有调用`.run()`, 而是调用了`.watch()`来触发`.compile()`.

在`.watch()`方法中, 实例化了`Watching`: `new Watching(this, watchOptions, handler)`

在构造方法中调用了`this._invalidate()`, 继而调用`this._go()`, 在这里可以看到和`.run()`里类似的代码模式, 调用了`.compile()`.

### server建立watcher

接下来回到`Server.js`, 来找一下哪里调用的`compiler.watch()`.

在`setupDevMiddleware()`的时候, 引入了`webpack-dev-middleware`. 

进入这个仓库, 调用了`context.compiler.watch(watchOptions, errorHandler)`.

于是再回到上一章节, 最后调用了`.compile()`进行编译.

### server检测到module更新

webpack编译完会触发`this._done()`, 再触发`this.watch()`. 

这里用`watchpack`来检测文件更新, 更新后会触发`this._invalidate()`, 继而重复以上流程.

### server重新编译

当再次调用`compiler.compile()`, 也还会从入口开始整个流程, 但在`module.needBuild()`会过滤没有变化的文件. 重新编译的文件会产生新的hash. 

经过debug可以看到, 在`.needBuild()`过程中, 第一次编译会走到`forceBuild`而直接编译.

之后会对比needBuild参数的`valueCacheVersions`和`this.buildInfo.valueDependencies`的hash值.

最后hmr的重新build是被`fileSystemInfo.checkSnapshotValid`返回了`false`而进行重新编译的.

### 产生menifest文件和更新内容文件

hmrplugin在`compilation.hooks.processAssets`钩子调用`emitAsset()`先后产生了新模块内容文件(js文件)和menifest文件(json文件).

可以看到在`processAssets`的钩子里, 获取了compilation的`chunkGraph`, `modules`, `records`中的信息进行了之后的处理. 输出了这2个类型的文件供之后client调用获取更新信息和更新内容.

### server向client推送信息

`.watch()`方法的`invalid`钩子和`.compile()`完成后的`done`钩子都在`Server.js`里的`setupHooks()`被注册了脚本.

最后调用了3次`this.sendMessage()`先后向clients广播了`invalid`, `hash`, `ok`事件.

### client收到module更新信息

让我们回到client的`onSocketMessage`里找到对应的事件.

`hash`事件更新了`status`的`previousHash`和`currentHash`.

`ok`事件把`status`作为参数, **调用了`reloadApp()`方法**, 从名字也可以看出这个是更新应用的核心方法.

然后通过`hotEmitter.emit("webpackHotUpdate", status.currentHash)`调用了`webpack/hot/dev-server.js`中的代码, 执行了`check()`方法. (注意这里是另外一个代码仓库里的)

### 执行更新并兜底

在`check()`方法中, 我们来观察这段关键代码: 

```js
module.hot.check(true).then(function (updatedModules) {}
```

可以看出, `module.hot.check(true)`就是执行hmr业务代码的方法了.

并且在回调里打出了被更新的模块.

在回调中, 如果判断没有任何模块被更新, 那么就会刷新页面来兜底hmr.

`module.hot.check()`的执行流程和冒泡机制打算下次分析.

这里就说明下`module`变量是从哪里来的.

### module变量的来源

我们去到webpack打包结果, 可以看到这个`module`是`webpack_require`的第一个参数. 

(如果对打包结果不熟悉, 可以翻一下我webpack系列前面讲打包结果的文章)

我们来看`\_\_webpack_require\_\_`方法, 这个方法是和没hmr的时候不一样的, 增加了一段`\_\_webpack_require\_\_.i`的拦截. 在拦截里添加了`module`变量的`accept()`等方法.

(这里的`.i()`方法的全称就是拦截器interceptor, interceptModuleExecution)

那接下来的问题是`.i()`方法是哪里来的, 下一章整理了一下client在hmr模式下被插入的代码.

## client额外代码来源

### 运行时方法和全局变量

这里要介绍一个api: `compilation.addRuntimeModule()`. 

在编译结果中额外增加的以iife格式在打包结果中的runtime代码, 都是用这个api的.

继承了`RuntimeModule`的类自己写一个generate方法, 获取runtime的global变量, 并替换一些模板, 最后返回一个字符串就行了. (当然也可以直接返回字符串)

我在[我的demo代码仓库](https://github.com/cwj0417/webpack-explorer/tree/main/addRuntimeModule)里也写了最简的例子, 很容易看.

### 从入口新增的代码

另外一个来源就比较简单, 是在`Server.js`中`addAdditionalEntries()`方法添加的2个文件入口. 如果有`EntryPlugin`的话就会直接调用. 

增加的2个文件是: `webpack-dev-server/client-src/index.js`和`webpack/hot/dev-server.js`

## 总结

### Server.js

为入口文件新增2个文件.

建立ws服务.

调用webpack的编译, 并检测文件变化触发增量编译.

注册`done`钩子, 在编译完成后向client发送消息.

### hmrPlugin

从编译时候的钩子中获取信息.

编译结束根据信息emit文件.

为runtime加入module变量, 这里包含了拉取上一步emit的文件流程和执行hmr业务的代码.

### 流程总结

1. client和dev-server建立ws连接.
2. 文件变化, 重新编译, 并产生menifest文件和更新内容文件.
3. 通知client.
4. client请求menifest文件和更新内容文件.
5. 用获取的新内容替换缓存内容. (webpack_requrei.cache)
6. 根据menifest文件尝试执行hmr业务, 并尝试冒泡, 或兜底刷新.

(后几步上文没详解, 等下次分析)

### 简单聊我是如何debug的

说2个一开始错误的debug思路:

+ 逐行看代码(Server.js), 根据配置判断代码执行情况.

  这么做不容易抓重点, 并且会打击信心.

+ 配置了`writeToDisk` + `static`. (具体配置在上面代码仓库里有) 希望直接看到dev时候生成的代码. 

  这么做会触发static文件监听而刷新页面, 不可行. 直接看浏览器network就行了, 实在需求的情况下再配置一下, 查看dist文件.

最后现在debug模式是: **根据发生的事情追溯导致行为的代码**. 本文也是按照发生事情的流程进行的, 容易理解.
