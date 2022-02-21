---
title: vue和react的简单比较
categories: 工作笔记
date: 2022-02-18 15:00:19
tags: [vue,react,vue源码]
---
因为看了尤老板带着写vue的视频, 之前也看过didact. 那么这次自己试着把[简单版vue](https://github.com/cwj0417/sxdm/tree/main/vue3simplepoc)和[简单版react](https://github.com/cwj0417/sxdm/tree/main/reactsimplepoc)敲了一下, 来简单总结一下感受.

<!--more-->

## 主流程

这2个视频说的都是react/vue的最简流程, 所以其实不必要区分哪个版本, 甚至vue的大版本2和3都是这个思路. react暂时只实现了fc, 基于fiber.

我为了更有手写的感觉, 脱离工具, **没有使用编译器, 所以2个框架都是直接写render function的**.

### vue

1. 使用一个watch effect来启动应用. (vue的响应系统在之前的文章有详细讲解)
2. effect的内容是: 执行`render function`获得vnode, 将新老vnode进行patch, 保存老vnode.
3. 第一次执行没有老vnode时, 遍历vnode贴到真实dom上.
4. 后续执行有新老vnode时, 把新老vnode进行diff, 尽量作出最小的dom操作来更新dom.
5. 触发后续执行effect的点是render function中响应式数据的更新.

### react

1. 使用一个scheduler来启动应用. 启动后会循环执行至没有wipFiber. (我这里暂用requestIdleCallback无限循环了)
2. 启动的方式是给wipFiber和一些其他变量赋值. (wip = work in progress).

然后fiber的更新流程开始. 先简单说一下fiber是什么:

为了不打断用户操作, 希望不整个更新vdom, 一个个节点分开更新, 为遍历方便, 把vdom的树结构变成链表结构. 然后逐个更新, 所以**fiber就是多了链表指针的vnode节点**. 当然实际还多了一些属性, 比如真实dom, 这个在vue上是直接存在vnode里的, 还有fiber逐个更新需要的"更新方式"的字段.

每一次fiber更新分为2个大步骤:

1. 循环perform unit of work. 遍历fiber处理链表指针和产生dom.
2. commit work. 为了用户看到完整的界面, 在处理完所有fiber后再进行dom操作.

这里的perform unit of work做的事情为:

1. 根据type创建出真实dom, 并存在fiber的stateNode字段中.
2. 为子节点创建fiber, 确定更新类型, 并整理自己和子节点的指针. (reconcile children)
3. 找到下个待处理的fiber, 等待进入下次循环.

此时fiber都有了自己的真实dom, commitWork把dom贴到恰当的地方:

1. 从根fiber遍历, 把dom贴到自己的父级dom上. (不是每个fiber节点都有dom, 有些fiber节点是抽象的, 所以要递归查找父dom)
2. 递归遍历fiber的siblings和children.

## 框架特点思考

### fiber

fiber是react的大重写(据evanyou说写了3年), 我理解是降低性能来砍掉性能天花板, 建立fiber的处理本身是有消耗的, 每次更新还需要给fiber计算effectFlag.

### 响应式

相对于react的fiber, 说到vue就会想到响应式, 我理解是通过降低性能来免去setState的调用. 消耗在2点, 更新时要重新收集依赖, 依赖和effect占用的内存.

vue2的响应式每个响应的节点都有个闭包存着依赖数据, 用了proxy以后更原生, 性能应该会好些.

### 更新节点

框架最重要的性能就是更新时候的表现. 

经过调试, vue和react的更新节点都是组件.

react的setState, useState, hmr都调用了`scheduleUpdateOnFiber`方法, 在三个情况下, 这个方法的第一个参数`fiber`都接收到了被改动状态组件所在的fiber.

vue的自动更新是以effect为节点的, 而vue选择的effect粒度是: component. vue的组件数在运行时其实就是多个watch effect的嵌套, 如何做到子effect的更新不触发父effect, 也是响应式做的处理: activeEffect是个栈.

另外, 经简单测试, vue的hmr是会更新整个vdom的, 这个暂不深入探索了, 但这对dx还是有影响的, 可能需要一些配置.

### 编译优化

vue的编译优化其实是对标react的fiber的. vue在编译时加了静态标记, 和渲染器配合减少patch的复杂度. 要注意的是, 这个编译优化是在sfc的编译做的, render function有没有要看vue的更新, jsx有没有要看jsx插件的更新. 所以vue的主推开发方式还是sfc, 虽然可以用jsx写.

为什么react不做? 21年react conf里hux说在做编译时给react自动加useMemo, useCallback的工具. 可能和框架设计理念有关.

vue为什么不写fiber? 我认为最大的原因还是实现时间, 第二才是fiber带来的性能消耗, vue认为只要足够快就不需要fiber.
