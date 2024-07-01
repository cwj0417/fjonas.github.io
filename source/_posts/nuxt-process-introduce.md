---
title: nuxt流程介绍
categories: 工作笔记
date: 2024-06-24 02:39:04
tags: [ssr,nuxt]
---
在上次写了 vue ssr 简单例子后, 就好奇如何处理 sfc 的情况.

期望的脚本应该能处理 server 端和 client 端的 sfc, 并且可以 hmr. 

觉得以自己的水平完全没有思路, 于是了解了下 nuxt 的流程.

<!--more-->

nuxt 在此外, 还有非常多功能, 这里我先关注是如何同时处理 server 端和 client 端的.

这里以`nuxt dev`的流程为材料, 分析 server 的层级. 也会在第二部分指一下具体是哪些文件与方法.

## server 层级

server 的层级就对应着每个请求的 callstack. 

请求是分为很多种的: 比如请求根页面('/'), 或者路由, 应该会走到服务器渲染. 引入的 script 和 hmr 应该要走到 client 的 compiler.

server 有多层, 可以整合多个服务(server render, client dev, server api等), 还可以更灵活配置以及提高开发体验.

1. dev server.

   最外层的 server, 我们浏览器打开的端口是这层 server 监听的.

   负责转发请求给下一层 server, 并在其他部分没有准备好的时候返回一个"空页面模板", 让页面能立即响应.

2. nuxt dev server.

   在这层 nuxt dev server (后文简称 nds) 除了会监听端口, 并通知上层 server 以便代理到 nds. 

   nds 还有个主要任务, 是创建 nitro, 并启动server render和 client 的构建, 让这 server render 和 client 的构建结果与 nitro 关联.

3. intro.

   在 nds 执行后会创建 nitro, 并把请求代理指给 nitro, 让 nitro 负责请求的最后分发.

**从请求的角度来看, 请求最终都会进入 nitro 被分发, server render 的请求会被转发到一个 worker, client 的请求会被转发到 vite server**.

## 深入一些流程

上面章节的内容已经总结得不错了, 这个部分会比较难以阅读, 但读完会更准确理解一些细节.

我会从`nuxt dev`命令开始, 直到请求到达 worker / vite. 也会写明代码是出自于什么 repo 和什么文件.

### 从 cli 到文件

我们可以从 node_modules 里看到, `nuxt dev`命令跑的是`nuxi`提供的.

来到`nuxi`的`src/run.ts`, 可以看到他用`citty`的`runMain`跑了一段配置, 这段配置加载了`src/commands`文件夹下的命令, 我们执行的命令自然就是`src/commands/dev.ts`了.

命令都会先运行`setup()`再运行`run()`. 下面我们来看`dev`命令.

### dev命令

dev命令主要做了2个事: **起 dev server 监听端口, 起个子进程, 调用`_dev`命令, 并与他建立通信关系**.

在`dev.ts`的`run()`方法里, 读取一些配置后, 我们的执行会走到这个分支:

```ts
if (ctx.args.fork) {
    // Fork Nuxt dev process
    const devProxy = await _createDevProxy(nuxtOptions, listenOptions) // 起 dev server, 监听端口
    await _startSubprocess(devProxy, ctx.rawArgs) // 起子进程
    return { listener: devProxy?.listener }
  }
```

我们分别来看这2个方法.

在`createDevProxy()`中:

```ts
const handler = (req: IncomingMessage, res: ServerResponse) => {
  if (!address) {
    res.statusCode = 503
    res.setHeader('Content-Type', 'text/html')
    res.end(loadingTemplate({ loading: loadingMessage }))
    return
  }
  return proxy.web(req, res, { target: address })
}
```

可以看到 server 的 handler, 判断是否有`address`变量, 如果没有则返回一个"空页面"模板, 如果有, 则把请求代理到 `address`.

`address`是通过向外抛了个`setAddress()`方法来设置`address`.

接下来看`_startSubprocess()`里调用`setAddress()`的地方.

```ts
// Listen for IPC messages
childProc.on('message', (message: NuxtDevIPCMessage) => {
  if (message.type === 'nuxt:internal:dev:ready') {
    devProxy.setAddress(`http://127.0.0.1:${message.port}`)
  } else if (message.type === 'nuxt:internal:dev:loading') {
    devProxy.setAddress(undefined)
    devProxy.setLoadingMessage(message.message)
  } else if (message.type === 'nuxt:internal:dev:restart') {
    restart()
  }
})
```

子进程在接受到`nuxt:internal:dev:ready`的时候会设置`address`.

设置这个`address`变量不光是因为子进程监听的端口不固定, 更重要的是通知这层 server, 下层的东西都准备好了, 在准备好之前现在这层 server 都会返回一个"空页面"的模板.

### nuxt dev server

来到子进程`_dev`的命令: `dev-child.ts`. 这个命令主要是创建了`NuxtDevServer`, 后面会简称 nds.

#### 与父进程建立联系

可以看到创建完 nds 后, 在 nds 收到`ready`事件后, 向父进程发出`nuxt:internal:dev:ready`事件来设置`address`, 以完成和上一章节 dev server 的联系.

```ts
// Init Nuxt dev
const nuxtDev = await createNuxtDevServer({
  // 省略一些参数
})

// IPC Hooks
function sendIPCMessage<T extends NuxtDevIPCMessage>(message: T) {
  process.send(message)
}
nuxtDev.on('ready', (payload) => {
  sendIPCMessage({ type: 'nuxt:internal:dev:ready', port: payload.port })
})

// Init server
await nuxtDev.init()
```

`createNuxtDevServer`做的事情很简单. **监听端口, 创建 nds, 并把端口的 handler 交给 nds**.

nds 在构造方法中是这样处理 handler 的:

```ts
this.handler = async (req, res) => {
  await _initPromise
  if (this._handler) {
    this._handler(req, res)
  } else {
    this._renderError(res)
  }
}
```

可以看到和之前的`address`和`setAddress`非常像了.

这个`_handler`一开始是空值, 是在即将要展开的`nuxtDev.init()`中被赋值的, 我们优先看一下赋值的片段.

```js
function init () {
  // 省略一些代码
  this._handler = toNodeListener(this._currentNuxt.server.app)
  this.emit('ready', addr)
}
```

在 nds 的 `init()`的最后, 设置了`_handler`, 并抛出了`ready`事件, 才调用了上层的`setAdress()`. 所以请求如果可以被分发到 nds 监听的端口, `_handler`一定是存在的了. 如果不存在, 确实可以报异常了.

#### nds init

到现在, 我们知道了, 请求最后都会走到`this._handler = toNodeListener(this._currentNuxt.server.app)`.

那么`this._currentNuxt.server.app`是如何建立, 如何处理请求, 都在`init()`方法里.

代码在`nuxi`的`src/utils/dev.ts`中.

```ts
async init() {
  await this.load()
  await this._watchConfig()
}

async load(reload?: boolean, reason?: string) {
  await this._load(reload, reason)
}
```

可以看到`init()`方法其实是调用`_load()`方法.

```ts
async _load() {
  // 只摘取了这个代码我们关心的部分代码
  
  const kit = await loadKit(this.options.cwd)
  
  this._currentNuxt = await kit.loadNuxt({ /*省略一些参数*/ })
  await this._currentNuxt.ready()
  
  await Promise.all([
    kit.writeTypes(this._currentNuxt).catch(console.error),
    kit.buildNuxt(this._currentNuxt),
  ])
  
  this._handler = toNodeListener(this._currentNuxt.server.app)
  this.emit('ready', addr)
  
}
```

我摘取了我们关心的代码, 并用空行分为了四个部分:

1. 根据配置读取 nuxt, 这里的`kit`其实就是通过 npm 读取了`nuxt`. 后面所有的 "kit.xxx" 的代码都是在 nuxt 仓库里的.
2. 创建 nuxt 实例并执行`ready()`. 这里其实是创建了 intro, 是处理请求的地方, 也就是上面的`this._currentNuxt.server`. 
3. `kit.buildNuxt()`. 在这里进行了 server render 和 client 的构建, 再通过一些方式与上一步的 intro 进行关联, 最后处理请求.
4. 设置`_handler`并上报`ready`事件, 这个前面的章节已经说了.

那么接下来让我们继续看看 nitro 的创建, server render 与 client 的构建, 以及他们是如何进行关联的.

#### nitro

nitro 的创建来自于上个章节的"第一部分", `kit.loadNuxt()`.

上面也说到, 这里的`kit`就是指 nuxt, 方法在 nuxt 仓库里的`src/core/nuxt.ts`中.

```ts
function loadNuxt() {
  // 省略一些代码
  const nuxt = createNuxt(options)
  if (opts.ready !== false) {
    await nuxt.ready()
  }
}
```

`createNuxt()`方法非常简单, nuxt 是一个简单的对象, 下面的代码只省略了几行:

```ts
export function createNuxt (options: NuxtOptions): Nuxt {
  const hooks = createHooks<NuxtHooks>()
  const nuxt: Nuxt = {
    hooks,
    callHook: hooks.callHook,
    addHooks: hooks.addHooks,
    hook: hooks.hook,
    ready: () => initNuxt(nuxt),
  }
  return nuxt
}
```

可以看到 `nuxt.ready()` 就是 `initNuxt()`.

`initNuxt()`方法很长, 做了很多"增加组件, 增加插件, 增加选项"的事. 而我们关心的是这个方法: `await initNitro(nuxt)`.

下面是我们关心的代码:

```ts
export async function initNitro(nuxt: Nuxt & { _nitro?: Nitro }) {
  // 省略了这个方法的比较多代码
  // Init nitro
  const nitro = await createNitro(nitroConfig)

  // Expose nitro to modules and kit
  nuxt._nitro = nitro

  const devMiddlewareHandler = dynamicEventHandler()
  nitro.options.devHandlers.unshift({ handler: devMiddlewareHandler })

  // nuxt dev
  if (nuxt.options.dev) {
    nuxt.hook('server:devHandler', (h) => { devMiddlewareHandler.set(h) })
    nuxt.server = createDevServer(nitro)
  }
}
```

`createNitro()`和之前创建 nuxt 类似, 只是创建了个对象, 然后挂到 nuxt 上.

这里创建了个`devMiddlewareHandler`给`nitro.options.devHandlers`, 并可以通过`server:devHandler`事件来增加 handler, 来配合 vite 使用, 后面会展开.

再看`createDevServer(nitro)`, 他的返回结果被赋值给了`nuxt.server`. 上文提到, 请求最后被代理到`nuxt.server.app`, 就是指这个了.

app 是从 `h3` 引入来的, 使用了`app.use`来注册 handler的. 我们看下相关代码:  

( btw:  h3 和上文提到的 citty 还有合并option 的 defu 都是 nuxt 团队自己写的, 用了 unjs 的马甲)

```ts
export function createDevServer(nitro: Nitro): NitroDevServer {
  const app = createApp();
  
  for (const handler of nitro.options.devHandlers) {
    app.use(handler.route || "/", handler.handler);
  }
  
  app.use(
    eventHandler(async (event) => {
      await reloadPromise;
      const address = getWorkerAddress();
      if (!address) {
        const error = lastError || createError("Worker not ready");
        return errorHandler(error, event);
      }
      await proxy.handle(event, { target: address as any }).catch((error) => {
        lastError = error;
        throw error;
      });
    })
}
```

代码是截取的, 第一个`use()`是读取了`nitro.options.devHandlers`, 刚才说过是通过`server:devHandler`注册 handler的, 是来配合 vite 使用的, 在下个章节展开.

第二个`use()`是配合 server render 的. 可以看到这里把请求代理到一个 worker 了.

我们看一下这个 worker 的来历. (代码也在 createDevServer 中, 在上面的代码块中被我删减了)

```ts
const getWorkerAddress = () => {
  const address = currentWorker?.address;
  return address;
};
let currentWorker: NitroWorker | undefined;

const workerEntry = resolve(
  nitro.options.output.dir,
  nitro.options.output.serverDir,
  "index.mjs"
);

async function reload() {
  // Kill old worker
  const oldWorker = currentWorker;
  currentWorker = undefined;
  await killWorker(oldWorker, nitro);
  // Create a new worker
  currentWorker = await initWorker(workerEntry);
  
  nitro.hooks.hook("dev:reload", reload);
}
```

我们看2个信息:

+ 这个 worker 是 `dev:reload` 事件触发的. 搜了一下看起来是 rollup 构建结束触发的.
+ worker 的文件地址看起来是"打包结果的server部分".

#### build client

下面让我们进入应用的构建部分. 

这需要我们的思路跳到父级分支, 2部分构建都是在`kit.buildNuxt(this._currentNuxt)`中调用的.

`buildNuxt()`也是通过配置加载的, 调用的是`nuxt/src/core/builder.ts`.

```ts
export async function build(nuxt: Nuxt) {
  if (!nuxt.options._prepare) {
    await Promise.all([checkForExternalConfigurationFiles(), bundle(nuxt)])
    await nuxt.callHook('build:done')
  }
}
```

在 build 方法中可以看到, 调用了`bundle()`方法.

这个 `bundle()`方法也是通过配置加载的, 按默认的配置, 现在是加载了 nuxt-vite-bundler, 文件在 nuxt 仓库的 `packages/vite/vite.ts`.

在整理了一系列参数后, 调用了:

```ts
await buildClient(ctx)
await buildServer(ctx)
```

是的, 之前整理的就是 ctx. 那正式开始看`buildClient()`.

```ts
export async function buildClient (ctx: ViteBuildContext) { // 也是省略了前部分整理配置的代码
   if (ctx.nuxt.options.dev) {
    // Dev
    const viteServer = await vite.createServer(clientConfig)
    ctx.clientServer = viteServer
    await ctx.nuxt.callHook('vite:serverCreated', viteServer, { isClient: true, isServer: false })
    
    const viteMiddleware = defineEventHandler(async (event) => {
      await new Promise((resolve, reject) => {
        viteServer.middlewares.handle(event.node.req, event.node.res)
    })
    await ctx.nuxt.callHook('server:devHandler', viteMiddleware)
  }
}
```

和上文说的一样, 通过调用`server:devHandler`, 把`viteMiddleware`注册到`nitro.options.devHandlers`中.

`viteMiddleware`做的事就是把请求交给起起来后的 vite 处理.

#### build server

看完 nitro 是如何把请求交给 client, 接下来思路回到父级, 看看 nitro 是如何把 server render 的请求交给 worker, 这个 worker 又是如何启动的.

在调用了 nuxt 的 build 方法调用了 vite 的 `bundle()`后, 触发了`await nuxt.callHook('build:done')`.

可以看到这个事件是在`initNitro()`中被注册的, 然后调用了 nitro 的 `build()`方法:

```ts
  // nuxt build/dev
  nuxt.hook('build:done', async () => {
    await nuxt.callHook('nitro:build:before', nitro)
    if (nuxt.options.dev) {
      await build(nitro)
    } 
  })
```

```ts
export async function build(nitro: Nitro) {
  const rollupConfig = getRollupConfig(nitro);
  await nitro.hooks.callHook("rollup:before", nitro, rollupConfig);
  return nitro.options.dev
    ? watchDev(nitro, rollupConfig)
    : buildProduction(nitro, rollupConfig);
}
```

看到这里, worker是如何启动的2个问题就都解决了:

在`getRollupConfig()`中, 我们看到了输入路径是之前提到的 worker 文件所在的地方:

```ts
output: {
    dir: nitro.options.output.serverDir,
    entryFileNames: "index.mjs",
  },
```

并且我们的流程, 会走到 `build()`方法的`watchDev()`中.

可以看到`watchDev()`方法触发了`startRollupWatcher()`.

接下来`startRollupWatcher()`给 rollup 编译完成事件注册了触发了`dev:reload`事件, 以触发上文提到的`reload()`方法, 以启动 worker. (worker入口是刚才 rollup 编译的输出)

```ts
function startRollupWatcher(nitro: Nitro, rollupConfig: RollupConfig) {
  const watcher = rollup.watch(
    defu(rollupConfig, {
      watch: {
        chokidar: nitro.options.watchOptions,
      },
    })
  );

  watcher.on("event", (event) => {
    switch (event.code) {
      // Finished building all bundles
      case "END": {
        nitro.hooks.callHook("compiled", nitro);
        nitro.hooks.callHook("dev:reload"); // 触发 上文提到的 reload() 方法
        return;
      }
    }
  });
  return watcher;
}
```

## client 入口 与 server render入口

总结一下上面的内容: **nuxt 把请求都交给 nitro 处理, 浏览器端的请求会代理到 vite 服务, server render 的请求会代理到 一个 worker**.

虽然我们走通了"从请求到处理请求的终端", 但 debug 的过程还是不系统, 可以通过再整理源码或看文档的 hooks 介绍来完整.

另外还有个没深入的点是 路由与 vite 配置, 很多 nuxt 功能都是在 vite 插件里实现的.

虽然暂时打算不看了, 但还是要把 client 入口 和 server render 入口记录下, 便于以后有问题继续查看.

+ server render 的入口: 根据`getRollupConfig(nitro)`的返回结果, 与对 nitropack 的观察, 结果是: `nitropack/src/presets/\_nitro/runtime/nitro-dev.ts`
+ client 的入口: 可以从 nuxt 配置里看到是在`nuxt/src/app/components/nuxt-root.vue`.

