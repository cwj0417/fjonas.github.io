---
title: 测量webpack编译速度
categories: 工作笔记
date: 2023-12-14 14:16:52
tags: [webpack]
---
有多个同事反应公司打包脚本本地开发时非常慢, 我debug了一下确实找到了个之前没被发现的问题.

而**如何知道webpack编译过程卡在了哪里**就成了问题.

从webpack进度条看, 只能知道卡了, 而不知道哪个地方卡了, 所以也无从优化.

<!--more-->

## 使用[measure-webpack-plugin](https://www.npmjs.com/package/measure-webpack-plugin)

使用[measure-webpack-plugin](https://www.npmjs.com/package/measure-webpack-plugin)插件很容易, 可以不传任何参数, 调用方式也在插件首页介绍了.

无论在本地开发或是打包, 插件都会产生`/measureResult.html`文件, 访问他就可以看到编译速度统计.

使用插件后我发现了本地开发时`antd.less`因为webpack-chain的社区版本(支持webpack5)有bug, 导致修改参数的行为让less-loader加载了2次, 增加了40秒loader运行时间.

## 插件原理

从[插件源码](https://github.com/cwj0417/webpack-explorer/blob/main/measure-webpack-plugin/measure-webpack-plugin.js)中看, tap了以下hook, 并维护了变量来记录时间:

+ make.
+ seal.
+ beginIdle. 到这里, webpack的编译流程已经结束.

在都执行完后, 才会执行`processAssets`hook, 在这里输出内容.

另外, make流程中, 每个module也有自己的生命周期, 做了记录可以分析build里每个步骤占用的时间.

+ buildModule: 开始module的build.
+ beforeLoaders: 执行loader前, 这步离上一步的执行时间很短.
+ beforeParse: 执行完loader, 这步离上一步的时间差就是module运行loader的时间. 
+ beforeSnapshot: 执行完parse, parse是从ast里找出依赖的过程, 速度和module的复杂程度有关.
+ succeedModule: module的build完成.

## 开发中的难点

一开始是参考了webpack的progress插件, 比较简单, 具体的可以看我之前的文章.

而发现这些生命周期并不能满足我的需求. 于是自己探索了一些生命周期, 记录在[这个地址](https://github.com/cwj0417/webpack-explorer/blob/main/measure/webpack.config.js).

在测试过程中, 发现了很多生命周期之间的速度是很快的, 在大多模块都几乎是0, 所以就精简留了几个重要的.

而进入make环节, 就比较特殊, 很多操作是进入队列并行的.

尝试设置了`compiler.options.parallelism = 1`来控制队列长度. 但还存在问题:

+ 进入队列的生命周期还是无效的, 因为队列长度1也只能控制不并行, 入队时间还是会挤在一起.
+ 在分析依赖以后, 队列会被加长, 因为有队列嵌套, 所以必须加长才能继续执行.

顺便提一下, `parallelism`参数是可以通过webpack.config.js传入生效的, 只是文档里没写.

另外我发现, 在每个module的build流程之间, 会消耗很多时间, 经过2天努力也没找到发生在哪里, 那暂时就认为面对复杂的系统, 从ast里找出依赖会比较花时间.

