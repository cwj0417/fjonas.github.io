---
title: 浅析immer
date: 2020-09-16 01:00:10
categories: 工作笔记
tags: [immer]
---
immer是对js对象immutable的一种解决方案, 从rtk接触到的. 因为api非常简单, 所以来看一下是如何实现的.

因为对object内存分配, immutablejs都没深入看, 所以无从比较.

<!--more-->

## 背景和目标

首先immer是一个看起来很帅的lib, 先硬解释一下为什么要使用他:

+ immutable的必要性是增加程序的可控性, 避免出现debug难度高的bug.
+ 从api的设计和性能来说, 都比较优秀.

api的设计来说: 比较容易继承到别的lib里(指redux, [狗头]), 并且非常优雅, 进行一些封装(指rtk)后可以无感使用.

从性能来说: 在对象层次比较深的时候, 是比深拷贝和`JSON.parse(JSON.stringify(xxx))`性能好的, 越复杂越好.

从兼容性来说: 一个lib是会比`JSON`兼容性好的, 现在我看的版本7.xbeta是已经支持map, set的.

于是来说一下这次`浅析`的目标: 模拟部分(核心)功能, 目标是:

```js
const origin = {propA: 1, propB: { propC: 'deep' }}
const target = produce(origin, draft => {
  draft.propB.propC = 'mutated'
})
```

实现一个produce传2个参数, 实现plain object, 给一个比较深的属性赋值, 的immutable对象的产生.

## 准备思路

// 说下思路, 顺便解释为什么性能好, '懒处理'

## 编写一个produce

### api结构

### 产生一个proxy

### 整理返回值

## 尝试写一个自动产生不存在属性的proxy