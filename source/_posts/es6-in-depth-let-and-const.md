---
title: es6 in depth let 与 const
date: 2016-09-10 17:28:12
categories: 编码与分析
tags: [javascript,深入es6,翻译,入门]
---
当Brendan Eich在1995年设计了第一版javascript, 他留下了很多错误, 包括至今还留着的部分, 包括`Date`object和object会在你试图乘他们的时候转换为`NaN`. 但他也有做得好的地方: object; prototypes; 等等. 让语言有了骨架. 使语言比看上去的更好.

当然Brendan也做了一些设计导致了今天文章的主题~让我们来看一下吧.

是关于变量的.

## 问题#1: 代码块没有作用域

这个规则听上去没什么错: **js函数中的`var`关键字创建的[作用域](http://robertnyman.com/2008/10/09/explaining-javascript-scope-and-closures/)是这个函数的整个函数体**. 但有两个情况会产生问题.

一个问题是在代码块中声明的变量作用不是代码块, 而是整个函数.

你可能之前都没注意过. 恐怕这个问题你不可以当做没看见一样. 我们来谈谈这个问题会导致bug的场景吧.

假设你在代码中用了变量*t*:

```js
function runTowerExperiment(tower, startTime) {
  var t = startTime;

  tower.on("tick", function () {
    ... code that uses t ...
  });
  ... more code ...
}
```

目前看起来一切都正常. 现在你像加一个测试保龄球测速器, 所以你需要写一些`if`语句在回调方法中.

```js
function runTowerExperiment(tower, startTime) {
  var t = startTime;

  tower.on("tick", function () {
    ... code that uses t ...
    if (bowlingBall.altitude() <= 0) {
      var t = readTachymeter();
      ...
    }
  });
  ... more code ...
}
```

哦, 亲爱的. 你不经意地写了第二个变量*t*. 之前"用了变量t的代码"工作正常, 而现在`t`指向的是代码块内部的变量而不是外部的`t`了.

`var`在javascript中就像把变量扔进了染缸. 会向两边拓展定义, 前和后, 直到方法边界. 虽然变量*t*的作用域拓展到方法头部, 但还是在创建时进入方法的. 这个行为被成为*变量提升*. js引擎会把每个`var`和`function`声明的变量提升到函数块的头部.

变量提升有他的好处. 许多写得好的代码不适用[立即执行函数](https://en.wikipedia.org/wiki/Immediately-invoked_function_expression). 但在这个case中, 变量提升导致了很麻烦的问题: 你所有使用*t*变量的地方会开始产生`NaN`. 并且很难去追踪. 特别是在更大的项目中.

新加一个代码块会产生莫名其妙的错误, 我们并不想代码产生额外的行为.

这只是`var`问题的一部分.

## 问题#2: 循环中变量指向

你可以猜一下下面代码的运行结果, 这很简单:

```js
var messages = ["Hi!", "I'm a web page!", "alert() is fun!"];

for (var i = 0; i < messages.length; i++) {
  alert(messages[i]);
}
```

如果你一直追这个es6系列的文章, 你会发现我一直用`alert()`. 也许你知道`alert()`是个很可怕的api, 他是同步的. 所以当alert弹出的时候, 输入事件不会被传递, 你的js代码 — 事实上是你整个UI — 在你点击确定前全被暂停了.

在你的web页面中使用`alert()`是不好的, 但我用她是觉得`alert()`是一个很好的测试工具.

接下来我要写个说话的猫的代码:

```js
var messages = ["Meow!", "I'm a talking cat!", "Callbacks are fun!"];

for (var i = 0; i < messages.length; i++) {
  setTimeout(function () {
    cat.say(messages[i]);
  }, i * 1500);
}
```

[运行效果](http://jsfiddle.net/8t2q8wfr/4/)

但是好像有问题, 猫没有说那些话, 而是说了3次"undefined".

你可以定位到bug吗?

![一个图片](https://2r4s9p1yi1fa2jd7j43zph8r-wpengine.netdna-ssl.com/files/2015/07/7994751456_e8d2019876_o.jpg)

---

这里的问题就出在变量*i*. 循环的变量共享了外面的变量, 当循环结束, i的值是3, 所以`messages[3]`是`undefined`.

## `let`是新的`var`

大部分情况, javascript的设计错误(别的语言也如此, 但特别是js)不能被修复. 因为需要兼容之前的代码. 即使标准委员会也没权利说来修复 javascript中奇怪的自动补分号的行为. 浏览器也不会去实现断层的更新, 这样会影响到用户.

所以大概10年前, Brendan Eich决定要修复这个问题, 而且只有一个办法可以做到.

他加了一个新关键字`let`, 用来定义变量, 和`var`用法一样, 但是有更好的作用域规则.

看起来是这样的:

```js
let t = readTachymeter();
```

或者是:

```js
for (let i = 0; i < messages.length; i++) {
  ...
}
```

`let`和`var`是不同的, 如果你进行全局替换, 会破坏你的代码(可能是不经意的), 因为`var`奇怪的行为. 但在大多数的情况中, 在用es6新写的代码中, 你应该要在任何情况下停止使用`var`而使用`let`来替代. 因此才有了这个口号: "`let`是新的`var`".

那么到底`let`和`var`有什么区别呢? 很高兴你这么问.

+ **`let`变量是块级作用域的.** `let`定义的变量作用域是当前代码块, 而不是函数块.

  `let`仍然有变量提升, 但不是盲目的了. 刚才的`runTowerExperiment`的例子可以通过简单地用`let`替代`var`来修复. 如果你到处都用`let`那就不会有这种问题了.

+ **全局中使用`let`不会把变量挂到全局object上.** 也就是说你不能通过`window.variableName`来拿到变量了. 这些变量现在在一个看不见的抽象的闭包中.

+ **类似`for(letx...)`的循环每次遍历都会创建一个新的x.**

  这是一个很微小的变化. 意思是`for(let...)`循环执行了多次, 循环会维护一个闭包, 比如刚才说话的猫的例子, 每次循环都会捕捉当前循环的变量的副本, 而不像但作用域一样捕捉到了相同的变量.

+ **如果在定义`let`变量前就使用会报错.** 直到变量被声明前, 变量都没有被初始化. 看例子:

  ```js
  function update() {
    console.log("current time:", t);  // ReferenceError
    ...
    let t = readTachymeter();
  }
  ```

  这个规则是帮你查错的. 如果这么写会直接报错, 而不是得到一个`NaN`.

  这种情况: 变量在一个作用域内, 但没被初始化, 这个区域被称作*暂时的死区*. 这里会去等到变量被声明的地方为止.

+ **重新声明`let`会导致`SymtaxError`**.

  这个规则也是用来帮我们检查错误的. 这也是如果你把`let`换成`var`以后很容易发生的错误, 即使`let`是全局变量也如此.

  如果你在多个脚本中都使用了全局变量, 你最好用`var`来代替他. 如果你使用`let`, 那么这些脚本加载时会报错.

  或者使用es6的modules. 这是以后讲的故事了.


  除了这些区别, `let`和`var`是一样的. 他们都支持用逗号分隔声明多个变量, 也都支持解构赋值.

注意`class`的声明行为类似`let`. 所以如果你写了多个`class`, 第二次相同名字就会报重新定义的错.

## `const`

好~ 再来一个!

es6还提供了第三个关键字: `const`.

被`const`修饰的变量行为与`let`一样, 除了: 在声明以外的地方为变量赋值都会得到`SyntaxError`.

```js
const MAX_CAT_SIZE_KG = 3000; // 🙀

MAX_CAT_SIZE_KG = 5000; // SyntaxError
MAX_CAT_SIZE_KG++; // nice try, but still a SyntaxError
```

自然地, 如果你不能不给任何值地声明一个`const`.

```js
const theFairest;  // SyntaxError, you troublemaker
```

---

es in depth 系列 [目录](/2016/09/10/es6-in-depth-content/) [原文地址](https://hacks.mozilla.org/category/es6-in-depth/)