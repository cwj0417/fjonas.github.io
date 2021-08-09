---
title: 在electron中使用前端框架
date: 2021-08-04 16:08:59
categories: 工作笔记
tags: [electron]
---
electron无疑是个很强的东西, vscode近年非常流行, 其他还有github客户端, twitch, figma等大公司有electron开发的软件.

但electron在前端开发中仍算冷门. 不分析原因, 但导致的结果是没有很稳定的脚手架.

目前官方只有一个react的模板, 剩下只有awesome-electron里民间的几个模板.

面对纷繁多样的需求, 这几个模板肯定是不够的, 而electron的流程又很简单. 所以这里总结一个大方向.

<!--more-->

(接触electron已有一段时间, 感慨自己上个electron项目竟然已经4年多, 那是electron版本还是1, 现在已经13.1.7了).

## 简介

electron的进程模型像是chrome浏览器: 浏览网站在tab中进行, chrome有一个主进程管理着所有tab.

electron分为**主进程**和**渲染进程**.

可以理解为:

1. electron应用的打开, 是起了一个node服务.
2. 这个node服务拥有很多api, 掌控着应用的各个活动.
3. 用户看到的界面是一个或多个网页. 主进程的api可以打开或关闭他.

现在主流的web开发会用一些前端框架, 也会用一些ts.

而electron还没支持直接启动ts文件, 也不会在启动electron的时候去做前端框架的开发流程. 所以这里需要自己简单地组装一下.

本文主要介绍思路, 也会提到一点实践, 在这个[仓库](https://github.com/cwj0417/schedule-pro)里.

## 主进程

electron天然是不支持启动ts的, 文档里说得也不明确, 但在官方模板里有用`electron -e ./babelconfig ./src/main.ts`来启动ts文件的语法.

但出于需要满足更多需求和灵活性, 还是自己来编译ts. 我们要做的是:

1. 开发阶段: 编译并监听`main.ts`的变化, 编译成功后重启electron. (electron没有热重载)
2. 打包阶段: 把ts编译成js到指定的目录.

因为electron启动文件的特殊性, 过程中是有2点要特殊处理的:

1. 窗口加载内容的地址: 在开发时, 地址会是localhost, 而打包时要取包内资源地址.
2. preload的加载: preload的加载语法上是一个地址, preload也用ts写的话就不是自然加载的.

## preload

preload是electron新版本的特性, 目的是提高electron应用的安全性. 在渲染进程里需要调用nodeapi时, 老版本可以直接通过`electron.remote`操作nodeapi. 

preload可以理解为node端供前端调用的api, 方式是通过`electron.contextBridge.exposeInMainWorld`方法暴露全局变量.

对于preload的编译, 除了ts到js, 还多了如何加载到主进程入口的问题. 我这里使用了esbuild的不同的loader来处理开发时和打包时的行为.

## 渲染进程

渲染进程就是我们最熟悉的网页. 

应用里不同的页面可以加载不同的网页. 所以理论上我们是可以不同网页使用不同框架的.

但出于开发方便考虑, 不同网页我选择了用不同路由来开发.

不管使用vue还是react, 下面就是我们最熟悉的开发流程. dev起localhost的指定端口, build抛出dist的js, css等文件. 在electron的开发中也是如此, 我们要做的就是: 

1. 开发阶段: 起了dev服务以后, 让主进程指定窗口地址的时候指向localhost.
2. 打包阶段: 让主进程指定窗口地址的时候指向打包后的html/js/css资源.

下一节来说说组装的主要流程和需要解决的问题.

## 组装成型

首先定一个基调, 因为需要一些进阶的操作, 在脚本里一定选用nodeapi, cliapi操作起来会比较麻烦. 把刚才说的思路连贯起来, 整个流程就明确了:

### 开发时

参考代码[在这里](https://github.com/cwj0417/schedule-pro/blob/main/scripts/run-dev.js).

1. 探测空闲端口, 起渲染进程的dev服务器.
2. 用watch模式编译主进程脚本, 监听输出并打印.
3. 检测主进程和preload变化, 在编译成功后重启electron进程.
4. 编译主进程时用插件拦截渲染进程的引入, 并把地址指向localhost的指定端口.
5. 编译主进程时用插件拦截preload的引入, 把引入方式改成文件, 并编译ts作为文件内容.

### 打包时

参考代码[在这里](https://github.com/cwj0417/schedule-pro/blob/main/scripts/run-build.js).

1. 打包渲染进程的页面.
2. 打包主进程脚本.
3. 编译主进程时用插件拦截渲染进程的引入, 并把地址指向打完包后的资源地址.
4. 编译主进程时用插件拦截preload的引入, 手动编译ts并写到文件夹中, 再让引导主进程加载文件.
5. 复制package.json.
6. electron打包.

## 遗留的问题

这样下来, 整个流程就都通了, 但是离完整流程明显还差一些东西, 之后再完善.

1. 判断dev环境来进行不同的操作, 比如打开调试工具.
2. 完善调试工具和日志.
3. 编写ts定义, preload和renderer的引入都是自定义, 目前ts划红线.