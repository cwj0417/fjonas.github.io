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
4. 如果需要移动节点, 则移动节点.

具体方法:
1. 遍历新数组, 创建一个新数组的key-value的map`keyToNewIndexMap`.
2. 创建一个数组`newIndexToOldIndexMap`, 长度为新数组的长度, 内容是"新元素在老数组里是第几个", 初始值为0. 代表"新元素在老数组里不存在"
3. 遍历老数组, 利用第一步创建的`keyToNewIndexMap`寻找每个老元素是否有对应的新数组.
4. 如果老元素在新数组中存在, patch这个元素的attributes, 并更新第二步创建的`newIndexToOldIndexMap`.
5. 如果老元素在新数组中不存在, 则卸载当前老元素.
6. 建立一个变量来计数被patch的数量, 如果新元素已经都被patch, 就卸载当前老元素.(这个算算法优化)
7. 建立一个变量`moved`, 初始值为false, 如果每次从`keyToNewIndexMap`取出的不是递增, 就将`moved`设为true, 后续根据`moved`来判断是否移动节点.
8. 至此, 老元素的卸载已完成, 并且我们获得了每个新元素对应了哪个老元素的信息`newIndexToOldIndexMap`.
9. 从`newIndexToOldIndexMap`里获取一个最长递增子序列. 意义是: 新数组和最长递增子序列重合的部分是不需要移动的. (lss: longest stable subsequence)
10. 反向遍历新数组. 同时增加一根lss的指针, 一起遍历.
11. 如果新元素符合lss, 则不动. 并向上移动lss的指针.
12. 如果新元素在`newIndexToOldIndexMap`里的索引是0, 则新增元素.
13. 如果都不是, 则将这个新元素移动到当前的指针位置.
