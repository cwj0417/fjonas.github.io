---
title: 深入查看webpack打包结果中的模块
categories: 工作笔记
date: 2022-07-28 10:48:35
tags: [webpack]
---
**经过webpack打包后, 项目中引入的依赖是存在在哪里, 不同chunk的依赖是如何加载的?**

本文通过查看打包结果, 了解了下webpack中的模块化, externals, code splitting, module federation的细节.

<!--more-->

## 项目被老板要求换方案

居家办公期间接到了个比较不常见的需求: 一个嵌入各个系统的widget, 这个页面的一个部分希望得到"云更新", 于是我把页面分成了2部分, 使用module federation来连接.

而在完成的时候, 发现使用部署在公司环境上的远程模块时, react hooks报错了, 只好用cc来重新fc.

经过排查, 发现即使module federation配置了共享模块, 远程模块依然把react, react-dom打入了包中.

领导提出了2个疑问: 

	1. module fedration为什么打了2份react.(主子应用都打包了一份)
	1. 2份react在用react hooks的时候报错的原理是什么.

我一个都没答上. 于是花了额外的功夫把项目重构成了基于iframe的远程模块.

所以打算解决这2个问题, 本文是问题之一: **webpack打包结果中, 我们引用的依赖具体在哪里?**

我用webpack(大版本是5)打包了写demo, 查看了打包结果. 接下来几个章节由最简单打包结果开始介绍.

## webpack打包结果结构

这里得简单说下webpack配置. 我们需要在配置里设置`mode: 'development'`以避免代码被压缩.

而设置了`mode`实际是对一系列配置的preset. 还要设置一下`devtool: false`来取消每个module的`eval`的调用, `eval`调用是为了调试的时候可以让每个module在单独的source里, 而对于我们直接查看代码并不友好. (这段指导是打包结果中提示的)

接下来看下打包结果, 是个iife, 所以第一个结论: **webpack的执行和依赖的引入都是在closure里进行的.**

```js
(() => {
  var __webpack_modules__ = {}
  var __webpack_module_cache__ = {}
  function __webpack_require__ (moduleId) {}
  (() => {})()
  var __webpack_exports__ = __webpack_require__("./src/index.js");
})()
```

这五个部分的作用分别是:

+ `__webpack_modules__`: 这里是所有代码存在的地方, 键是模块名字, 值是一个函数, 函数被注入了一些变量和方法, 函数体就是具体模块的代码, 和模块引入相关的import, require都会被替换成注入的方法, 以此来连接各个模块.
+ `__webpack_module_cache__`: 字面意思.
+ `__webpack_require__`: 尝试读取cache, 如果没有就新增, 然后去执行`__webpack_modules__`里对应的模块.
+ 其他的若干iife: 给`__webpack_require__`增加一些方法. 这些方法会根据需求打到包里, 不同场景含有的方法是不同的.
+ \_\_webpack_require\_\_("./src/index.js"): 入口, 执行的开始.

所以第二个结论也有了: **所有模块都存在__webpack_module_cache__里, 第一次会从__webpack_modules__中找到模块定义并执行获取模块**.

## externals

在默认情况下, 设置了externals后, `__webpack_modules__`里被external的内容会被直接引入(window), 如果设置了模式, 也只是包装简单的模块格式. 类似于: `module.exports = React`, `module.exports = require('React')`等. 如果在全局没有React变量, 或者是没有require方法, 就会报错, webpack没有对他做任何其他动作.

但主流的case是: 含有externals的包被其他的包引入, 而直接引用宿主包里的依赖.

在这个case里, 如果不设置打包输出format是umd的话, 宿主webpack不会做任何处理, 继而会包上面所说的错. 所以我们得把包输出format改为umd.

那么在umd输出的情况下, webpack做的事是:

+ 在被依赖的模块输出中: iife外面被包了一层iife, 注入了`factory`, 在被external的模块就会引入factory, 类似: `module.exports = __WEBPACK_EXTERNAL_MODULE_react`. 而factory的实现去尝试引入了amd, cjs等format.
+ 在宿主的`__webpack_modules__`中, factory实现的部分会被直接替换成`__webpack_require__("node_modules/react")`, 这样子模块就通过依赖注入使用了宿主应用的模块.

## chunk加载方式

在加载一些当前文件不存在模块时, webpack在调用`__webpack_require__`前还会调用`__webpack_require__.e`方法.

code splitting, module federation都是通过`__webpack_require__.e`来加载的. 接下来就来了解一下这个方法的主要流程.

### ensure chunk

`__webpack_require__.e`应该是ensure chunk的意思. 这个方法是个入口, 因为chunk的类型是多种的, 但目的是一致的: **调用`__webpack_require__.e`后, 保证__webpack_modules__中被新增了需要加载的模块**.

`__webpack_require__.e`的做法是: 写了几个不同类型的chunk加载方法, 并依次调用, 下面来介绍一下这几个方法.

### ensure function: jsonp

`__webpack_require__.f.j`这个方法调用了`__webpack_require__.l`加载chunk.

 `__webpack_require__.l`的行为也很简单: 创建一个src为url的script, 贴到dom上, 浏览器就加载了一段js.

接下来我们来看看被加载的chunk做了什么:

```js
self['webpackChunk'].push(["chunk_name_js"], {"chunk": (__unused_webpack_module, __webpack_exports__, __webpack_require__) => {
  ...
}})
```

`self['webpackChunk']`这个变量的push方法已经在初始化的时候被改写过了, 在调用push放的时候会执行`webpackJsonpCallback`.

`webpackJsonpCallback`拿到chunk的模块信息, 遍历并逐个加入自己closure内的`__webpack_modules__`.

至此, chunk文件的内容已经和入口文件合二为一了. 只需要正常`__webpack_require__`就可以了.

### ensure function: remote

module federation的远程模块并不会像code splitting一样与主入口共享一个closure, 而是拥有自己的closure, 自己的`__webpack_require_`, 模块, 缓存, 方法等.

所以就产生了包共享问题, 这使得mf的加载比code splitting加载复杂一些, 这里先说`__webpack_require__.f.remotes`.

`__webpack_require__.f.remotes`会先根据配置找到远程模块, 并和jsonp一样使用`__webpack_require__.l`加载他.

jsonp通过`self['webpackChunk']`这个全局变量与主应用进行交互,

而remote通过`remoteApp`与主应用进行交互. (remoteApp这个名字是在webpackconf里配置的)

加载远程模块后, 我们得到的内容是: 一个含有`init`方法和`get`方法的对象.

+ init: 与主模块共享scope.
+ get: 获取模块入口. (可能会先ensure一些chunk, 所以需要写这个get方法)

`__webpack_require__.f.remotes`获取到远程模块后, 会调用远程模块的init方法和get方法, 最后把get方法的调动结果放到`__webpack_modules__`里, 这样主应用已经可以require到他了!

(其实在此之前, init方法已经被调用过了, 所以这里会走缓存, 下面的部分会说到什么时候第一次调用init)

### ensure function: consume

所有被mf定义共享的模块都会走到这个ensure流程里. (我跑的例子是mf配置share module, singleton的)

`__webpack_require__.f.consumes`会建立一个主应用/远程模块的共享scope: `__webpack_require__.S`. (也有可能是share的缩写, 暂定他为scope)

然后主要做2件事:

1. 初始化/注册/共享.
2. 把`__webpack_modules__`对应的模块指向共享模块. (通过`loadSingletonVersionCheckFallback`)

所有的`loadSingletonVersionCheckFallback`的方法都会先调用初始化方法: `__webpack_require__.I`.(initialize sharing). 

并且主/子应用都会调用**各自**的`__webpack_require__.I`, 调用的流程为:

1. 主应用调用`register`, 把`__webpack_require__.S`的`react`指向到自己closure里的react模块. (react是举例模块)
2. 主应用调用`initExternal`. 读取远程模块, 并调用远程模块的`init`方法, 传入`__webpack_require__.S`.
3. 子应用调用`init`方法, 把主应用的`__webpack_require__.S`设置为自己的`__webpack_require__.S`, 实现共享.
4. 子应用调用`register`, 把`__webpack_require__.S`的react指向自己closure里的react模块.

主应用的`__webpack_require__.S`也会随着子应用的注册而变化, 所以主应用的react都会调用子应用打包的react了.

第二步很简单, 实例中就是使主/子应用在引入react的时候都去读共享scope里的实例.

## 总结

对上面分析和开始的问题做一些总结:

+ webpack的模块都在iife里, 每个模块也拥有自己的closure.
+ 被依赖的externals包需要打umd包, 在加载的时候通过di获取主应用的模块.
+ code splitting通过`window.webpackChunkName`共享, mf通过`window.remoteAppName`共享.
+ code splitting和主应用共享closure, mf的远程模块有独立closure和一切方法变量.
+ mf在共享模式下, 主/子应用打包结果都有被共享的模块, 但所有的引入都被指向子应用的模块.

## 聊聊看完后的感受

虽然东西不复杂, 但断断续续看了一个月才看完, 关于调试方面走了些弯路. 最后的部分想聊一下"调试的方法"和module federation.

### 如何调试代码/功能

在我看来有2个选择: 看代码和浏览器debug. 一开始选择了看代码, 折腾好久才决定用浏览器debug, 他们的优劣是:

|             | 优点                           | 缺点                                                         |
| ----------- | ------------------------------ | ------------------------------------------------------------ |
| 看代码      | 容易掌握所有函数和代码总体结构 | 对执行时变量难以把握                                         |
| 浏览器debug | 执行栈和作用域都很明确         | 需要编写demo, 调试时可能进入不想查看的方法调用中或重复的循环 |

所以如果只选择一种, 情况是:

+ 只看代码不调试: 对执行时状态只靠猜, 复杂的情况无法应对.
+ 直接调试: 顺着代码执行, 对全局情况没有概念, 跑完以后还是一头雾水.

所以我最后的经验是: 先看代码, 再写demo执行. 

再附加2个建议: 

+ 看代码的方式, 最好是带着问题, 从一个变量/方法入手, 观察这个变量的改变. (因为很复杂的东西并没必要细节很透彻)
+ 如果实在有困难, 不放弃, 多看几遍, 就会有感觉的.

### module federation的期待

这个项目确实是第一次接触module federation. 我之前给公司写了vite的脚手架, 而这次用了webpack5的功能, 本来都觉得vite没用了.

经过一些搜索, 原来module federation的作者在各个框架(angular, react, vue, svelete)和各个工具(webpack, vite, rollup)都写了例子. 甚至还有跨构建工具的例子.

所以我理解module federation只是一种方案或者协议. 不是新技术, 只是新应用.

而mf应该是一个底层方案, 基于mf可以建设公司的免更新组件库.

mfsu已经出来一年多了, 也是对mf的一个应用, 我觉得很奇妙.

关于mf的应用, 可能以后还会深入了解别人, 或者自己思考一些使用流程.
