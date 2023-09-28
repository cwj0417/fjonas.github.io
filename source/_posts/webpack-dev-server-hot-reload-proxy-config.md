---
title: webpack-dev-server热加载proxy设置
categories: 工作笔记
date: 2023-09-24 18:47:11
tags: [webpack]
---
前几天同事提了如标题的需求, 我觉得挺有意思的, 就实现了一下.

<!--more-->

## 什么场景可以实现这个需求

只有一个要求: 你的dev流程是programmatically的.

原因也很好理解, 因为变化的proxy文件是读配置文件的.

无论是项目里的script还是公司脚手架, 修改这十几行代码就可以热加载proxy配置了, 所以值得分享出来.

## 思路介绍和代码实现

### 思路介绍

思路非常简单的, 分为2步: 

1. 内存中建立一个变量来保存当前proxy配置. 在初始化和文件变化时修改变量.
2. 覆盖传入webpack-dev-server的proxy配置, 让proxy读取上一步骤中建立的变量来代理请求.

### 代码实现

所以代码也分为2步.

首先建立一个变量来存放proxy配置:

```typescript
let proxies: any = [];
```

然后初始化的时候修改变量: 

(我的script里使用的是webpack-chain, 使用config文件的话代码会更简单.)

```typescript
const webpackConfig = config.toConfig();
if (webpackConfig.devServer?.proxy) {
  if (Array.isArray(webpackConfig.devServer?.proxy)) {
    proxies = webpackConfig.devServer?.proxy;
  } else {
    proxies = [webpackConfig.devServer?.proxy];
  }
}
```

然后在配置文件变化的时候修改变量:

```typescript
const watcher = chokidar.watch(userConfigPath);

watcher.on('change', (path) => {
  delete require.cache[path];
  const chainConfig = require(path);
  const proxyChain: any = () =>
    new Proxy(() => {}, {
      get() {
        return proxyChain();
      },
      apply(_fn, _this, args) {
        proxies = args[0];
      },
    });
  const config = proxyChain();
  chainConfig({ config });
});
```

这个步骤说明几个点:

+ `userConfigPath`是配置文件的url.
+ 因为读取的是webpack-chain.js, 动态的, 需要require, 所以之前需要清理require缓存, 如果你用config.json直接去读文件parse就行了.
+ 读取webpack-chain中的proxy信息比config.json麻烦一些. 我这个随手写的, 看起来能用, 应该存在没考虑到的bug, 大家根据自己的配置写就行了.

最后, 写一下代理的逻辑就行了, 需要注意的是, 我们要让这个方法**覆盖**原来的proxy配置.

```typescript
import { match } from 'http-proxy-middleware/dist/context-matcher';
webpackConfig.devServer = {
  ...webpackConfig.devServer,
  proxy: [
    (req) => {
      if (!req) return {};
      const server = req.socket?.server;
      if (server) {
        server.removeAllListeners('close');
      }
      for (const proxyConf of proxies) {
        if (
          match(
            proxyConf.context,
            req!.originalUrl || req!.url,
            req!,
          )
        ) {
          return proxyConf
        }
      }
      return {};
    },
  ],
};
```

关于这段代码, 从上往下, 简单解释一下:

+ proxy设置是可以接受方法作为参数的, 内部已经有实现, 但文档没写, 因为有些问题. 之后展开.
+ 对server移除close事件, 是处理上面说的问题, 和流程无关.
+ 找到原本行为执行的match方法来判断请求是否符合proxy策略, 返回对应的proxy配置. 以保证行为与webpack-dev-server原本行为一致.

看到了这里修修改改把代码贴到你的script里已经可以实现目标了.

代码很简单, 但我写的过程走过弯路, 所以稍微了解了一下proxy流程, 有兴趣的可以看下一节深入.

## dev-server代理流程

接下来会介绍dev-server的大概的流程, 过程中也会进一步解释这些问题: 

+ proxy配置传入函数的行为.
+ 为什么要获取到server并清除事件监听.
+ match方法是从哪里找到的.

首先我们从webpack-dev-server开始看.

### 函数作为proxy参数是怎么被执行的

这里我们找到`Server.js`的`setupMiddlewares()`方法, 搜索`if (this.options.proxy)`就可以找到proxy配置被加载的地方了.

(webpack-dev-server的前置知识请去看我前一篇post)

proxy配置是一个数组, 数组被遍历, 每一个配置都会向express实例推入一个middleware.

> 简单介绍下express的middleware, 类似于瀑布式调用, express会把`request`, `response`, `next()`这三个参数依次传给middleware, middleware是依次调用.
>
> 要注意的是, middleware的顺序是影响行为的. 我尝试不给dev-server传proxy, 自己给express写middleware, 结果是不执行的, 可能是dev-server里的有middleware没有调用`next()`.

在proxy的middleware种, wds使用了`http-proxy-middleware@2`(现在最新版本是3). 但没像`http-proxy-middleware`文档里那样直接作为middleware, 进行了一些处理.

在proxy是object的时候, wds走了一下bypass, 如果不走bypass就正常调用``http-proxy-middleware`.

而我使用了函数的情况, 如果proxy配置是个函数, 那么每次请求都会通过`reqest`, `response`调用函数来获取一个新的proxy配置. 

我们只要让这个函数读取最新的proxy配置并返回就可以了. 

于是产生了个新的问题: 如何根据`request`来决定返回哪个proxy配置.

想解决这个问题, 就需要再打开`http-proxy-middleware`的代码仓库看一下.

### http-proxy-middleware

记得把分支切到2.x, 再开始看代码.

首先在wds中使用的方式是 `createProxyMiddleware(proxyConfig)`, 返回值是一个middleware.

进入代码, 可以看到`createProxyMiddleware()`方法是实例化了`HttpProxyMiddleware()`, 并返回了实例的`middleware`属性.

进入到`HttpProxyMiddleware`代码, 直接观察`middleware`. 可以发现: 他就是一个express的middleware.

主要做了2件事:

+ `shouldProxy()`判断当前request是否命中proxy规则.
+ `this.proxy.web()`发起代理请求.

这里的`shouldProxy()`正好是我们需要, 去写在proxy函数里判断命中的方法, 就是我们代码中`match()`的来源.

`this.proxy.web()`是真正根据proxy配置来发起代理请求, 并返回给请求端的流程.

传给`this.proxy.web()`的参数是根据`proxyOptions`产生的, 而这个变量虽然是私有变量, 其实我们是可以自己去修改的. (因为编译后就不存在私有变量的概念了) 我尝试在`http-proxy-middleware@3`中修改也可以做到动态代理. (但先不展开了)

再往下看, middleware代码还有一段监听`server`的代码.

因为每次代理都会产生一个新的`HttpProxyMiddleware`实例, 所以`server`的监听也会进行多次, 这个不是期望发生的.

可以看到`server`是从request里取到的, 他是在哪里被赋值的, 监听事件又要用什么api来取消. 这些问题就需要进入到`this.proxy`的来源去看了.

```js
this.proxy = httpProxy.createProxyServer({});
```

所以我们即将进入到下个环节: `http-proxy`, 来解决现存的2个疑问: 具体代理行为, `socket`的监听如何取消.

### http-proxy

进入到`http-proxy`代码, 可以看到`createProxyServer()`方法是实例化了一个`ProxyServer()`.

在`ProxyServer()`第一行, `socket`取消监听的问题就有了答案: `EE3.call(this);`

我们去`eventemitter3`的代码里看了下, 只要调用`removeAllListeners()`就可以移除所有监听了.

继续看到: `this.web = createRightProxy('web')(options);` 实际进行代理请求的就是这个方法.

来到`createRightProxy()`方法, 看起来有50多行, 但前面一大堆整理参数, 实际就是依次执行`web-incoming.js`里的所有方法, 而核心的就是`stream()`方法.

在`stream()`方法中, 根据配置require了`'http'`或者`'https'`来发一起一个请求, 请求地址是代理地址.

在请求的`response`事件里又一次调用了`web-outgoing.js`的所有方法进行输出. 

并且在`web-incoming.js`里搜索`server.emit`, 可以看到我们proxy配置里的一些钩子都是从`http-proxy`里发射出去的.
