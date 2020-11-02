---
title: webpack一些基本概念补课
date: 2020-10-22 14:48:34
categories: 工作笔记
tags: [webpack]
---
一直对webpack的一些功能概念比较模糊, 所以过一次文档的guide来看看这些功能: code spliting, tree shaking, hot module replacement, require.context.

<!--more-->

## code splitting和懒加载

### why

先理解下为什么要做[code splitting](https://webpack.js.org/guides/code-splitting/).(下文简称cs)

在不配置的情况下, 一个入口只会打出一个bundle文件. 一个普通的spa, 普遍就一个入口, 这个入口来引入整个app及css, 也就是**整个应用都在一个js文件里**, 加载的时候也会加载整个应用, 如果项目大, 白屏时间就长了.

那一般做cs通常的场景有:

+ 多个入口文件. 比如chrome插件就有多个独立页面.
+ 首屏不需要的组件, 或者通过点击才加载的组件, 分到不同的bundle里按需加载.
+ 不同的组件都需要的lib, 独立出来打包, 避免在各处引用的时候重复打包.

### how

那文档里说cs的方法有3个:

+ 手动设置多个入口.
+ 使用插件SplitChunksPlugin
+ 动态import.

下面简单介绍一下这三种情况.

手动设置多入口: 就是entry里多配一个键就多一个入口, 但可能存在一个情况: a文件依赖c, b文件也依赖c. 这样打包结果就是: 一个bundle含有`a+c`, 另一个bundle含有`b+c`, `c`被重复打了, 这种情况可以通过entry的一些简单配置来解决. (具体配置不说了).

插件: 第一种case可以直接用SplitChunksPlugin来解决, css可以用mini-css-extract-plugin来解决.

动态import: 通过`import().then`的语法, 把import理解成我们经常做的http请求就可以了. 这个功能可能是webpack先做的, 现在已经被列入了es规范, 在浏览器里也可以直接`import()`了.

动态import以后, webpack编译的结果是: 通过用户操作触发了`import()`函数以后, **通过`document.createElement('script');`来动态加载js的.** 并且直接使用了Promise, 所以低版本浏览器使用这个功能要自加shim. vue, react, angular的组件/路由懒加载, 都是通过webpack的这个功能实现的.

### 总结

+ code splitting的意义是一个入口不止打出一个bundle文件, 而是根据依赖树和业务合理地打出多个文件来提高用户体验. (为什么说合理地, 因为分成多个bundle是增加请求消耗的)
+ 常用的方法是: 使用webpack插件和使用vue/react/angular的懒加载插件.
+ 手动配多入口和手动动态import不常用, 是根据具体业务来的. (因为需要这样做的业务不常见)

## tree shaking

### why

tree shaking(下文简称ts)的故事是: 有用的代码就像树上绿色的叶子, 没用的像灰色的, 摇一下树, 就把灰色的叶子(没用的代码)去除出bundle了, 这个名词是rollup先发明的.

那么为什么会写没用的代码呢? 所以ts的基本场景是: 第三方lib提供了很多功能, 但是使用的时候未使用全部, 打包的时候不需要把未使用的功能都打进来.

### how

既然是**打包的时候**去除代码死区, 那么ts就是webpack完成的. 但因为webpack的功能还没有登峰造极, 所以**使用者也需要配合webpack, 才能让ts完成得更合理**.

在webpack现在(5.3.2)文档里, 提了3个必须条件:

+ 使用es module导出模块. (import 和 export)
+ 在`package.json`中添加`sideEffects`字段. 或者在代码里添加`/*#__PURE__*/`注释.
+ webpack配置`mode: 'production'`.

那么接下来的疑问就是: 为什么需要esm和设置标识, webpack才能进行treeshaking呢?

答: 因为esm是静态的, 所以只有esm是可分析的, 才能进行DCE(dead code elimination). 因为js语言的特性(如object引用地址, prototype引起的sideeffect), 一些地方还无法确定是可以判定成死区的.

而ts的本质是优化, 所以不改变代码执行效果是根本原则. *虽然我们这些初级程序员经常把feature优化掉:(*

下面来说说相关的内容.

### amd? cmd? umd? cjs? esm? 动态? 静态?

众所周知, 以前js是没模块的, 不同lib之间要通过把变量挂在window上交互, 还涉及到加载顺序问题, 也就10年前的情况.

于是, 为了解决模块问题, 这些东西就出现了.

amd, cmd 是运行在浏览器上的.

cjs是运行在node.js上的.

umd是以上一切的结合, 方式是判断是否有一些关键字, 然后用对应的方法导出模块.

esm是es6的module规范, 特点是静态的, 但尴尬的是, 浏览器不支持, 还是需要编译成umd.

所以现在的lib库一般打包出三个版本: umd (for 浏览器), cjs(for node.js, 但如果是web库目标还是编译成umd), esm(让认识esm的编译工具使用).

终于回到了正题: 为啥只有esm可以进行tree shaking?  答: 因为esm是静态的.

什么是静态? 在编译的时候, 已经加载完了需要的依赖. 动态是运行的时候还可以加载依赖.

esm是静态的, 在进行编译的时候, 这个项目的依赖树已经确定了. 编译器就可以把代码整理成ast进行分析了.

(为啥esm是静态的, 因为es6规范规定他是静态的, 就是想到了会有这些好处, 所以import必须全部写在代码之前)

### side effect?

大概在16年的时候当时同事都在说函数式编程(fp). 于是学了一波还翻译了一篇教程写在博客里.

tree shaking的side effect和fp的是不同的.

比如`function go(url) { location.href = url }`. 这个在fp里肯定是算side effect, 但是在做tree shaking的情况里, 不算side effect. 因为没有这个方法, 完全不会影响其他函数.

另外, 对于各种编程范式来说, 面向过程的(imperative program), 面向对象的(object oriented program), 还是函数式(functional program). 甚至代码是否要简洁. 他们的根本都是为了好维护, 易debug, 脱离实际, 硬追求一个范式都是幼稚的行为, 不知道自己目的是什么的行为而已.

### 总结和展望

tree shaking本质是编译软件做的事, webpack5的更新日志也表示已经能自动分析更多的"side effect"而不需要自己配置了.

上一小节的总结, side effect的case其实不多, 大部分场景就是polyfill, 如果穷举场景, 编译器是可以做得更多的. 并且就算是代码要做处理, 也是第三方库作者要了解的东西. 所以对业务编码者的影响几乎是没有.

也希望编译器会越来越强, 或者ts这样的结构化系统推行得更好, 让tree shaking也零配置, 无感知.

## hmr

hmr是webpack可以探测文件改变, 不刷新页面更新部分页面. 

好处是可以保留页面状态, 和快.

因为上一份工作用vue, 一直以为hmr是自动的, 写了一年react项目, 每次保存后都会刷新页面, 也一直没仔细思考. 于是看了下hmr文档.

大概流程是:

+ webpack的dev-server起一个http服务, 并把编译结果放在内存里吐给页面.
+ 页面与服务端建立websocket准备通信.
+ 服务端监听文件改变, 把改变通过ws告诉页面.
+ 页面接到信息, 执行预制的行为.

那页面接到信息, 执行啥行为呢? 是需要去写的.

那为什么vue和css会自动hmr呢? 因为`style-loader`和`vue-loader`里集成了hmr的api. 而react有第三方插件, 使用了就可以成功hmr了.

另外, hmr是根据`module`来的, 如果一个module没有编写指定的行为, hmr引擎就会向他的父级module找, 直至顶层, 如果都没有, 就刷新页面了.

所以: hmr是需要写代码的, 写得越多, 越细节, 热加载效果就越好(到最小的module). 写得越少, 越靠近根组件, 热加载效果越差, 所需时间也越少.

## require.context

批量引入功能, 第一次看到是几年前的electron-vue的脚手架里, 当时没在意, 以为是node语法.

这个功能常用语中心化的状态管理系统, vuex和redux, 一般项目都会有个文件, 引入类似文件结构的文件, 然后一起输出, 如果使用了`require.context`, 就可以避免"新增一个模块, 要去这个文件里复制粘贴修改"的问题.

当然缺点是, 这个项目只能用webpack了. 但这个缺点几乎不存在, 因为其实打包工具和项目是整体, 迁移成本极大的.

## build性能

build性能其实和tree shaking非常相像, 因为核心思想都是: **使开发和打包更合理.**

开发的时候要debug方便, 修改以后反应快.

打包的时候要包小.

所以其实都可以猜出要做几点:

+ 尽量使用新版本的webpack, 因为内部在优化, 更多的东西会更自动和快. 其实就是更好的算法.
+ 更合理的在不同情况(dev和prod)下加载loader和插件.
+ 代码质量更好.
+ 其他零零碎碎插件的具体用法.

## 后续

这次对webpack浏览非常浅. 下次尝试深入: loader和plugin, webpack打包后各个module在浏览器里是大致如何通信的.