---
title: es6 in depth symbols
date: 2016-09-10 17:26:39
categories: 胡乱编码
tags: [ES2015,es6-in-depth,翻译]
---

什么是es6 symbols?
symbols不是符号.
不是在你代码中的小图片.

```js
let 😻 = 😺 × 😍;  // SyntaxError
```
也不是别的什么.

## 七个类型

从javascript在1997年被标准化开始就又了6个类型. es6前, 每个js的值都可以被归类到下面几个种类里.

+	Undefined
+	Null
+	Boolean
+	Number
+	String
+	Object

每个类型都有一个值的集合. 前5个集合都是有限的. 比如说, 当然的事, Boolean只有2个值, `true`和`false`, 并且也不会再有新的了. Number和String的话会有更多的值. 在标准里Number类型有18,437,736,874,454,810,627 个值(包括`NaN`, "Not a Number"的简写). 和不同的String的值就没什么好比的了, 我想我没数错的话可能有(2^144,115,188,075,855,872 − 1) ÷ 65,535个.

但是Object的值就是开放的了. 每个Object都是唯一的, 像珍贵的雪花. 每当你打开一个页面, 一批新的Object就被创建了.

es6的symbol也是一个值, 但他不是String也不是Object, 他是一个新的东西, 第七个类型.

好拉, 接下来让我们说一下他的应用场景吧.

## 保存一个小小的布尔值

有时候给js对象上藏一个实际是别的地方的额外的数据是相当容易的.

大哥比方, 假设你在用css transision来写一个让dom元素在页面上移动的js lib. 你注意到了对一个`div`同时多个操作是不能达到预期的. 会导致丑陋的不连续的跳动. 你觉得你可以修复这个问题, 但你首先需要一个方法指导当前的元素是否在移动.

我们怎么处理这个问题呢?

一个方法是调用css的api来请求浏览器得知元素是否在移动. 但这样看起来太费周章了. 你的lib最好是已经可以知道那个元素是否在移动, 应该用代码第一时间把他设为移动的状态!

你真正想做到的是保持追踪元素的移动状态. 你可以做一个数组来存放所有元素的状态, 每次你的lib调用元素的时候去检查一下这个数组.

啊哈, 如果数组很大的话线性的搜索又会非常慢.

你真正想做的是在元素上设定一个flag:

```js
if (element.isMoving) {
  smoothAnimations(element);
}
element.isMoving = true;
```

这样做也存在一些潜在的问题. 这些问题有关于不止同一份代码在操作这些dom.

1.	别的代码使用`for-in`或者`Object.keys()`的时候会被你创建的属性影响.
1.	一些别的厉害的lib作者可能已经想过了解决方案, 而你的lib会对现有的lib有不好的作用.
1.	一些厉害的lib作者可能将来会向怎么处理, 而你的lib会对将来的lib有不好的作用.
1.	标准委员会决定增加一个`.isMoving()`方法到所有的元素里, 而你已经先占用了.

当然你也可以用过把属性名设为很长很傻以致没人会想用:

```js
if (element.__$jorendorff_animation_library$PLEASE_DO_NOT_USE_THIS_PROPERTY$isMoving__) {
  smoothAnimations(element);
}
element.__$jorendorff_animation_library$PLEASE_DO_NOT_USE_THIS_PROPERTY$isMoving__ = true;
```

这个属性让人眼都看瞎了.

你也可以通过密码学来产生一个唯一的属性名:

```js
// get 1024 Unicode characters of gibberish
var isMoving = SecureRandom.generateName();

...

if (element[isMoving]) {
  smoothAnimations(element);
}
element[isMoving] = true;
```

`object[name]`这种语法让你可以把任何字符串作为一个属性名. 这样是可以正常工作的, 实际中几乎不可能碰撞, 你的代码看起来也是OK的.

但这样会导致很差的debug体验. 每次你用`console.log()`的时候都会看到一长串东西. 而且如果你需要更多的属性呢? 你怎么能正确的维护他们? 你每次重新加载的时候会变成不同的名字.

这真的那么难吗? 我们只是要保存一个小小的布尔值!

## 答案是Symbol

Symbol是可以让程序员创建并使用一些属性键而不会冒着重名危险的值.

```js
var mySymbol = Symbol();
```

调用`Symbol()`可以创建一个新的symbol, 一个和其他值都不同的东西.

和字符串或者数字一样, 你可以用symbol来作为属性名. 因为他不等于任何字符串, 所以用symbol做键的属性也可以保证不会与其他属性冲撞.

```js
obj[mySymbol] = "ok!";  // guaranteed not to collide
console.log(obj[mySymbol]);  // ok!
```

下面的代码是你可以如何用symbol解决之前讨论过的问题:

```js
// create a unique symbol
var isMoving = Symbol("isMoving");

...

if (element[isMoving]) {
  smoothAnimations(element);
}
element[isMoving] = true;
```

以上代码的一些注意点:

+	在`Symbol('isMoving')`中的字符串`'isMoving'`被称作*描述*. 在debug的时候很有用. 你`console.log()`symbol的时候会显示出来, 当你用`.toString()`来尝试转为字符串的时候, 他也许会在错误信息里, 就是这样.
+	`element[isMoving]`被称作*symbol键的属性*. 一个使用symbol作为键而不是字符串作为键的值. 除了这个, 他和其他的属性别无二致.
+	和数组元素一样, symbol作为键的属性不能用点的语法, 比如`obj.name`. 只要方括号才能使用symbol.
+	如果你已经获得symbol, 那么拿到属性值就很容易, 上面已经展示了如何get和set`element[isMoving]`, 如果有需要的话我们同样也可以调用`if(isMoving in element)`甚至`delete element[isMoving]`.
+	另一方面, 上面所有这些都需要`isMoving`在作用域内. 这让symbol可以用来实现弱封装: 一个模块可以创建一些sybol来给自己的object使用并且**不用担心与其他代码创建的属性冲突**.

因为symbol键是被设计来避免冲撞的, javascript大多数普通的遍历对象的方法都会忽略symbol键. 比如唯一的获得对象字符串键的`for-in`循环. `Object.keys(obj)`和`Object.getOwnPropertyNames(obj)`也是如此. 但symbol实际上不是私有的: 通过新的api`Object.getOwnPropertySymbols(obj)`来列出一个对象的symbol. 另外一个api`Reflect.ownKeys(obj)`, 可以同时返回字符串键和symbol键. (Reflect将会在下篇文章里说.)

看起来lib和框架可能会更多使用symbol, 我们接下来也会看到es6让我们看到他有广泛的用途.

## symbol的三种放置

有三种方法可以获取到symbol.

+	**调用`Symbol()`**. 正如之前说的, 这样调用每次都会返回一个新的唯一的symbol.
+	**调用`Symbol.for(string)`**. 获得一个叫做*symbol寄存器*中的symbol集合. 与被`Symbol()`定义的唯一symbol不同, 在symbol寄存器中的symbol是共享的. 如果你调用`Symbol.for('cat')`三次,  你会得到同一个symbol. symbol寄存器可以用在多个web页面或者一个页面多个模块的情景下.
+	**使用类似`Symbol.iterator`的形式, 这是标准定义的**. 一些symbol已经被标准创建了. 每个都有他们特殊的用途.

如果你仍然没有确定symbol是不是那么有用, 下个章节很有趣, 会告诉你symbol已经被实践证明是有用的.

## es6标准中的symbol的使用.

我们已经知道es6用symbol来避免与现有代码的冲突. 几周前, 我写过一个iterator的文章, 我们看到了循环:`fro (var item of myArray)` 以`myArray[Symbol.iterator]()`开头. 我提到过这个可以被写作`myArray.iterator()`, 但是写作symbol更利于兼容性.

现在我们已经吧symbol讲到这个程度了, 也很容易理解上面的代码的意思和原理了.

下面是几个es6使用的著名的symbol.

+	**使`instanceof`可拓展**. 在es6中, 表达式:`object instanceof constructor`被认为是构造方法的一个方法:`constructor[Symbol.hasInstance](object)`. 这意味了可拓展性.
+	**解决新特性和旧代码的冲突**. 这又点难理解, 我们会发现*只是写了一些es6的`Array`方法*就把整个页面写崩了. 其他的web标准也存在类似的问题: 只是用了一个新方法就把浏览器整个页面搞挂了. 但是我们发现, 这种页面崩坏大多由一种被称作*不稳定范围的特性*导致的, 所以es6引入了一个特殊的symbol:`Symbol.unscopables`, 这样web标准可以防止我们使用了不稳定的特性而弄崩页面.
+	**支持字符串匹配的新种类**. 在es6里, `str.match(myObject)`会尝试吧`myObject`转换为`RegExp`. 在es6, js首先会去检查`myObject`是否存在`myObject[Symbol.match](str)`. 现在各种lib就可以提供自定义的parse字符串的类来替换所有`RegExp`影响的地方.

以上这些用法其实还很窄. 这还很难看到这个特性对我们每天编码的巨大影响. 来日方长. 这些被标准定义的symbol是js对php和python中的`__doubleUnderscores`(魔术方法)的改进版本. js标准会在将来给语言增加更多新的钩子并没有影响现有代码的危险.

## 如何可以用es6的symbol?

用一些polyfill的lib.

---

es in depth 系列 [目录](/2016/09/10/es6-in-depth-content/) [原文地址](https://hacks.mozilla.org/category/es6-in-depth/)