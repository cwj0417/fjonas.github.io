---
title: monorepo的子模块依赖声明的问题
categories: 工作笔记
date: 2023-05-13 02:15:34
tags: [monorepo]
---
因为对npm和monorepo不熟悉导致工作上发生了问题, 简单分析下原因.

<!--more-->

## 子模块依赖不声明产生的问题

工作里用了lerna+yarnws的monorepo. 

因为每个子模块都会依赖`react-redux`, 所以只在外层`package.json`声明了`react-redux`的依赖, 没有在子模块的`package.json`里声明依赖.

一个迭代在某个子模块中安装了一个新的依赖模块, 这个模块依赖了`react-redux`的老版本. 在进行了install后, 子模块的node_modules里安装上了`react-redux`的老版本, 于是子模块的代码中引入`react-redux`就获取到了老版本.

问题已经描述完了, 看起来很简单, 但因为是倒推的, debug的过程会复杂一点. 正向流程的表现是: 安装了一个组件后, 原先页面的很多功能点击后白屏了.

现在知道原因很简单了, 在取ref的时候使用了`react-redux`的`forwardRef`配置, 这个配置在7以上版本才有.

## 结论

结论一句话, 即使在monorepo里的子模块, 自己需要什么依赖, 还是要在自己的`package.json`里声明好. 

node的resolve机制很简单, 从最近的node_modules是开始, 不断往上找. 所以即使不在`package.json`里声明依赖, 在一些情况里项目还是可以运行的, 但需要使用的人清楚自己在做什么, 不然是会有风险的.

最后再说说yarn和pnpm在install的时候的一些区别.

+ 所有子模块同时安装一个模块: yarn会安装在外层node_modules, pnpm声明哪就安装哪.
+ 有一个依赖模块依赖同级依赖的不同版本: yarn会在依赖模块的node_modules里安装不同版本, pnpm会无视不同版本, 并安装声明在模块`package.json`中的版本.
