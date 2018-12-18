---
title: 如何写一个swiper
date: 2018-12-17 17:56:54
categories: 编码与分析
tags: [小程序,web,应用]
---
swiper是个常用组件, 但是在生态圈还不太完善的小程序中出现了比较特殊的需求的时候就产生了很大的问题. 出于无奈要自己写一个, 于是倒看到了另外一个世界.

<!--more-->

## 为什么要去造这个轮子

我们这个工龄的已经麻木的人为什么会想去造轮子, 当然造轮子是一种工作能力, 造轮子能获得加深职业槽的结果.

但很明显这不是我的出发点, 实在是对需求无解没有可用轮子, 所以要解释一下背景:

### 背景和目的

首先, 使用组件是一个通常的思路, 这也导致了我其实对实现细节深入不够. 小程序的生态非常新, 最近一个项目用mpvue, 虽然使用了强大的vue直接使用vue的ast, 但是很多lib都是强dom依赖的, 特别是某些组件, swiper就是其中一个. (notification和toast就更不用说了)

我本来有两个需求: 写swiper-cell, 和把一个swiper改写成无限滚动的.

### 如何把组件改到小程序上

普通的web组件不能使用在小程序上的原因就是dom依赖. 简单地看又分为两种:

+ swiper的dom依赖为操作样式. 众所周知swiper的原理就是监听操作和控制滚动, 所以解决方案用style绑定就行了.
+ 弹框类的dom依赖是创建dom. 这个处理就要放弃原来的api了. 因为dom一定要写在template里, 小程序也有操作template的api, 但是比较麻烦.

swiper就相当简单, 在组件中用一些本地数据控制写到style中, 操作数据就能操作样式了.

## 写一个swiper的思路

写一个swiper, 首先要知道划动的基本环境, 那就是:

### template结构/dom结构

一个swiper的dom结构基本就是:

+ 一个wrapper, 作用是控制整个组件的样式和计算高度, 并使内部元素有更多实现方式.
+ 内部元素wrapper, 这个元素会包含所有swiper-item, 所以长度/高度是溢出的, 划动的核心就是操作这个元素的位置. 或者用transform, 或者用absolute定位(此时需要外部wrapper相对定位, 这个情况外部wrapper是必须存在的).
+ 内部元素(swiper-item). 内部元素没有特别好说的, 可以特别说的是水平和竖直两个swiper的情况. 两个方式可以把情况写成通用, 一个是transform控制, 一个是外部flex布局.

其实布局是写组件最复杂的部分, 因为要计算元素高度, 思考各个情况. 因为我只是写了一个供自己使用的组件, 所以做得不完善. 所以进入下个部分.

### 监听事件

刚才提到了3个元素, 只需要在内部元素wrapper上加上3个事件监听就行了, 分别是touchstart, touchmove, touchend. swiper本身就是移动端的东西, 这3个事件足以. 我们分别在三个事件做的事情是:

+ touch start: 记录开始触摸的点, 存到组件数据中.
+ touch move: 根据触摸开始的点和当前的位置, 来移动wrapper的位置.
+ touch end: 根据阀值来确定swiper应该自动滚动到哪儿, 并按照这个位置移动.

基本思路就是这么简单, 只是在move的时候可以注意的细节非常多, 比如划动范围, 比如手势是横向的还是纵向的, 最后来把wrapper定位到合适的地方.

那么提到了:

### 移动wrapper位置

在touch move 和 touch end的时候都需要操作wrapper的位置, 出于小程序兼容考虑, 直接在wrapper上绑定style到组件数据, 控制这些组件数据就行了. 别的地方有做法是获取组件的$el(也就是dom)来操作.

其实功能已经搞定, 但这样使用起来体验非常差, 所以其中还有一个小细节是:

### 设置transition

得益于css3和小程序的不需要兼容, 直接设transition就可以使划动过度很舒服了.

但注意: 必须分两个时间

+ 在move的时候(也就是手指还在屏幕上的时候), 要把transition设为很低, 或者为0.
+ 在end的时候, 把transition设高, 让用户体验是慢慢弹回到该在的位置.

### 总结

做swiper和swiper-cell的基本思路还是很简单的, 只是细节上需要细心打磨操作感, 另外如果希望做成通用组件, 在设置dom和wrapper组件的时候需要花比较多的功夫来提供api.

最后贴一个[自己写的超简单, 功能单一的swiper-cell](https://github.com/cwj0417/step/blob/master/src/components/swiperCell.vue)和[vux的功能比较完善的swiper](https://github.com/airyland/vux/blob/v2/src/components/swiper/swiper.js)地址.