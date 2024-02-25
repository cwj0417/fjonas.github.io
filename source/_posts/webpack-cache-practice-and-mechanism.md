---
title: webpack cache实践与原理
categories: 工作笔记
date: 2024-02-21 13:21:21
tags: [webpack]
---
webpack cache 发布3年多了, 在历史包袱中的项目中其实非常好用.

本文会介绍 cache 在一个项目中的实践经验, 和实现流程, 以及了解流程后的一些推论.

<!--more-->

## webpack cache 实践经验

我的实践经验是基于公司的一个 monorepo 老项目.

效果是单个子项目的**dev速度从110秒减少到了7秒, 单个文件改动10秒**.

下面说的经验也都是基于这个例子.

### 合适的使用场景

webpack cache 的效果是用磁盘空间换 compile 速度.

所以在我看来, webpack cache 更合适在本地 dev 的场景使用, 因为本地 dev 触发 compile 比 ci 服务器频繁得多, 并且改动更小, 可以命中更多缓存, 也能大幅提升开发体验.

### 实践

在实践中, 缓存的命中率没什么可操作性. 优化空间都在减少占用磁盘空间上. 在我的项目中, 我做了以下配置:

1. 如果配置 cache 的文件是读取配置文件的, 要将`buildDependencies` 配置为你的文件, 而不是 `__filename`. 在我们公司打包脚本中是一个 webpack-chain 文件.

2. monorepo 子包会有一些公共依赖, 在 module resolve 的时候也会指到主包的 node_modules, 在这种情况下 cache 配置的 `cacheDirectory` 可以让多个子包指到同一个文件夹, 来节省cache空间. (在 dev 的时候 react-refresh 会产生大几百m的缓存, 是起码可以节省的)

3. 合理设置 `maxAge`, 超过 `maxAge` 的未被使用的缓存会被清除. 

   我的看法是生产设置小, dev看自己电脑空间, 如果足够的话可以不设置. (默认一个月)

## webpack cache 实现流程

下面会深入一下 cache 的实现流程, 了解流程除了满足好奇心, 还可以:

+ 根据特殊场景优化配置.
+ 了解什么边缘情况会造成缓存占用磁盘大.
+ 根据自己需求二开 cache.

webpack cache 的实现流程职能分层非常清晰, 并且只有一个分层比较复杂, 其他都很简单. 

我们从 compile 时调用 cache 说起.

### 在 compile 流程中读取与保存 cache

webpack流程相关的前置知识如果不清楚, 需要先看以往的文章来补一下, 再继续回这里.

在`compilation`里有三个变量: `_modulesCache`, `_assetsCache`, `_codeGenerationCache`. 分别在对应的时间点读取和写入 cache:

+ _modulesCache 读取: 在 addModule 的时候读取. module 的 build 在读取之后, 如果命中 cache, 那么`needBuild`就会是false, 跳过这个 module 的 build, 来节省时间. (build 做的事是运行 loader 和 parse 并分析 ast )

+ _modulesCache 写入: 在 module 的 build 完成之后, 把 build 后的 module 结果按照 module 的 id 存储起来.

+ _codeGenerationCache: 读取和写入分别在`module.codeGeneration()`的前后.

+ _assetsCache: 在最终生成 assets 的阶段, 在获取 manifest 以后读取 cache, 如果命中, 则不逐个调用`fileManifest.render()`来产生 assets 了. 如果不命中, 则调用 render 后写入 cache.

  (这里调用的时候加了层包装是因为这里的 cache 都要匹配 hash )

### 这些 cache 的来源和相关的调用时机

在代码中可以看到, 这些 cache 都是调用 `compiler.getCache()` 获得的, 也就是 `compiler.cache()`封装了一层 facade.

而`this.cache`就是`new Cache()`. 所以上面章节的 cache, 都是 `new Cache()`实例的调用.

另外可以看到, `this.cache`在 compiler 中, 还在对应的流程中调用了 `beginIdle`, `endIdle`, `shutdown`, 和`storeBuildDependencies`.

buildDependency 不影响功能先不看, 其他的调用之后展开.

### 通过 option 指向不同的 cache 实现

进入到`Cache`类里, 发现所有方法的时间都是调用了 tapable.

cache 的具体实现, 是在 apply option 的时候注入的. (文件是 WebpackOptionsApply, 方法是 process )

在这里可以看到, case 很少, 只有2个.

第一个是使用内存, 第二个是使用文件系统写入硬盘.

内存使用里的`MemoryCachePlugin`非常简单: 

> 在内存里建立一个`map`, 分别在外部调用`get()`, 和`store()`方法的时候调用对应的`map`的方法.
>
> 另外在`shutdown`的时候把`map`清了.

对, 就是这么简单. 其实文件系统也这么简单, 复杂的点是读取和写入硬盘.

### 写入文件的 cache 实现: IdleFileCachePlugin

现在我们来看写入硬盘的实现: `IdleFileCachePlugin`.

先看`get`和`store`方法, 其实就是调用了`strategy.store`和`strategy.restore`. 只是多写几行代码来保证所有的写操作都做完再读.

除此之外, 还在 beginIdle 和 shutdown 的时候调用了`strategy.afterAllStored`来持久化 cache.

### PackFileCacheStrategy 主要功能

进入到strategy, 我们关注`store`, `restore`, 和`afterAllStored`方法.

先看`store`, 和`restore`方法, 通过`_getPack()`获取到从硬盘读取的结构化数据`pack`, 分别调用`pack`的`get()`方法和`set()`方法.

`afterAllStored`的作用是把数据持久化到硬盘. 第一步也是获取内存里的`pack`数据, 再经过一定处理来写到硬盘中.

经过观察可以看到, `_openPack()`的读取硬盘, 和`afterAllStored()`的写入文件, 都是通过`fileSerializer()`来进行的.

cache 在内存, 与文件系统的最大区别, 其实就在于持久化的过程, 对于 cache 的读取和写入都是差不多的.

而下面要说的`fileSerializer`做的事, 就把内存中的格式化数据向硬盘读写, **并且尽量优化减少写入的体积**.

### 整理数据与写入和读取文件的 Serializer

这一节是最复杂的, 主要研究对象是`fileSerializer`的2个方法`serialize()`和`deserialize()`.

并且优化逻辑是和上面提到的`pack`和相关实体的数据结构紧密相关的.

首先看`fileSerializer`以 middleware 的形式来分代码职责, 执行`fileSerializer`的`serialize()或deserialize()`的时候, 会轮流执行各个 middleware 的对应的`serialize()或deserialize()`方法.

构造时候的 middleware 有:

1. SingleItemMiddleware: 转化数组/单个元素的, 我感觉就没啥用, 没体会到意义.
2. ObjectMiddleware: 在序列化的时候, 调用目标数据自己的函数, 进行数据整理.
3. binaryMiddleware: 序列化/反序列化成二进制.
4. fileMiddleware: 读取/写入硬盘.

下面展开讲一下我关注的`ObjectMiddleware`.

### `ObjectMiddleware`与`pack`的读取/写入优化

先来看`ObjectMiddleware`的`serialize()`和`deserialize()`方法.

他们的模式其实是一样的: 构造一个上下文`ctx`来给序列化/反序列化的数据对应的方法调用.

其实 s/ds 的直接目标都是`PackContainer`对象, 所以会在 s/ds 的过程中调用`PackContainer`的 s/ds 方法.

ctx中提供的`write`, `read`方法可以操作正在被`ObjectMiddleware`处理的数据, 从而影响`ObjectMiddleware`的处理结果.

另外可以看到`PackContainer`的`writeLazy`的目标是`this.data`, 也就是`pack`对象, 并且`write()`会触发`pack`对象的 s/ds 方法.

经过debug, `PackContainer`里的内容其实是差不多的, 所以核心内容就是`pack`的 s/ds 方法了.

### pack 的数据结构与优化

这是最后一部分, 但比较复杂, 我只有能力简单的说一下.

首先说几个 pack 的关键属性:

+ content: 他是真正存放内容的地方. 但奇怪的他不是一个 map, 而是一个数组.

  **用意是数组的每个元素最后会被写成单独的文件, 通过一些优化, 每次改动可以只写有改动的 cache 所对应的文件**

+ itemInfo: 这个是保存数据关系的地方. 

  他的键是 id, `pack` 的 `get()`, `set()` 的第一步都是先从`itemInfo`中通过 id 找到对应的信息.

  他的值是对应的信息, 信息内容有: **etag 对比 hash; location 存储信息在 content 数组的哪个位置; lastAccess 每次 get 会更新值, 在垃圾回收的时候配合 maxAge 决定是否清理; freshValue 如果不存储在 content 中, 他是一个刚被建立的内容, 值就存在这里, 相对的, location 有值的时候这里是没值的**.

+ invalid: 如果`pack`完全没动, 这个变量可以快速判断. 第一次 `set()` 操作就会把他置为 true.

如果熟悉了这些属性, 那么`pack`的`set()`和`get()`方法就非常好理解了.

最后, `pack`在`serialize()`的方法中进行了垃圾回收的操作, 

就结果而言, 就是合理地对`pack`的数据结构进行一些更新. (主要就是 content 和 itemInfo, lazy, outdated 判断和变更)

但其过程在我能力范围之外, 以后能力有提升的话再回来分析.
