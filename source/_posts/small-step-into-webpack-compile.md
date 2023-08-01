---
title: webpack compile深入一小步
categories: 工作笔记
date: 2023-06-26 17:16:02
tags: [webpack]
---
说是webpack compile, 准确的说是compiler执行run方法的过程, 这里包含make, seal, emit三个阶段.

这里会比[上篇](/2023/05/31/brief-introduction-of-webpack-execution-process/)多深入一步, 介绍下最简单的情况下, 一个module经过各个阶段时的状态.

这些状态中夹杂着非常多的二开点(hooks), 了解module的状态, 就能知道在什么阶段可以对他大概进行什么处理了.

但对细节和具体数据结构点到为止, webpack细节实在是太多了, 慢慢再展开.

<!--more-->

关于如何调试, 在上一篇有介绍, 在最近的调试中, 想强调的是, 遇到hooks, 回调, queue, 要注意记得使用`run to line`, 如果错误按了`下一步`, 那就得从头来过. 调试的技巧下文都不说了, 直接说结论. 

## tldr

运行一次webpack, 项目文件走过的流程是:

1. 从配置中找到入口文件.
2. 从配置中找到与入口文件匹配的loader.
3. 读取入口文件, 并以此运行所有loader, 把结果保存下来.
4. 分析上一步得到的结果, 依赖了哪些别的文件.
5. 对这些入口文件依赖的文件, 重复步骤2~步骤4, 并记录所有文件之间的依赖关系.
6. 根据配置和插件的操作, 确定需要输出的文件有几个, 分别包含了哪些项目文件.
7. 根据上一步确定好的关系, 和步骤3每个文件运行loader后的结果, 再综合配置和插件, 计算出最终输出的文件内容.
8. 把需要输出的文件写到磁盘中.

知道了流程后, 我们在写插件的时候就知道, 在那里修改项目文件会被分析依赖或走babel. 在哪里进行切分输出的文件, 或是在哪里控制代码压缩, 代码优化.

下面是详细一些的流程.

## make

在这个阶段开始时, `compilation`实例刚被建立, 还什么都没有, 模块的信息只存在于webpack配置的entry里.

### addEntry

由`EntryPlugin`注册的hooks, 调用了`compilation.addEntry()`, 启动compile流程.

把入口信息放到`compilation.entries`里.

### factory.create()

通过`EntryPlugin`注册的dependency和moduleFactory是`EntryDependency`和`normalModuleFactory`, 执行了`handleModuleCreation`.

最后执行了`factory.create()`, 这里的factory是`normalModuleFactory`, 主要信息参数就是`EntryDependency`, 其中包含了配置中entry的信息.

在create方法中, 调用的`factorize`hooks和`resolve`hooks都在自己的构造器里定义的.

#### resolve.tapAsync

resolve阶段比较复杂, 处理了模块引入的前缀和pre/post的loader, 最后整理出了`createData`.

`createData`里放入了: module的url, 整理后的所有loader, parser和generator.

之后读取url的内容再调用整理完的loader就行了. parser和generator是通过hooks注册的, 我的简单例子中被注册的都是javascriptplugin提供的.

#### factorize.tapAsync

resolve阶段结束后, 这里有2个hooks`createModule`和`module`, 可以用来二开factory.create的结果.

我的例子中都没有做任何处理, 那么factory.create的结果是`new NormalModule(createData)`.

这里的`createData`是经过resolve阶段赋值的, 所以这个被实例化的NormalModule里已经包含了url, loader, parser和generator了.

至此, factory.create结束, 返回结果是NormalModule实例.

### addModule

获取到module实例后, 添加/更新到`compilation`的`_modulesCache`, `_modules`, 和`modules`属性里.

然后调用`moduleGraph.setResolvedModule()`, 把entryDependency和实例化的module进行关联.

### module.build()

通过调用一系列方法, 走到了`module.build()`, 在执行前有个`buildModule`的hooks, 以及把当前module添加到了`compilation`的`builtModules`中. 然后开始运行`build()`方法, 我例子里的module是`NormalModule`.

`NormalModule`的`build()`分为2个阶段.

#### runLoaders

调用`runLoaders()`, 当前module需要调用哪些loader已经在factory.create的resolve阶段整理好了.

所以这里做的理解成读取文件, 然后按个调用loader, 拿到最后的结果. (其实很复杂有很多概念, 以后展开)

拿到的结果, 除了文件内容经过loaders以后的字符串, 还有一系列依赖信息.

 把依赖信息和loader信息存到`compilation`的`buildInfo`里, 并把字符串结果存在`_source`里.

#### parse

还得说个前提, 我的例子走到的是javascript parser.

parse除了通过hooks把ast暴露给二开用户, 还做了个重要的事: 通过`import`和`exportImport`hooks和别的内置plugin关联, 别的plugin通过这个hooks调用了module的`addDependency()`.

(顺便说一下用户在hooks里修改ast是无意义的, 这里ast可以认为是只读的, 只能用来分析, 甚至这个ast都不会被保存到webpack流程里.)

然后对`_source`和hash方法配置进行hash, 保存到module中. (其实这部在运行完loader就可以做了)

到这里, module的build就完成了, 最后更新一下`_modulesCache`.

### processModuleDependencies

在parse阶段module通过别的内置plugin调用`addDependency()`而新增了自己的`dependencies`.

遍历`dependencies`, 调用`moduleGraph.setParents()`来建立module间的关系.

再调用`processDependencyForResolving()`来处理dependencies的关系. (这里todo, 没深入看)

处理完以后, 对处理过的dependencies进行遍历, 调用`handleModuleCreation()`进行处理, 重复从`factory.create()`开始的步骤. (直到所有被build的模块都没有dependencies了.)

## seal

make阶段结束后, 所有module已经都完成build, 拥有自己的`_source`, 存放在多个属性和moduleGraph中了.

### chunkGraph

seal开始前, 我们只有moduleGraph来维护module间的关系.

现在出现了多个变量: chunks, chunkGroup, chunkGraph. 

再加上之前的module和moduleGraph. 在seal开始的阶段被互相关联起来了. (通过`connectChunkGroupAndChunk()`, `chunkGraph.connectChunkAndEntryModule()`, `entryModules.add()`等, 在我的例子中, entrypoint是特殊的chunkGroup.)

我们稍微来看一下变量间的联系:

+ chunkGraph的`_chunks`和`_modules`和`moduleGraph`.
+ chunk里有`entryModule`和`_groups`.
+ chunkGroups里自然有chunk的信息.

总的来说, module是基本单位, chunk中包含了module并且是最后输出一个文件的单位.

而moduleGraph记录着module间的关系, 这个是不能改变的, 因为是项目代码决定的.

chunkGraph记录着chunk和module的包含关系, 初始有算法, 但是可以通过调用api来改变的.

调用了很多hook, 主要是修改modulegraph, dependency. 

modulegraph会影响下一步chunkgraph的关系建立, dependency会影响codegen的结果. (也影响一些别的hook)

然后调用`buildChunkGraph()`来建立chunkgraph和modulegraph之间的关系.

然后调用了很多hook, 这里是关于修改chunkgraph的hook.

走完这段流程, chunkGraph被建立起来, chunk, module之间都有了确定的联系. (而这里有一大坨hooks可以操作chunk, 但不在主流程讨论范围)

### codeGeneration

遍历modules和各个情况, 让所有的模块都调用`module.codeGenerate()`, 并把所有结果存到`compilation.codeGenerationResults`里.

javascript的codeGenerate的输入是运行过loaders的结果`_source`.

然后遍历module的dependency, 最后执行`sourceDependency()`.

`sourceDependency()`做的事也很简单, 根据dependency去compilation里取一个template. 然后调用template.apply.

compilation里dep和template的关系都是plugin给的. 一般plugin都会在compilation阶段设置关系(通过`compilation.dependencyTemplates.set()`, 并且在别的生命周期给module增加dependency. (通过`addDependency()`)来影响codegen结果.

### createChunkAssets

遍历chunk, 通过`renderManifest`这个hooks和其他内置plugin联动, 获取产生最后assets的`render()`方法.

`renderManifest`是一个waterfall hook, 会轮流调用, 把上一个的结果传给下一个.

直接在webpack代码里搜索, 很多plugin都注册了, 然后判断当前module归不归自己管, 如果归自己管就处理.

以javascriptModulePlugin为例, \_\_webpack_require\_\_xx之类的方法都是这里被加上的.

`renderManifest`的运行是为了生成一个`render()`方法.

`render()`方法的生成, 依赖之前`buildChunkGraph`整理出的chunkGraph. 

具体行为是: 通过`chunkGraph.getOrderedChunkModulesIterableBySourceType`来获取chunkgraph的chunkgraphchunk(cgc)中的modules, 再读取每个module的codegen结果, 并用`Template.renderChunkModules`拼接起来.

这个`render()`函数执行后就能获得可以最终输出的`source`了.(可以理解为字符串, 只是为处理方便弄的数据结构)

最后调用`emitAsset()`来向`assets`里添加键值. 这个api也是webpack文档的plugin demo介绍的api.

至此, `compilation`里已经有`assets`了, 也就是最终要写到磁盘数据的信息.

## emit

seal阶段结束后, 回到`compiler`, 调用`compiler.emitAssets()`.

根据配置的输出路径, 创建目录, 读取`compilation`的`assets`.

这里的assets已经包含了每个文件的输出路径和内容, 调用api输出就完事了. 

至此webpack的一次执行结束.

## todo

这次整理的流程中, seal阶段最模糊, 又很重要, 最需要之后深入:

+ dependency的意义

+ 如何利用dependency和template影响codegen结果

+ seal阶段具体的事情, 和`buildChunkGraph`, 如何treeshaking/scopehoisting, 如何调整chunk

