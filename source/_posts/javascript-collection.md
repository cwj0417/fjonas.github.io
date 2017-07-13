---
title: js小细节收集
date: 2016-08-01 15:44:33
categories: 编码与分析
tags: javascript
---
javascript的没什么用的细节收集, 内容不断更新
<!--more-->
---
```js
var num = +"5";
```
``+``运算符约等于parseInt

---
```js
var boolean = !!"string";
```
``!!``强制转为布尔值

---
```js
!0 === true
!1 === false
```
``true``和``false``的表达方式

---
#### 优化循环
```js
var arr = [1,2,3], arrlen = arr.length;
for(let i = arrlen; i >= 0; i --) {}
```
效率提高, 数组是反过来遍历的. 原理是js--比++快(引擎已优化: length只需要计算一次).
