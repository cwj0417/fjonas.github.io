---
title: es6 in depth 解构赋值
date: 2016-09-10 17:25:56
categories: 代码
tags: [ES2015,es6-in-depth,翻译]
---

## 什么是解构赋值?

解构赋值允许你通过和数组对象相近的语法来使用数组或对象的属性. 他的语法非常简单. 而且还比传统的获取属性方法更清晰.

不使用解构赋值, 你获取一个数组前三个属性的语法可能是这样的:

```js
var first = someArray[0];
var second = someArray[1];
var third = someArray[2];
```

用了解构赋值, 等价的代码变得更简单可读:

```js
var [first, second, third] = someArray;
```




---

es in depth 系列 [目录](/2016/09/10/es6-in-depth-content/) [原文地址](https://hacks.mozilla.org/category/es6-in-depth/)
