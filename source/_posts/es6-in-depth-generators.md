---
title: es6 in depth 生成器 
date: 2016-09-10 17:24:54
categories: 胡乱编码
tags: [javascript,深入es6,翻译,入门]
---

这篇文章我很激动. 今天我们将要讨论es6最魔性的特性.

我说的魔性是什么意思? 对新手来说这个特性与已知的js差别比较大. 刚开始看的时候可能觉得很神秘. 总之他颠覆了语言的行为! 如果不是魔性那还是什么呢.

不仅如此: 这个特性还简化了代码, 神奇地纠正了"callback hell"(多层回调).

我是不是说得太抽象了? 那就开始研究然后你自己感受吧.

## 生成器介绍

什么是生成器?

让我们从看一个生成器开始.

```js
function* quips(name) {
	yield "hello " + name + "!";
	yield "i hope you are enjoying the blog post";
	if(name.startWith('X')) {
		yield "it's cool your name start with X, " + name;
	}
	yield "see you later";
}
```

这是[会说话的猫](http://people.mozilla.org/~jorendorff/demos/meow.html)的一部分代码, 这可能是现在网上最重要的应用. ([点击链接来玩玩吧](http://people.mozilla.org/~jorendorff/demos/meow.html)你觉得疑惑的时候可以回来这里看解释).

他看起来是一种函数吧? 他的名字是*生成器函数(generator-function)*, 和函数有很多共同点. 但你会发现有以下两点不同:

+ 普通函数以`function`开头, 生成器函数以`function*`开头.
+ 在生成器函数内部`yield`是一个类似于`return`的关键字.不同点是普通函数(生成器函数也是如此)只能return一次, 而生成器函数可以yield任意次数. `yield`表达式可以被*延缓执行, 并在稍后被继续.*

就是这些, 以上是普通函数和生成器函数的大的区别之处. 普通函数不能暂停执行, 而生成器函数可以哦.

## 生成器能干啥

当你调用生成器函数`quips()`会发生什么呢?

```js
> var iter = quips("jorendorff");
  [object Generator]

> iter.next();
  { value: "hello jorendorff!", done: false }

> iter.next();
  { value: "i hope you are enjoying the blog posts", done: false }

> iter.next();
  { value: "see you later!", done: false }

> iter.next();
  { value: undefined, done: true }

```

你可能对普通函数的行为很熟悉. 当你调用他们, 他们马上执行, 运行到return或者报错为止. 这是js程序员的本能.

看起来相同的对于生成器的调用:`quips('jorendorff')`. 但你调用了生成器以后什么也不会执行. 而是返回了一个生成器对象(*generator object*)(就是上面代码中的`iter`). 你可以认为生成器对象是'被暂停的函数调用'. 正是暂停在生成器的头部, 执行他的第一行代码的前面.

每次你调用生成器的`.next()`方法, 函数会执行到下一个`yield`表达式.

这就是为什么每次我们调用了`iter.next()`都会得到一个不同的字符串. 这是`quips()`函数体中`yield`表达式产生的.

当执行到了最后的`iter.next()`, 我们走到了生成器方法的最后, 所以`.done`属性变为了`true`. 走到了方法的最后就好比返回了`undefined`, 这就是为什么`.value`的结果是undefined.

现在可以回到那个猫咪的应用来修改代码, 试试增加一个`yield`在循环中会发生什么?

技术层面来说, 每次生成器执行了`yield`, 他的栈的内容-本地变量, 参数, 临时变量, 当前执行的位置-都被移除了当前栈. 但生成器留了一份栈内容的复制来使调用`.next()`有响应并继续执行.

有必要指出**生成器不是多线程**. 多线程的语言中, 多个代码片可以同时运行, 经常会导致抢跑执行, 不确定性, 和不错的表现. 生成器完全不是那样的. 生成器随着调用地单线程执行. 执行顺序是有序的, 确定的, 不会同时运行. 和多线程系统不同, 生成器只会一直以`yield`标记的点挂在运行体上.

好了, 我们知道了什么是生成器了. 我们知道了生成器是如何运行的, 如何暂停运行的. 那么现在有个大问题, 他这个奇怪的能力有什么用呢?

## 生成器是遍历器

上周我们知道了es6的遍历器不只是单纯的内置类, 而是一个语法的拓展. 我们可以通过实现`[Symbol.iterator]`和`.next()`来创建自己的遍历器.

但实现接口虽是小工作但每次都要去做. 我们来看看实际代码里是怎么实现遍历器接口的. 我们先来做个简单的`range`遍历器, 他的作用是像老式的C的`for(;;)`循环一样一个个数数.

```js
//这样会'ding'三下
for (var value of range(0, 3)) {
	alert("ding at floor#" + value);
} 
```

有个解决方法, 可以使用es6的类 (如果class语法还不清晰, 不要担心-我们会在以后的文章讲到)

```js
class RangeIterator {
  constructor(start, stop) {
    this.value = start;
    this.stop = stop;
  }

  [Symbol.iterator]() { return this; }

  next() {
    var value = this.value;
    if (value < this.stop) {
      this.value++;
      return {done: false, value: value};
    } else {
      return {done: true, value: undefined};
    }
  }
}

// Return a new iterator that counts up from 'start' to 'stop'.
function range(start, stop) {
  return new RangeIterator(start, stop);
}
```

这种遍历器的实现很像`Java`或是`Swift`. 这样还是可以的, 但这样很不仔细, 这样的代码会不会有什么bug? 很难说. 他看起来就像原来的`for(;;)`循环. 而我们正在尝试的是废除这样的循环.

到这儿你可能对遍历器有点灰心了. 他用起来可能很厉害, 但很难去实现. 

你应该不会去开发一种自创的, 很绕的, 新的控制流程来让遍历器更容易构建, 但我们有了生成器, 要不要试试?

```js
function* range(start, stop) {
  for (var i = start; i < stop; i++ )
    yield i;
}
```

上面这4行很简单的代码替代了23行对`range()`的实现. 包括整个`RangeIterator`类. 做到这点是因为生成器就是遍历器. 所有生成器都有`.next()`方法和[Symbol.iterator]. 你只需要写循环行为的逻辑就可以了.

不用生成器地去实现一个遍历器就像用被动语态写一篇很长的邮件. 如果没有告诉你这只是一个可选项的时候你可能最后会觉得这个代码太麻烦了. `RangeIterator`又长又怪因为这段代码没有用循环地去函数. 生成器是一个解决方案.

我们还可以怎么利用生成器是遍历器这个特性?

+ **让任何对象可遍历.** 只需写一个遍历`this`的生成器, yield每个键值. 然后把这个生成器作为对象的`[Symbol.iterator]`属性.
+ **简化组合成数组的函数.** 假设你有一个方法希望每次调用返回一个数组结果集, 类似下面的:

```js
// Divide the one-dimensional array 'icons'
// into arrays of length 'rowLength'.
function splitIntoRows(icons, rowLength) {
  var rows = [];
  for (var i = 0; i < icons.length; i += rowLength) {
    rows.push(icons.slice(i, i + rowLength));
  }
  return rows;
}
```

生成器让这种代码更短了:

```js
function* splitIntoRows(icons, rowLength) {
  for (var i = 0; i < icons.length; i += rowLength) {
    yield icons.slice(i, i + rowLength);
  }
}
```

唯一的不同行为是生成器没有一次性计算出结果并返回, 而是返回了一个遍历器, 然后按需执行并返回.

+ **非通常的结果集.** 你不能构造一个无限的数组. 但你可以返回一个产生无限数据的生成器. 这样调用者不管需要多少返回值都可以拿到.

+ **重构复杂的循环.** 你有一个很丑很大的函数吗? 你想不想把他分成两个稍简略的部分? 生成器就像一把重构你代码的新刀. 当你遇见复杂的循环, 你可以把产生数据的部分代码剥离成一个生成器, 然后把循环变为`for (var data of myNewGenerator(args))`.

+ **利用遍历器的工具.** es6没有为filter, map提供拓展lib, 而生成器可以遍历任何数据结构. 生成器可以用很少的几行代码来构建成你需要的工具.

打个比方, 假设你你需要像`Array.prototype.filter`一样处理DOM节点列表, 而不只像数组一样, 以下是一部分代码:

```js
function* filter(test, iterable) {
  for (var item of iterable) {
    if(test(item))
      yield item;
  }
}
```

生成器是不是很有用? 当然了. 他可以用简单得惊人的方法来实现自定义遍历器, 而遍历器正式es6新的遍历数据的方式!

但以上还不是生成器全部可以做的事. 你能用他做的最重要的事还我还没开始说呢.

## 生成器与异步代码

以下是一些我写过的js代码:

```js
          };
        })
      });
    });
  });
});
```

也许你也在你的代码里见过如此的东西. [异步编程](http://www.html5rocks.com/en/tutorials/async/deferred/)通常需要回调, 意味着每次你需要做一件事情的时候就要多写一个匿名函数. 所以如果你在很少的代码里做了三件事, 你会看到三个缩进块, 而不是简单的三行代码.

以下也是我写过的一些js代码:

```js
}).on('close', function () {
  done(undefined, undefined);
}).on('error', function (error) {
  done(error);
});
```

异步编程api有的是错误处理而不是异常处理. 不同的api有不同的规定. 大多数错误都会被默认得静默处理, 另外一部分规定普通的成功回调也会被默认静默处理.

生成器提供了我们不需要这么做的希望.

[Q.async()](https://github.com/kriskowal/q/tree/v1/examples/async-generators)是一个实验性质的尝试, 用promise和生成器来使异步代码看起来像同步代码. 比如:

```js
function makeNoise() {
  shake();
  rattle();
  roll();
}

// Asynchronous code to make some noise.
// Returns a Promise object that becomes resolved
// when we're done making noise.
function makeNoise_async() {
  return Q.async(function* () {
    yield shake_async();
    yield rattle_async();
    yield roll_async();
  });
}
```

主要的区别在于异步版本必须在每个调用异步方法的地方加上`yield`关键字.

如果在`Q.async`版本加上像`if`语句或`try/catch`代码块实际只是加上了普通的异步方法. 和别的异步代码比, 这样不会像在学一门新语言一样.

如果你对这些比较深入了, 可以去看一下James Long的[对这个专题的深入研究](/2016/09/16/a-study-on-solving-callbacks-with-javascript-generators).

所以生成器为异步编程模型对人脑更友好指了一条明道. 这些工作仍在进行中. 在其余的研究中有有帮助的更好的语法. [异步编程的一个提案](https://github.com/tc39/ecmascript-asyncawait)建立在promise和generator上, 也吸收了C#的灵感, 已经在[es7草案](https://github.com/tc39/ecma262)上了.

## 我们什么时候需要用这些疯狂的东西?

在服务端, 我们可以在node上用es6了.

在浏览器, 可以用现代的浏览器或者用Babel来写es6.

有一些组织说: 生成器第一次被引入js, 和python的生成器很像.

## yields;

关于生成器还有一些要说的. 我们还没有讲到`.throw()`和`.return()`方法, `.next()`方法的可选参数, 或者是`yiled*`语法. 但我觉得这篇文章已经够长了. 就像生成器一样, 我们也要暂停一下, 然后在以后的时间继续.

但在下周, 我们会稍微改变下节奏. 我们已经一下子说了两个比较深的主题了. 下次可以说一些不会改变你生活的es6特性. 一些又简单又明显有用的. 能让你会心一笑的. es6也有一些这样的特性的.

接下来: 一些会对你每天都要写的代码有影响的东西. 请期待下周的es6-in-depth之模板字符串.

---

es in depth 系列 [目录](/2016/09/10/es6-in-depth-content/) [原文地址](https://hacks.mozilla.org/category/es6-in-depth/)