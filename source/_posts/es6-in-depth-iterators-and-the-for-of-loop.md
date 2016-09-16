---
title: es6 in depth 遍历器 和 for-of 循环
date: 2016-09-10 17:21:37
categories: 代码
tags: [ES2015,es6-in-depth,翻译]
---

你是如何循环一个数组的元素的呢？ 用javascript的话, 20年前你可能是这么做的: 

```js
for (var index = 0; index < myArray.length; index++) {
	console.log(myArray[index]);
}
```

自从有了es5, 你可以用内置的`forEach`方法: 

```js
myArray.forEach(function(value) {
	console.log(value);
});
```
这样代码量少了一点, 但也有了一个小问题:  循环的时候不能用`break`语句或用`return`语句来退出当前方法.

如果可以使用for循环语法来循环数组元素那就好了.

`for-in`循环张啥样？（如下）

```js
for (var index in myArray) {   //事实上并不能这么干
	console.log(myArray[index]);
}
```

这是个坏主意因为: 

+ 在这种代码里`index`接受到的参数是字符串类型的`"0"`,`"1"`,`"2"`等等, 并不是数字. 如果你不想发生字符串计算的话（`"2" + 1 == "21"`）, 这种代码最不方便了.

+ 这样的代码执行得到的不只是数组的元素, 还能得到其他被人加上的[expando](https://developer.mozilla.org/en-US/docs/Glossary/Expando)属性. 比方:  你的数组有个可被枚举(enumerable)的属性`myArray.name`, 那么这个循环会知道到一次额外的`index == "name"`. 只要在数组原型链上的属性可以被访问.

+ 其中最让人咋舌的是, 在某些情况下, 这个循环数组元素的顺序是随机的.

总的来说, `for-in`是为了遍历原生的`Object`对象的字符串类型的键设计的. 对于`Array`来说并不怎么能使用.

## for-of循环

记得我上周打赌es6会打破你之前写的js的样子. 好了, 一万个网站都是用`for-in`的, 甚至作用在数组上. 而且从来没有任何想“修复”`for-in`在数组上行为的课题. es6唯一来改进这个行为的方法是如下的新的循环语法: 

```js
for (var value of myArray) {
	console.log(value);
}
```

嗯嗯, 看了写法以后, 感觉好像没什么特别的. `for-of`循环到底有什么特别的地方呢, 我们马上来看: 

+ 这是有史以来循环数组元素最简要、直接的语法.
+ 他避免了所有`for-in`的坑
+ 不像`forEach()`, 他可以随时`break`,`continue`,或者`return`.

`for-in`循环用来循环对象的属性.
`for-of`循环用来循环类似在数组里的值的数据.

但这还不是全部.

## 也有别的数据类型支持for-of

`for-of`循环不止可以用在数组, 也可能在类数组的对象上生效, 比如`NodeList`.

也可能作用在字符串上, 把字符串当成Unicode字母的序列.

```js
for (var chr of "😺😲") {
  alert(chr);
}
```

也能在`Map`和`Set`对象上生效.

噢抱歉. 你从来没听过`Map`和`Set`对象？ 他们是es6新加的. 以后会有整章来说他们的特点. 如果你在其他语言里用过map和set, 那对你来说不是大变化.

比如, `Set`对象是用来去重的: 

```js
//用一个words的数组生成一个set
var uniqueWords = new Set(words);
```

一但你得到了一个`Set`, 你就可以来简单得循环他: 

```js
for (var word of uniqueWords) {
	console.log(word);
}
```

`Map`有一点点不同:  里面的数据由键值对组成, 所以你想`destructuring`来把键值拆开: 

```js
For (var [key, value] of phoneBookMap) {
	console.log(key + "的电话是: " + value) ;
}
```

`destructuring`也是es6的一个新特性, 我也会写一个专题来介绍他.

到了现在, 你已经感受到了:  js已经有了一些不同的数据类型, 还可能更多. `for-of`就是用来遍历他们的.

`for-of`不可以用在原生的`Object`上了, 但你还是想遍历对象属性的话可以这么用: 

```js
//把一个对象可枚举的属性打出来
for (var key of Object.keys(someObject)) {
	console.log(key + ":" + someObject[key]);
}
```

## 底层

> 一般的人模仿, 厉害的人借鉴. ---Pablo Picasso

es6发展加入的新特性并非无中生有. 大多数都是别的语言中尝试过和被证明是有用的特性.

比如`for-of`循环, 和C++, Java, C#, 和Python的语法很像. 和他们一样, 他作用于自己语言和标准的不同数据结构上. 但他仍是一个语言的拓展点. 

和别的语言的`for`/`foreach`一样, **`for-of`完全以函数调用的形式工作**. `Array`, `Map`, `Set`和一些其他对象都有一个共同点就是有遍历器方法。

还有一种对象可以有遍历器方法, 这个对象就是: *你需要的任何对象*.

就像你把`myObject.toString()`方法添加给对象来使js知道如何将这个对象转为字符串, 你可以添加`myObject[Symbol.iterator]()`方法给对象来使js知道怎么来循环他.

举个例子, 假设你再用jQuery, 当然你已经知道有`.each()`这个方法了, 但你想让jQuery也可以使用`for-of`的话, 以下是如何做到:

```js
//因为jQuery对象是类数组的, 所以就赋给他数组的遍历器
jQuery.prototype[Symbol.iterator] = 
    Array.prototype[Symbol.iterator];
```

好吧, 我知道你在想啥. 那个`[Symbol.iterator]`语法看起来好奇怪. 这里发生了什么?
 他的行为等价于方法名字. 标准委员会本想就简单得把方法名字叫做`.iterator()`, 但当你的代码有一个`.iterator()`方法的时候就让人觉得很搞了. 所以在标准中使用了*symbol*而不是字符串, 来作为这个方法的名字.

Symbol也是一个es6的一个新特性, 然后(正如你所猜测的)我会在以后的文章里说到.你现在只需要知道, 我们可以定义一个symbol, 就像`Symbol.iterator`, 他保证了不与现有的代码冲突. 代价是他的语法很奇怪. 但相对于他的通用性和以后的良好兼容的成果来说这是个很小的代价了.

拥有`[Symbol.iterator]()`方法的对象我们称为可遍历的(interable). 下周的文章我们会了解可遍历对象的概念贯穿了js语言的使用, 不仅在`for-of`, 还有`Map`和`Set`的构造方法, destructuring 赋值, 和新的操作符 spread.

## 可遍历对象

恩, 你可能永远不会自己从头开始用可遍历对象. 我们会在下周讨论, 但为了完整性, 我们来看一下可遍历对象张啥样. (如果你跳过了整个章节, 你很可能会错过零碎的技术细节.)

一个`for-of`循环从调用对象的`[Symbol.iterator]`方法开始. 调用以后会得到一个新的可遍历对象. 一个可遍历对象可以是任何拥有`.next()`方法的对象; `for-of`循环会重复得调用这个方法, 每次循环调用一次. 举个例子吧, 下面是我能想到的最简单的可遍历对象.

```js
var zeroForeverIterator = {
    [Symbol.iterator] : function() {
        return this; 
    },
    next: function() {
        return {done: false, value: 0};
    }
};
```

每次这里的`.next()`方法被调用都会返回一个相同的结果, 告诉`for-of`循环我们还没有遍历完; 并且返回的value是0. 
这意味着`for (value of zeroForeverIterator) {}`将是一个无限循环. 当然一个普通的遍历器不会像这次尝试一样.

这种有着`.done`和`.value`属性的遍历器设计, 看起来和其他语言的遍历器工作方式不同. Java里遍历器有`.hasNext()`和`.next()`方法. Python里只有`.next()`方法并会在没有值来进行遍历的时候抛出`StopIteration`. 但三种设计其实包含的基本信息是一样的.

可遍历对象也可以选择性得包含`.return()`和`.throw(exc)`方法. `for-of`循环会在循环因为`break`或`return`语句过早退出的时候调用`.return().`如果遍历器需要清理或释放正在使用的资源那就可以包含`.return()`方法, 大多数遍历器不需要. `.throw(exc)`方法比较特殊: `for-of`永远不会调用他. 我们会在下篇文章更多了解他.

 我们已经知道了所有的细节, 现在我们可以写一个简单的`for-of`循环并重载他隐性调用的方法了.

首先写一下`for-of`循环:

```js
for (VAR of ITERABLE) {
    STATEMENTS
}
```

以下这段代码是差不多等价的, 用了隐性方法和一些临时变量.

```js
var $interator = ITERABLE[Symbol.iterator]();
var $result = $iterator.next();
while (!$result.done) {
    VAR = $result.value;
    $result = $iterator.next();
}
```

以上代码没有表现`.return()`是如何处理的. 
我可以加上, 但我觉得会使我们搞不清发生了什么, 更不用说原理了.
`for-of`循环很容易用, 但底层有很多内容.

## 我们什么时候可以开始用他?

`for-of`循环被现在所有火狐支持. chrome的话要去`chrome://flags`开启'Experimental JavaScript'选项. 也被微软的浏览器spartan支持(并不是IE). 当然如果你你需要支持IE或者Safari, 你可以使用类似`Babel`或谷歌的`Traceur`这样的编译器来把你的es6代码转为es5.


如果是服务端, 就不需要编译器了. 高版本的nodejs就可以.

## {done: true}

哦耶!

这篇文章结束啦, 但我们在`for-of`的学习还没有结束.

还有更多es6的新品种对象可以和`for-of`一起工作. 因为是下周的主题所以我没提. 我觉得这是es里最魔性的新特性. 如果你已经在Python和C#里遇到过你可能会觉得吃惊. 但这是写遍历器最简单的方法, 并且对重构友善, 改变你写异步代码的方式, 无论在浏览器还是服务端. 敬请期待下周的es6-in-depth之生成器.

---

es in depth 系列 [目录](/2016/09/10/es6-in-depth-content/) [原文地址](https://hacks.mozilla.org/category/es6-in-depth/)
