---
title: vite-plugin-inspect工作流程
categories: 工作笔记
date: 2022-08-17 17:19:26
tags: [vite, vite-plugin]
---
在vite的plugin开发中或看使用的plugin行为时, vite-plugin-inspect非常有用, 于是简单看一下这个plugin的工作流程.

<!--more-->

 ## 简介

在vite配置中引入这个插件, 启动dev后命令行会多打印一个url, 点开可以看到一个页面.

页面的内容是一个当前应用所有module的列表, 点击列表会弹出一个新列表, 内容是当前module被哪些plugin处理过, 点击plugin还能看到这个plugin对module处理前后的diff.

所以明显地, 这个插件分为2个部分: 插件部分, 网页部分.

对应的代码在`src/node`和`src/client`下, node部分是个普通ts, client部分是个普通vue网页.

所以node部分用unbuild打包, client部分用vite打包.

## 主要工作流程

1. 使用者在vite配置引入插件. 插件只使用了2个hook: `configResolved`, `configureServer`.
2. `configResolved`这个hook可以拿到应用最终的vite配置.
3. `configResolved`阶段: 建立一个公共变量`config`来保存获取到的vite配置, 便于需要时读取.
4. `configResolved`阶段: 建立一个公共变量`transformMap`. 遍历vite配置中的plugin, 并把每个plugin的信息(plugin名字, 输出结果)存到变量中.

到了这个阶段, 这个插件所需要的数据都已经准备好了.

并且从这个插件的公共变量闭包看, 所有module运行的是同一个plugin实例, 这样所有module信息才会被收集到一起.

5. `configureServer`这个hook在建立server的时候被调用, 有一个入参是vite-server.
6. `configureServer`阶段: 让vite-server增加`__inspect`路由, 指向打好包的client网页. 这个就是我们使用的时候看到的网页.
7. `configureServer`阶段: 通过vite-server暴露的ws实例, 提供接口给client调用获取数据. 数据内容都来自于在上个阶段收集的`transformMap`.
8. `configureServer`阶段: 把client网页的url打印到控制台提示用户使用.

到这个阶段, 插件做的事已经完成了. 与普通网页不同, client端是通过ws获取数据的.

看到这里, 这个插件的工作流程已经很清晰了, 下面再深入看一些细节.(optional read)

## rpc细节

client端的rpc是通过ws的, 那么我们就要明确ws的server和client分别是哪里建立的.

代码里`createRPCServer`传入的参数是`configureServer`hook暴露出来的vite-server里的ws实例.

`createRPCClient`传入的是`vite-hot-client`.

我对vite的原理一点不了解, 所以直接去查看了浏览器请求. 在dev页面和inspect页面都请求了`/@vite/client`, 点开这个请求看返回值, 可以明确ws的客户端是在这里建立的.

总结: **这个插件的rpc通信是直接使用了vite的ws连接.** vite可能拿他来做hmr和一些其他事的, 也暴露出来让plugin开发者做更多的事情.

client端调用rpc的方法是直接调用`createBirpc`的返回值, 返回值是一个proxy对象, 被调用方法以后会去和ws的server端通信, server端就执行对应的方法然后通过ws推给他.

