---
title: react-refresh介绍
categories: 工作笔记
date: 2022-01-29 15:08:15
tags: [react,webpack]
---
公司一个业务框架在修改代码后竟然没有自动更新页面. 于是想尝试解决这个问题, 还是失败了.

出现问题的框架使用的是react-refresh来进行hmr, 虽然失败但记录下过程.

<!--more-->

## react-refresh现状

hmr是hundler提供的一种功能, 是需要配合具体业务来实现的.

比如css通过css-loader, vue通过vue-loader. 而react没有官方支持, 社区有个react-hot-loader.

2年前react提供了官方hmr支持. 但是提供给rn的. 虽然react-refresh代码在react仓库里, 但react文档是搜不到ract-refresh的, rn文档里可以搜到.

react-refresh的react集成又是社区做的, 叫react-refresh-webpack-plugin.

umi的fast-refresh是用这个插件做的, vite的实现方法是基于那个`react-hot-loader退役issue`做的.

## react-refresh组成部分

### react-refresh/runtime

这部分代码在react包里, 所以react-refresh的最低react版本要求是要有这个文件.

除了runtime, react-dom里也新增了代码来配合runtime更新fiber. 这react内部的支持能比之前的react-hot-loader包一层组件更好地支持hmr.

### hmr机制

runtime提供了更新fiber的方法, 也必须触发点去调用他, 这就需要hmr机制了.

hmr机制流程是: watch文件改动 => 重新运行这个文件包含的module => 运行module中的更新逻辑.(runtime的代码应该在此执行).

 (这是最小实现流程, 全部机制还包含各种向下退级操作, 拒绝后寻找父模块更新逻辑)

### react-refresh/babel

下一个问题, runtime更新fiber, 需要知道哪个fiber改动过需要更新. 而代码是顺序执行的, runtime没法知道当前module执行的是哪个fiber.

解决思路: hmr时会重新执行module, 初始化会执行所有module. 那么最后特点是: 需要更新的module执行了2次, 其他的module执行一次.

所以需要在每个react组件声明完增加一个注册动作. 如果发现了重复注册, 就说明这个module是被hmr机制重新运行的, 就需要更新了, 于是把他推到`待更新节点`的队列里.

这需要把所有的react组件都增加注册的动作, 所以这个功能用babel插件来完成. (因为jsx也是依赖babel的, 所以用babel不会引入额外流程)

### 串起全流程的实现逻辑

以上说的内容, 都需要在编译时在代码里修改, 那么如果用webpack, 就是`react-refresh-webpack-plugin`这个插件做的, vite里是vite写的. 

这个实现逻辑是和hmr系统强相关的, 基本流程说明在`react-hot-loader退役issue`里写了.

当然我们只要直接用webpack或者vite的插件就行了.

## 与真实业务的关系

其实说完组成部分, react-refresh的流程也说完了. 下面总结一下, 再结合实际问题聊聊.

### 一般开启react-refresh方法

+ 遵循`react-refresh-webpack-plugin`文档, 三步走: 开启webpack hmr => babel配置新增react-refresh/babel => webpack-plugin新增react-refresh-webpack-plugin.
+ umi: 配置fast-refresh插件. (内置插件配置即可)
+ vite: 使用react插件, 天然开启.

### react-refresh执行角度全流程

1. 代码dev阶段经过编译, 所有react组件被增加了一系列hmr的逻辑.
2. 初次运行, 所有的react组件都被注册到了一张大表中.
3. 修改文件, 被监测到, hmr机制重新运行被改动的module.
4. 在重新运行时, 注册方法又被调用了一次, 于是更新过的组件, 被推到了`待更新队列`.
5. module最后被添加的代码会执行performRefresh尝试hmr.
6. `待更新队列`的组件会被分析, 需要热更新还是直接替换, 分别调用scheduleRefresh或者scheduleRoot方法.
7. 调用成功, 更新完成.
8. 失败流程还没看.

### 最初发生问题的场景: 为什么修改配置没有hmr

因为react-refresh是基于`组件文件`的hmr系统. 如果大组件内部是基于props在render时运行产生组件的话, hmr触发时会invalid并向上级组件抛出, 最后重新整个渲染大组件.

(在我遇到的业务场景中, 业务组件比较复杂, 出于性能考虑组织了props更改重新渲染)

## 后续

react源码相比vue遇到一个困难: 函数定义时很多是空, 不知道何时给函数赋值, 这个问题可以用浏览器下断点来解决.

可以看到类组件, 函数组件和hmr都是通过调用`scheduleUpdateOnFiber()`来进行更新视图的, 这个函数涉及到调用的fiber和一些全局变量, 打算之后再分析
