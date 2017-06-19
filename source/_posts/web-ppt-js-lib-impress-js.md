---
title: 强力3D的PPT 介绍
date: 2016-09-04 17:26:24
categories: 胡乱编码
tags: 介绍
---
要做ppt, 从小都没做过, 怎么办, 本劳资好紧张, 看到个有意思的ppt lib, 赶紧试一发.
<!--more-->

## 隆重介绍这个ppt的lib（其实是远古年代的了）
[IMPRESS.JS](https://github.com/impress/impress.js)
api和用法都非常简单, 只是对3D的调试和设计可能需要一点心思.
（本文完）

## impress.js api 简单介绍

+ 这个lib的启动方式是寻找id与class来启动应用. 
+ 启动之后提供的api只有一个: 翻页, 各种翻, 向前先后、根据id根据顺序, 效果是改变hash.
+ 提供了3个状态class分别为`past`,`present`,`future`, 作用的话聪明的你一看就知道了.

完, api就是这么少, 这么简单, 所以这个lib很强, 难的是设计.

我用angular把以上已经很简单的api封装了一下, 所以根本就不需要去启动应用了.
只需要把ppt写在`ppt`,`slide`这2个标签里, 再代码里配置下每个`slide`的位置就ok. 
[repo地址](https://github.com/fjonas/ng1-impress-ppt)

## 3D系统介绍
这里是重点. ppt的位置属性一共有8个: 
`x`,`y`,`z`,`scale`,`rotate`,`rotate-x`,`rotate-y`,`rotate-z`. 作用都是字面意思.

我的经验: 
+ 以几张关系密切需要明确定位的slide为基准, 基准ppt的`x`,`y`以外所有属性不要变. 因为任何`rotate`,`scale`属性会导致你的(其实是我的)大脑跟不上节奏.
+ 在主场景和分镜切换多使用`scale`, 这样感觉很帅.
+ past和future设置0.3左右的透明度, present类可以作为入场动画的类.
+ 整个ppt其实是一个3D场景, 这个思路很重要, 我们切换slide只是在场景中切换镜头.

## 展望

这个ppt已经很厉害了, 展望的内容为:  
1. 封装、抽象位置信息, 提供容易被想象的api来map那些属性.
1. 每个slide页提供方便、 多功能的编写方式.
1. 通过文件build页面.