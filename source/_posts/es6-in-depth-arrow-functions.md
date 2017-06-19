---
title: es6 in depth 箭头函数
date: 2016-09-10 17:26:14
categories: 胡乱编码
tags: [javascript,深入es6,翻译,入门]
---
箭头从一开始就是javascript的一部分. 一开始javascript教程建议把脚本包起来作为注释. 这种表达会阻止浏览器把js代码错误地显示在html中. 你可能会写以下的代码:

```html
<script language="javascript">
<!--
  document.bgColor = "brown";  // red
// -->
</script>
```

老的浏览器会看到2个不支持的标签和一个注释, 只有新的浏览器可以识别这是js代码.

为了支持这个古老的坑, 你浏览器中的javascript引擎会把`<!--`开始的语句作为一行注释. 这不是玩笑. 这真的一直是语法的一部分, 并每天在生效, 不止是最上面的`<script>`标签而是js的任何地方. 这个特性在node中也有效.

既然这样了, [这样的注释标准第一时间被加入了es6](https://tc39.github.io/ecma262/#sec-html-like-comments). 但这不是今天要讲的箭头.

这样顺序的箭头`-->`也表示一行注释. 奇怪的是在HTML中在`-->`之前的表示注释而在JS中`-->`之后的表示注释.

接下来会更奇怪: 这个箭头只在他在行首的时候表示注释, 当他再代码中的时候, `-->`是一个js操作符, 'goes to'操作符!

```js
function countdown(n) {
  while (n --> 0)  // "n goes to zero"
    alert(n);
  blastoff();
}
```

[这个代码](http://codepen.io/anon/pen/oXZaBY?editors=001)真的可以运行. 循环从n运行到0. 这并不是es6的新特性, 而是一些我们熟悉的特性的混用再加上一些错用. 你能不能猜到是怎么做到的? 和往常一样, 我们能在[stackoverflow](http://stackoverflow.com/questions/1642028/what-is-the-name-of-the-operator-in-c)中找到答案. (答案是 `n-- >0`, 尴尬.)

当然还有一个小等于操作符, `<=`. 也许你还能在更多的地方发现箭头比如在图片的样式里, 但本文的介绍到此结束, 我们来看看这个还没有被使用的箭头.

|符号|意义|
|----|----|
|<!--| 单行注释|
|-->| 'goes to' 操作符|
|<=|小等于|
|=>|???|

那么`=>`是什么呢, 我们今天会讨论.
首先我们想讲一下函数.

## 随处可见的函数表达式

javascript的一个有意思的特性是你任何时间都需要函数, 你可以在运行的代码中间加上一个函数.

打个比方, 假设你试着告诉浏览器在点击某个按钮的时候需要做些什么, 你开始写:

```js
$("#confetti-btn").click(
```

jQuery的`click()`方法只需要一个参数: 一个函数. 没问题, 你可以直接把函数写在这里:

```js
$("#confetti-btn").click(function (event) {
  playTrumpet();
  fireConfettiCannon();
});
```

对我们来说写这些代码已经非常自然了. 所以如果javascript取消这种写法会让我们不自然, 许多语言是没有这个特性的. 当然Lisp也有函数表达式, 叫做*lambda函数*, 始于1958年. 而C++, Python, C# 和Java都很多年不带有这个特性.

现在不再是那样了, 这4种语言现在都有lambda表达式了. 新兴的语言也普遍的有内置的lambda表达式. javascript现在也有了, 这要感谢早起的无畏的程序员写了很重的lib来引导这个特性的使用推广.

有点小尴尬的是, 所有我提及的语言, javascript对lambda表达式的语法是最冗长的.

```cpp
// A very simple function in six languages.
function (a) { return a > 0; } // JS
[](int a) { return a > 0; }  // C++
(lambda (a) (> a 0))  ;; Lisp
lambda a: a > 0  # Python
a => a > 0  // C#
a -> a > 0  // Java
```

## 新的箭头蓄势待发

es6引入了一个新的写函数的方式:

```js
// ES5
var selected = allJobs.filter(function (job) {
  return job.isSelected();
});

// ES6
var selected = allJobs.filter(job => job.isSelected());
```

当你想写只有一个参数的简单的函数时, 新的箭头函数语法是简单的`Identifier => Expression`. 你可以跳过打`function`和`return`, 和那些括号,分号等.

(对我来说这是一个极好的特性. 不需要打`function`对我来说太重要了. 因为我会不可避免地打`functoin`然后再点回去修改他.)

如果要写一个带有多参数(或者没参数, 或者rest参数或默认参数, 或解构参数)你需要在参数列表外用括号括起来.

```js
// ES5
var total = values.reduce(function (a, b) {
  return a + b;
}, 0);

// ES6
var total = values.reduce((a, b) => a + b, 0);
```

我觉得这样看起来非常帅.

箭头函数也能非常完美的与一些功能函数配合, 比如[undercore.js](http://underscorejs.org/)和[Immutable](https://facebook.github.io/immutable-js/). 事实上, 一个[Immutable文档](https://facebook.github.io/immutable-js/docs/#/)已经用es6写了, 他们的很多地方都已经用了箭头函数.

那么如果是不那么函数向的场景呢?(可能指没返回, 而是执行一些内容) 箭头函数也可以包裹一个语句块而不只是表达式. 回忆下前面的例子:

```js
// ES5
$("#confetti-btn").click(function (event) {
  playTrumpet();
  fireConfettiCannon();
});
```

下面是es6的版本:

```js
// ES6
$("#confetti-btn").click(event => {
  playTrumpet();
  fireConfettiCannon();
});
```

一个比较小的改进. 如果用在Promise上效果会更大, 比如`}).then(function (result) {`这样的行就可以收起来了.

要注意的是使用body块的箭头函数不会自动返回值, 需要用`return`语句来实现.

有一个箭头对象返回对象的提醒, 对象永远要用括号括起来:

```js
// create a new empty object for each puppy to play with
var chewToys = puppies.map(puppy => {});   // BUG!
var chewToys = puppies.map(puppy => ({})); // ok
```

很不凑巧, 一个空对象`{}`和空的语句块`{}`看起来正好一样. 在es6中在箭头后的`{`会被当做一个语句块的开始, 而不是对象的开始. `puppy = {}`会被默认为一个什么都没做并返回`undefined`的箭头函数.

更复杂一点, 一个对象字面量`{key:value}`看起来正好是一个语句块, 至少js引擎是这么识别的, 幸运的是有歧义的字符只有`{`这一个, 只要记得用括号括起来就可以了.

## `this`是指?

普通的`function`和箭头函数有一个小区别. **箭头函数没有自己的`this`值`. 箭头函数内的`this`永远指向外层作用域.

在我们实际尝试和理解之前先来做一些前提准备.

`this`在javascript用来干嘛?他的值从哪来?[这是个简短的回答](http://stackoverflow.com/questions/3127429/how-does-the-this-keyword-work). 如果你觉得这很简单, 说明你经常在处理`this`.

这个问题经常遇见的原因是`function`函数会自动接收一个`this`值, 无论你想不想要, 你又没有写过类似的代码?

```js
{
  ...
  addAll: function addAll(pieces) {
    var self = this;
    _.each(pieces, function (piece) {
      self.add(piece);
    });
  },
  ...
}
```

这里你想写一个类似`this.add(piece)`的内部方法. 不幸的是, 内部方法没有继承外部的`this`值, 在内部方法中`this`可能是`window`或者`undefined`. 临时变量`self`是用来传递外部的`this`值到内部方法的.(另外个方法是在内部方法使用`.bind(this)`, 两个方法都很不错.)

在es6中, 如果你遵循了一下规则`this`的问题会不存在:

+	在非箭头函数中使用`object.method()`语法来调用. 这样这些函数就可以接收到有意义的`this`.
+	在其他地方都使用箭头函数.

```js
{
  ...
  addAll: function addAll(pieces) {
    _.each(pieces, piece => this.add(piece));
  },
  ...
}
```

在es6中, `addAll`方法从他的调用者接收到了`this`. 内部方法是一个箭头函数, 所以继承了外部作用域的`this`.

还有个小奖励, es6提供了一个在字面量对象中写方法的快捷语法, 上面的代码可以被简化成:

```js
// ES6 with method syntax
{
  ...
  addAll(pieces) {
    _.each(pieces, piece => this.add(piece));
  },
  ...
}
```

我想可能在以后的方法和箭头里可以再也不用打`function`了, 太好了.

还有一个小区别, 箭头函数拿不到`arguments`对象. 当然在es6里你已经应该不需要他了.

## 用这个箭头来刺穿计算机科学的黑暗心脏

我们已经说了箭头函数的许多使用例子. 还有一些可能会用到的情况: es6可以作为一个学习工具来揭示计算的深层本质. 这是否实际决定于你自己.

在1936年, alonzo Church和Alan Turing独立开发了强大的数学计算模型. Turing把他这个模型称作`a-machines`, 但每个人都把这个叫做Turing machines. Church重新写了一些函数. 他的模型叫做[ λ-calculus](https://en.wikipedia.org/wiki/Lambda_calculus)(λ是希腊字母lambda的小写). 这就是为什么Lisp用`LAMBDA`来命名函数, 也就是我们现在说的"lambdas"表达式.

但什么是λ-calculus呢? "计算模型"又是什么意思?

用简单几句没法解释清楚, 但我试一下: λ-calculus是第一个编程语言. 但并不是本来就想设计成编程语言-毕竟一个编程语言不能持续一二十年-但希望这种简单明了纯数学的算法可以在计算机内任何需要的时候都能用. Church希望这个模型可以某个程度上帮助计算.

然后他发现他的系统只需要一个东西:*函数*.

想一想这个想法是多么非凡. 不需要对象, 数字, 没有`if`语句, `while`循环, 分号, 赋值, 逻辑操作符, 或者事件循环, 只需要函数就可以重写计算机的任何方法.

下面是数学家可能会写的这种'编程', 使用了Church的lambda表达式:

```js
fix = λf.(λx.f(λv.x(x)(v)))(λx.f(λv.x(x)(v)))
```

在javascript中看起来是这样的:

```js
var fix = f => (x => f(v => x(x)(v)))
               (x => f(v => x(x)(v)));
```

也就是说，JavaScript 包含了一个 λ 表达式的运行时实例，λ 表达式存在于 JavaScript 内部。

## 哪里可以使用箭头函数?

babel, traceur或者typescript.

---

es in depth 系列 [目录](/2016/09/10/es6-in-depth-content/) [原文地址](https://hacks.mozilla.org/category/es6-in-depth/)