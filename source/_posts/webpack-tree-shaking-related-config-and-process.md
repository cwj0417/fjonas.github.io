---
title: tree-shaking相关的配置和流程介绍
categories: 工作笔记
date: 2023-07-17 18:30:53
tags: [webpack]
---
关于treeshaking我之前只知道个概念, 把mode设为production就开启了treeshaking.

还知道一些"esm", "sideEffect". 但具体的其实很模糊.

(这其实归功于文档一般般, 中文文档更有问题)

这次就来更深入一步. (这篇post需要一些前置知识, 有概念不清楚的需要去webpack系列看一下.)

<!--more-->

## 什么是treeshaking

大家都知道个概念, 但其实在webpack中, ts是由多功能点配合完成的.

我写了一个[demo](https://github.com/cwj0417/webpack-explorer/tree/main/treeshaking), 是有一些dead-code的最简单示例. **下面的内容都会围绕例子展开, 请看一下代码.**

平时我们把mode设置为production, 会开启很多配置, 也就不知道是哪几个配置完成ts了.

在demo中, 我摸索了几个相关的配置. 

在第一部分中会逐个介绍每个配置的作用与联合作用.

在第二部分里会指出每个配置是在webpack的哪些流程中的. (但会比较浅, 并避开具体算法)

### usedExports

开启后, 没有被别的模块使用的export, 将不会在打包结果中导出.

在我的demo中, `sub`方法没有被别的module引用, 开启配置后就没有被导出.

这个配置已经讲完了, 他只是控制了"被使用的才导出", 所以有了这个名字.

但`sub`方法还是被打包了. 因为webpack不能确定`sub`方法是不是有副作用.

 (我认为以后可能会直接把`sub`去掉, 现在是terser去的, 而terser获得的信息是比webpack少的, 所以webpack理论是可以去掉他的)

### sideEffects

开启了这个配置(或是在package.json开启, 或是rules中开启), 没有被使用的module会被从依赖树中去除.

在我的demo中, `fnWillNotBeUsed`没有被使用, 所以`shouldbeshaked`整个module都被去除了.

这个配置也讲完了, 要注意的是, sideEffects是针对整个module的, 所以上面的`sub`方法是无法用这个配置去除的.

### innerGraph

开启这个配置, 并在方法执行前写pure注释, 打包结果会产生`unused pure expression or super`的标记, 来表示这个方法没被用到.

这里要强调2点:

1. 即使使用了innerGraph, demo中的`sub`方法仍被打包了.
2. 需要开启usedExports, innerGraph分析的时候才知道`sub`没有被使用.

所以粗略看来, 这个配置在我们的场景上是没用的.

### concatenateModules

开启了这个配置后, 每个chunk的可合并module, 会被合并成一个module. 也就是大名鼎鼎的scope hoisting. 具体行为比较复杂, 自行看文档, [作者说了动机和难点](https://medium.com/webpack/webpack-freelancing-log-book-week-5-7-4764be3266f5), 我稍微做一下总结.

优点: 减少函数和闭包, 减少代码体积. (关于webpack打包结果分析之前的post也有)

缺点: 打包变慢.

难点: 算法. 因为合module的时候可能有相同变量名. (但具体算法我看不动后面部分也不会介绍.)

然后他的先后顺序是在分chunk之后的, 所以是对每个chunk做scope hoisting. (这个后面部分会分析)

在我demo开启配置后, `webpack_modules`变量直接没了, 因为每个module都没有被bailout. (这个概念看文档)

补充一下, 开启这个配置后, usedExports的效果也达成了. sideEffects的效果也可以配合terser达成. (但不是说其他2个配置没意义, 只是在大部分情况下. 在module被bailout的时候效果是不同的)

### minimize

开启这个配置后, 会开启terser的plugin. terser很强大, 但不在我分析范围中. 除了压缩代码, 我的demo中他明显还做了2件事:

1. 去除没用的函数`sub`.
2. 直接执行了`add`方法, 把打包结果变成`console.log(3)`. 之前我一直以为是scope hoisting做的, 其实是terser做的.

另外, 他也会读取pure注释来辅助判断函数的副作用.

### 联合使用效果总结

+ usedExports + minimize 可以去除单个文件中没被使用的函数.
+ scope hoisting在没有bailout的情况下是功能覆盖usedExports的.
+ scope hoisting + minize 可以覆盖 sideEffects. (情况同上)
+ usedExports  可以去掉 scope hoisting 的声明esm的部分. (原因我不懂)
+ 在我的例子中, 开启usedExports + scope hoisting + minimize等于mode:production.

### 关于sideEffects

sideEffects比较搞人, 这里说几个点.

+ webpack的sideEffect和fp的sideEffect定义相同但标准不同.
+ webpack.config中的sideEffect: true表示开启, package.json中false表示没有副作用.
+ webpack sideEffects的作用范围是module. (文件内要用innerGraph, 但并不好用)
+ pure标签是给innerGraph或terser用的. 和 webpack sideEffects 并没有关系.

## 各个步骤在webpack的哪些流程中

下面深入一些的部分需要一些前置知识, 可以翻看webpack系列的前几篇post.

**每个配置在不同的hook阶段执行的, 在说完所有配置的流程后, 会在后面总结所有涉及到的hook的时间线.**

### useExports流程

`ModuleGraph`中有个属性`exports`, 是一个`ExportsInfo`实例. 

`ExportsInfo`实例的属性中保存了`ModuleGraph`中的exports信息.

`ExportsInfo`提供了一些api, 所以就不深入内部属性了.

简单的说配置开启后的流程:

1. 在optimizeDependencies阶段, 遍历所有module, 把使用到的export记录下来.  (使用api: `exportInfo.setUsedConditionally()`)
2. 在codegen阶段, 读取export信息, 只生成被使用过的export. (使用api: `moduleGraph.getExportsInfo(module).getUsedName(dep.name, runtime)`)

我还稍微看了下详细的流程, 如下:

1. 配置开启后, 加载插件`lib/FlagDependencyUsagePlugin.js`, 在`optimizeDependencies`hook进行后面的分析.

2. 建立一个队列`queue`. 从入口`compilation.entries`读取依赖, 并加入队列`queue`.

   (代码解释: `processEntryDependency()`调用`processReferencedModule()`的时候会传入一个空的usedExports, 所以就等于直接把当前module推入`queue`)

3. 开始遍历`queue`, 调用`processModule()`来处理每个module.

4. 遍历module的dependencies. 通过`getDependencyReferencedExports()`调用dependencies的`getReferencedExports()`方法来获取使用过的export. 

   (不是每个dependency都会输出, 在我的例子中, 是harmonyImportSpecifierDependency输出的usedExports的)

5. 再遍历每个module(代码里是通过`map`), 并遍历上一步获得的usedExports.

   获取到moduleGraph中, 当前module的`exportInfo`, 调用`exportInfo.setUsedConditionally()`来标记"使用过"状态.

   (如果usedExports为空, 也就不会标记了)

6. 找到需要继续遍历的module, 并加入`queue`, 开始重复步骤3~步骤6. 

   (到这里, 标记部分结束)

7. 经过了很多步骤, 到了codegen阶段, 调用了`lib/JavascriptGenerator.js`的`generate()`方法.

8. 调用`sourceModule()`, 遍历dependencies, 调用`sourceDependency()`. 

9. 然后调用`template.apply()`. 与步骤4一样, 在harmonyExportSpecifierDependency的template的`apply()`方法中调用了`moduleGraph.getExportsInfo(module).getUsedName(dep.name, runtime)`, 获得了"是否被使用"的信息, 判断被使用, 才推入`initFragments`数组.

10. 在`InitFragment.addToSource()`中, 遍历`initFragments`来产生export的代码. 

    (因为在步骤9中只有`add()`被推入数组, 没有`sub()`, 所以最后codegen的结果就没有`sub()`了)

### sideEffects流程

插件在`lib/optimize/SideEffectsFlagPlugins.js`. 步骤有2个.

首先在`normalModuleFactory.hooks.module`这个hook通过package.json或者配置来判断是否被手动设置sideEffect, 如果是的话, 修改变量`module.factoryMeta.sideEffectFree`, 以便下个步骤读取. (这个hook的执行在新建normalModuleFactory实例之后)

另外, `_analyseSource`这个参数默认是true, 所以会通过parse阶段的hook来判断sideEffect, 并且写入modulegraph的跳过optimize原因中来阻止当前module进行optimize.

第二个步骤在`optimizeDependencies`阶段:

遍历modules, 通过读取前一个步骤打的标记, 来决定跳过有sideEffect的module.

然后读取moduleGraph指定的dependency(`HarmonyImportSpecifierDependency`)来对moduleGraph里module的连接做对应的改动. (把判断不需要的module切除)

这个改动会最后在`buildChunkGraph`的时候被写入chunkGraph的cgc的modules里. (cgc指chunkgraphchunk, cg的一个属性).

最后在`createChunkAssets()`的时候, 在javascriptmodulesplugin的renderManifest里通过`chunkGraph.getOrderedChunkModulesIterableBySourceType`获取到cgc里的modules, 产生最后输出. (详见上篇post)

### innerGraph流程

插件在`lib/optimize/InnerGraphPlugin.js`, 在配置开启时加载.

这个插件的实现有三个点:

1. 在`compilation`注册`PureExpressionDependency`的template.
2. 在javascript parse阶段遍历ast的时候分析语法, 并为合适的module增加`PureExpressionDependency`.
3. 在codegen阶段, 通过sourceModule, sourceDependency, 调用`template.apply()`, 为codegen结果增加标记.

dependency和codegen的关系可以去前面的post细看, 这里稍微展开下步骤2.

innergraph维护了2个变量来保存innergraph的状态: `parserStateMap`, `topLevelSymbolTag`.

一个是关于state和(innergraph map, 当前symbol, callback map)的map. 另一个是用来更新当前symbol的临时变量.

然后说几个innergraph的关键api:

+ enable/bailout/isEnabled: 因为一些别的插件也会调用innergraph的方法, 以此来拦截本配置未开启的情况下, 别的插件的调用.
+ onUsage: 在插件中调用这个方法, 把 "为module添加PureExpressionDependency" 添加到`parserStateMap`的callback map中.
+ inferDependencyUsage: 调用callback, 为合适的module添加`PureExpressionDependency`.

所以innergraph插件在步骤2的展开流程是:

1. 在js parse开始遍历时候调用enable.
2. 在parse的各个hook, 调用innergraph的一些api来保存信息. 其他插件也可以调用.
3. 在parse的各个hook, 在合适的时候调用onUsage注册需要添加`PureExpressionDependency`的module.
4. 在parse结束的时候调用`inferDependencyUsage`落地callback.

### concatenateModules流程

插件`lib/ModuleConcatenationPlugin.js`在`optimizeChunkModules`hook进行了主要的流程:

1. 遍历modules, 这次遍历的目的是判断哪些module可以被合并, 并判断哪些是module可能是入口, 哪些是被合并的.

   不能被合并的都会设置bailout原因, 便于后面的打印. 原因可以去文档上看.

   这次遍历会填充一个数组`relevantModules`和一个set`possibleInners`, 分别是"合并后的入口"和"被合并的"module.

2. 遍历`relevantModules`(入口, 代码里叫root), 经过一些算法, 使用`ConcatConfiguration`实例(合并配置)填充了`concatConfigurations`数组.

3. 遍历`concatConfigurations`数组, 并使用配置实例化`ConcatenatedModule`.

4. `newModule.build()`. 这里concatenatedModule的build没有运行loader, 也没有更新`_source`, 当然也不需要parse, 只是更新了`buildInfo`. (这些是我之前分析module.build的作用, 看来build只要与codegen配合就可以了)

5. 在`integrate()`方法里, 调用api, 把`compilation.modules`, `ChunkGraph`, `ModuleGraph`中老的module删掉, 替换成新生成的module. (删除的比新增的多, 因为是多合一)

总结是在`optimizeChunkModules`这个hook分析了modules, 新建了concatenatedModule来替代原来的module.

所以在后面codegen的阶段, 也会调用concatenatedModule的generate方法.

具体的数据结构和算法我还没能力看, 可能以后再单独深入一篇.

### terser插件流程

在开启minimize配置, 并没有指定minimizer的时候, webpack就会开启`terser-webpack-plugin`插件.

插件注册的hook是`processAssets`. 我们关心的流程很简单:

1. 从hook拿到assets.
2. 根据配置过滤需要被压缩的assets. 并遍历他们.
3. 调用`getWorker().transform(getSerializeJavascript()(options))`来获取压缩结果.
4. 调用`compilation.updateAsset(name, source, newInfo)`来更新assets.

所以terser一次处理的内容是一个assets. 也就是一个chunk, 一个最终会被输出的文件.

### 流程先后串起来

这是最后一个部分, 把前面说的流程穿起来.

这里只会整理本文提到的流程, 完整流程还是要看之前的post.

#### (make) module creation

sideEffect: normalModule被实例化后调用, 在`normalModuleFactory.hooks.module`hook, 读取package.json和webpack配置, 来给module标记是否含有sideEffect. (`module.factoryMeta.sideEffectFree`)

#### (make) javascript parse

(运行完loader后进行的parse, 只有js的module才会运行javascript的parse)

innerGraph: parse阶段分析语法, 并在parse完为命中的module增加dependency: `PureExpressionDependency`, 给codegen用.

sideEffect: parse阶段分析语法, 尝试调用`isPure`hook, 如果命中, 就给modulegraph标记bailout原因.

#### (seal) optimizeDependencies

usedExports: 分析modules, 通过`exportInfo.setUsedConditionally()`记录module的exports是否被别的module使用.

sideEffect: 分析modules, 并根据exportInfo来修改moduleGraph中module的连接关系.

#### (seal) afterOptimizeChunkModules

在这个hook, usedExport已经分析完毕, 在这里操作module的exportInfo可以自定义哪些函数不被usedExports过滤掉, 方法可以是调用`exportsInfo.setUsedInUnknownWay()`.

#### (seal) optimizeChunks

在这个hook, chunk已经在之前的`buildChunkGraph()`生成完了, 所以在这里可以调用chunk的api来修改最终结果的分包.

#### (seal) optimizeChunkModules

concatenateModules: 在这里, 每个chunk的modules会被分析, 可优化的modules会合并成一个module, 并执行concatenateModule的build方法.

需要注意的是, 手动分chunk推荐`optimizeChunks`进行, 在如果concatenate配置开启了, 在这个hook之后module已经被合并了.

#### (seal) codegen

concatenateModules: 执行自己的codegen, 配合自己的build. 和javascript的内部数据不太一样.

usedExports: 在`harmonyExportSpecifierDependency`的template.apply中根据之前的标记, 跳过未使用的export, 生成module的代码.

innerGraph: 在`innergraph的pureExpressionDependency`的template.apply中根据之前的标记, 给代码加上一点注释.

(当然, 这些dependency是在compilation的hook里被plugin加入的. 关于codegen和dependency的东西也请看前面的post.)

#### (seal) createChunkAssets

sideEffect: 在javascriptModulePlugin中, 通过读取前面几个步骤整理到chunkGraph的chunkgraphchunk.modules, 产生最后的代码.

#### (seal) processAssets

terser: 这里已经是可以最终输出的代码, terser拿到代码进行压缩, 并调用updateAsset来替换asset.
