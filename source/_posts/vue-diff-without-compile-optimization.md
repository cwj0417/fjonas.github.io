---
title: vue3不经过编译优化的diff
categories: 工作笔记
date: 2022-04-25 00:40:19
tags: [vue,vue源码]
---
在看hcy的vue源码解析, 看完了渲染器部分, 简单总结下vue3的diff流程. (作为之后复习用, 并不作为学习.)

<!--more-->

## 背景介绍

vue的大致流程是: 把一些数据变成响应式, 在数据变化的时候去更新对应的视图.
视图是由vnode产生的, vue会保存一份vnode, 在之后更新时与新产生的vnode对比来尽量找到最小的变化, 并把这变化执行到真实dom上.

对比的过程大致是这样:
1. 对比type, type不同就直接unmount老的, mount新的.
2. type相同, 对attributes进行修改.
3. attributes种类繁多, 要对class, style, 事件做处理.
4. diff子节点. 子节点有2个类型, 字符串和数组.
5. 新老子节点非同一个类型, 就直接unmount老的, 遍历新的并mount.
6. 新老子节点都是数组, 才是本文的主题: diff.

因为书还没讲到compiler, 所以compiler做的优化这里还不包括, 可以认为这个diff流程是手写render function产生的vnode的diff.

另外, 这里考虑的是数组被key的情况, 如果数组没有被key, 不会有diff过程, 只是简单地将公共长度部分做patch, 如果新的数组长, 就mount, 如果旧的数组长, 就unmount.

下面进入主题: `patchKeyedChildren`

## diff流程

源码的注释写得非常体贴, 所以我就模仿源码中的注释来写例子.

### 去头去尾

(a b) i j k (c d)
(a b) x y z (c d)

找出头尾可以复用的dom, 只patch他们的attributes, 减少diff范围.

具体方法:
两次遍历. 分别用1跟指针和2跟指针(数组长度可能不同, 去尾的时候需要2跟指针)
循环判断指针节点是否可复用.
如果可以, patch他们的attributes, 并移动指针.
如果不可以复用. 停止指针.
最后得到3个指针. 来判断需要进一步diff的内容.

### 简单的情况: 纯新增或减少

(a b) c
(a b)

或

(a b)
(a b) c

需要diff的内容有一边是完全没有的情况, 只需要新增或卸载节点就可以了.

具体方法:
判断指针是否重合, 可以判断出是否有一边的数组被完全处理完了.
如果新数组的指针还为重合, 循环2个指针中间的索引, 逐个新增.
反之逐个卸载.

### 新老数组都还有长度

a b [c d e] f g
a b [e d c h] f g

面对这2个序列, 我们要做的事有3个:
1. 找出可以复用, 并不需要移动的元素, patch他们的attributes.
2. 移动可以复用但需要移动的元素, patch他们的attributes.
3. 新增或卸载节点.

具体方法:


