---
title: es6 in depth 遍历器 和 for-of 循环
date: 2016-09-10 17:21:37
categories: 代码
tags: [ES2015,es6-in-depth,翻译]
---

你是如何循环一个数组的元素的呢？ 用javascript的话, 20年前你可能是这么做的：

```js
for (var index = 0; index < myArray.length; index++) {
	console.log(myArray[index]);
}
```

自从有了es5, 你可以用内置的`forEach`方法：

```js
myArray.forEach(function(value) {
	console.log(value);
});
```
这样代码量少了一点, 但也有了一个小问题： 循环的时候不能用`break`语句或用`return`语句来退出当前方法。

如果可以使用for循环语法来循环数组元素那就好了。

`for-in`循环张啥样？（如下）

```js
for (var index in myArray) {   //事实上并不能这么干
	console.log(myArray[index]);
}
```

这是个坏主意因为：

+ 在这种代码里`index`接受到的参数是字符串类型的`"0"`,`"1"`,`"2"`等等, 并不是数字。 如果你不想发生字符串计算的话（`"2" + 1 == "21"`）, 这种代码最不方便了。

+ 这样的代码执行得到的不只是数组的元素, 还能得到其他被人加上的[expando](https://developer.mozilla.org/en-US/docs/Glossary/Expando)属性。 比方： 你的数组有个可被枚举(enumerable)的属性`myArray.name`, 那么这个循环会知道到一次额外的`index == "name"`。 只要在数组原型链上的属性可以被访问。

+ 其中最让人咋舌的是, 在某些情况下, 这个循环数组元素的顺序是随机的。

总的来说, `for-in`是为了遍历原生的`Object`对象的字符串类型的键设计的。 对于`Array`来说并不怎么能使用。

## for-of循环

记得我上周打赌es6会打破你之前写的js的样子。 好了, 一万个网站都是用`for-in`的, 甚至作用在数组上。 而且从来没有任何想“修复”`for-in`在数组上行为的课题。 es6唯一来改进这个行为的方法是如下的新的循环语法：

```js
for (var value of myArray) {
	console.log(value);
}
```

嗯嗯, 看了写法以后, 感觉好像没什么特别的。 `for-of`循环到底有什么特别的地方呢, 我们马上来看：

+ 这是有史以来循环数组元素最简要、直接的语法。
+ 他避免了所有`for-in`的坑
+ 不像`forEach()`, 他可以随时`break`,`continue`,或者`return`。

`for-in`循环用来循环对象的属性。
`for-of`循环用来循环类似在数组里的值的数据。

但这还不是全部。

## 也有别的数据类型支持for-of

`for-of`循环不止可以用在数组, 也可能在类数组的对象上生效, 比如`NodeList`。

也可能作用在字符串上, 把字符串当成Unicode字母的序列。

```js
for (var chr of "😺😲") {
  alert(chr);
}
```

也能在`map`和`Set`对象上生效。

噢抱歉。 你从来没听过`Map`和`Set`对象？ 他们是es6新加的。 以后会有整章来说他们的特点。 如果你在其他语言里用过map和set, 那对你来说不是大变化。

比如, `Set`对象是用来去重的：

```js
//用一个words的数组生成一个set
var uniqueWords = new Set(words);
```

一但你得到了一个`Set`, 你就可以来简单得循环他：

```js
for (var word of uniqueWords) {
	console.log(word);
}
```

`Map`有一点点不同： 里面的数据由键值对组成, 所以你想`destructuring`来把键值拆开：

```js
For (var [key, value] of phoneBookMap) {
	console.log(key + "的电话是: " + value) ;
}
```

`destructuring`也是es6的一个新特性, 我也会写一个专题来介绍他。

到了现在, 你已经感受到了： js已经有了一些不同的数据类型, 还可能更多。 `for-of`就是用来遍历他们的。

`for-of`不可以用在原生的`Object`上了, 但你还是想遍历对象属性的话可以这么用：

```js
//把一个对象可枚举的属性打出来
for (var key of Object.keys(someObject)) {
	console.log(key + ":" + someObject[key]);
}
```




























---

es in depth 系列 [目录](/2016/09/10/es6-in-depth-content/) [原文地址](https://hacks.mozilla.org/category/es6-in-depth/)