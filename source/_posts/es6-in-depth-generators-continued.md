---
title: es6 in depth 生成器-续
date: 2016-09-10 17:27:44
categories: 代码
tags: [ES2015,es6-in-depth,翻译]
---

上一次我讲了生成器是es6里最有魔性的特性. 我讲了为什么他会是将来的异步编程. 然后我说了:
	但我觉得这篇文章已经够长了. 就像生成器一样, 我们也要暂停一下, 然后在以后的时间继续.
现在到了这个时间了.

如果没看过生成器第一篇一定要去看一下.

## 快速回顾

上次我们重点观察了生成器的基本行为. 也许觉得有一点奇怪, 但并不难理解. 一个生成器方法在很大程度上都和普通方法是一样的. 主要的不同在于生成器的方法体中没有一次运行完所有代码. 一开始会运行一点, 然后每次运行到`yield`表达式的时候会暂停一下.

在生成器的第一部分已经有了详细的解释, 但我们没有写一个贯穿第一部分的例子, 那现在来做一下.

```js
function* someWords() {
  yield "hello";
  yield "world";
}

for (var word of someWords()) {
  alert(word);
}
```

这样一段代码已经够了. 但如果你想知道一切都是如何发生的, 运行的时候所有变量发生了什么, 那么会比较复杂, 会想以下这样:

```
SCENE - INTERIOR COMPUTER, DAY

FOR LOOP stands alone onstage, wearing a hard hat and
carrying a clipboard, all business.

                          FOR LOOP
                         (calling)
                        someWords()!
                              
The GENERATOR appears: a tall, brass, clockwork gentleman.
It looks friendly enough, but it's still as a statue.

                          FOR LOOP
               (clapping her hands smartly)
           All right! Let's get some stuff done.
                     (to the generator)
                          .next()!

The GENERATOR springs to life.

                         GENERATOR
               {value: "hello", done: false}

It freezes in a goofy pose.

                          FOR LOOP
                           alert!

Enter ALERT at a sprint, wide-eyed and breathless. We sense
he's always like that.

                          FOR LOOP
                   Tell the user "hello".

ALERT turns around and sprints offstage.

                           ALERT
                   (offstage, screaming)
                      Stop everything!
          The web page at hacks.mozilla.org says,
                          "hello"!

A few seconds' pause, then ALERT races back on, crossing all
the way over to FOR LOOP and skidding to a halt.

                           ALERT
                     The user says OK.

                          FOR LOOP
               (clapping her hands smartly)
           All right! Let's get some stuff done.
              (turning back to the GENERATOR)
                          .next()!

The GENERATOR again springs to life.

                         GENERATOR
               {value: "world", done: false}

It freezes in a different goofy pose.

                          FOR LOOP
                           alert!

                           ALERT
                     (already running)
                           On it!
                   (offstage, screaming)
                      Stop everything!
          The web page at hacks.mozilla.org says,
                          "world"!

Again, a pause, then ALERT trudges back onstage, suddenly
crestfallen.

                           ALERT
               The user says OK again, but...
             but please prevent this page from
               creating additional dialogues.

He exits, pouting.

                          FOR LOOP
               (clapping her hands smartly)
           All right! Let's get some stuff done.
              (turning back to the GENERATOR)
                          .next()!

The GENERATOR springs to life a third time.

                         GENERATOR
                       (with dignity)
               {value: undefined, done: true}

Its head comes to rest on its chest and the lights go out of
its eyes. It will never move again.

                          FOR LOOP
                  Time for my lunch break.

She exits.

After a while, the GARBAGE COLLECTOR enters, picks up the
lifeless GENERATOR, and carries it offstage.
```

好~ 以上的东西并不哈姆雷特, 但你知道了个大概了.

正如你看到的, 生成器对象最先出现后就暂停了. 当`.next()`方法调用后会被唤醒再运行一小段.

这个行为是同步并且单线程的. 注意到实际上只有一个线程在工作. 也就是不同生成器不会打断或者参与互相的工作. 他们互相独立工作, 互不影响.(就像莎士比亚一样)

在一些情况下生成器是为`for-of`循环工作的. 会由一些代码顺序地调用`.next()`方法, 即使你没有在代码中写. 我的代码中显性调用了, 但你的程序里不需要主动调用, 而可以使用`for-of`循环, 因为他本身设定就是和生成器一起工作的, 通过[iterator接口](http://www.ecma-international.org/ecma-262/6.0/index.html#sec-iterator-interface).

总结一下:

+	生成器对象是一个yield出值的机器人.
   +每个机器人的制造都包括一段简单的代码: 生成器代码的方法体.

## 怎么关闭一个生成器

生成器有一些比较繁琐的额外的特性, 这些我没有在第一部分中提到:

+	`generator.return()`
   +`generator.next()`的可选参数
   +`generator.throw(error)`
   +`yield*`


我跳过了他们是因为如果不知道这些特性为什么存在就很难去注意他们, 更难让他们在你脑子里留下印象. 而我们已经更多的在向我们的程序里去怎么使用生成器了, 我们来看下原因. 

以下是一些你可能在某个场景写的代码:

```js
function doThings() {
  setup();
  try {
    // ... do some things ...
  } finally {
    cleanup();
  }
}

doThings();
```

其中cleanup方法可能会去关闭一些连接或者文件, 来释放系统资源, 或者只是更新dom匀速来关闭他的'正在更新'的标志. 我们希望这些动作在代码的最后执行, 无论是否成功, 所以这些代码写在了`finally`块中.

如果用生成器写会是什么样的呢?

```js
function* produceValues() {
  setup();
  try {
    // ... yield some values ...
  } finally {
    cleanup();
  }
}

for (var value of produceValues()) {
  work(value);
}
```

这看起来没有问题, 但这有个小问题: `work(value)`的调用不在`try`块中. 如果这里抛出了异常, 那cleanup的步骤会发生什么呢?

或者假设`for-of`循环存在`break`或者`return`语句. 那么会对于cleanup步骤有什么影响呢?

es6支持着你, 所以随便如何(finally)都会执行.

当我们刚开始讨论遍历器与`for-of`循环的时候, 我们说到了遍历器接口有一个可选项`.return()`方法, 这个方法语言会在遍历器存在且表明遍历结束的时候自动调用. 生成器是支持这个方法的. 调用`myGenerator.return()`会使生成器运行`finally`块并且退出, 感觉就像是当前的`yield`语句被秘密地变成了`return`语句.

这个特性在使用中是如何表现的呢? 生成器会在任务中暂停需要一些步骤, 就像造一个大楼. 突然地一个人抛出了个错误! `for`循环捕捉到了错误并把它放在一边. 告诉生成器去执行`.return()`. 生成器不紧地拆除了所有脚手架并停止了工作. 当`for`循环的错误堆积, 那么普通的错误处理讲会继续.

## 生成器的作用

直到现在, 我们讲到的生成器与他的用户的事情还都是单方面的, 就像以下的场景:

![图意为单方面调用-相应的生成器](https://2r4s9p1yi1fa2jd7j43zph8r-wpengine.netdna-ssl.com/files/2015/07/generator-messages-small.png)

用户发起请求, 生成器来回复需求. 但这不是生成器编程的唯一方式.

在第一部分, 我说过生成器可以被用作异步编程. 你现在使用回调或者promise做的事也许可以用生成器来代替的. 你可能会问那么他会是如何工作的呢. 他是如何yield(毕竟他是生成器唯一特殊的东西)满足需求的呢? 原来, 异步编程带啊不只是依靠yield. 需要做一些别的事. 他需要从文件或数据库中来的数据. 他的激活依靠服务器与请求. 然后回到事件的循环中来等待异步操作完成. 那生成器具体做了什么呢? 不适用回调, 生成器如何知道从文件的数据读到, 或是服务器给了响应呢?

开始前, 我们先想想看, 如果调用`.next()`的时候传入一些参数, 只通过这个改变, 我们会得到一个全新的对话:

![在next方法中带着参数, 生成器返回了不同的东西](https://2r4s9p1yi1fa2jd7j43zph8r-wpengine.netdna-ssl.com/files/2015/07/generator-messages-2-small.png)

并且生成器的`.next()`方法确实使用了一些可选的参数, 通过`yield`返回了不同的结果. 因为`yield`不是像`return`一样的语句, 他可以接受参数, 只要生成器中写了.

```
var results = yield getDataAndLatte(request.areaCode);
```

这句代码做了很多事:

+ 调用了`getDataAndLatte()`. 我们看到了方法返回的字符串`"get me the database records for area code…"`正如上面截图看到的.
+ 暂停了生成器, yield了一个字符串
+ 在这个时间点, 随便可以暂停多久.
+ 最后, 有人调用了`.next({data:…, coffee:…})`. 我们在本地变量中保存了`results`再继续运行下一行代码.

想看上下文的话, 下面是对话的所有代码:

```js
function* handle(request) {
  var results = yield getDataAndLatte(request.areaCode);
  results.coffee.drink();
  var target = mostUrgentRecord(results.data);
  yield updateStatus(target.id, "ready");
}
```

注意`yield`的意义仍然和我之前说过的一样: 暂停生成器并且给调用者返回一个值.  那么这些东西是如何变化的呢? 这个生成器期望他的调用者支持一些指定的行为. 看起来就像希望调用者是个行政助理的角色.

普通的方法就和这样的不同. 他们需要为了调用者的需求必须自己存在. 但生成器是一种你可以与他对话的代码, 这样就让生成器和他的调用者有发生更多关系的可能.

那么这个生成器运行的行政助手看起来是什么样的呢? 不需要很复杂, 可以如下:

```js
function runGeneratorOnce(g, result) {
  var status = g.next(result);
  if (status.done) {
    return;  // phew!
  }

  // The generator has asked us to fetch something and
  // call it back when we're done.
  doAsynchronousWorkIncludingEspressoMachineOperations(
    status.value,
    (error, nextResult) => runGeneratorOnce(g, nextResult));
}
```

 我们想要创建一个生成器并运行他一次, 像这样:

```js
runGeneratorOnce(handle(request), undefined);
```

上次我提到了`Q.async()`是一个lib实现的把生成器作为异步编程. `runGeneratorOnce`就是其中的一种. 实际中, 生成器并不会yield字符串, 可能会yield`promise`对象.

如果你已经理解了promise, 那么你也理解生成器了, 也许你已经想改写一下`runGeneratorOnce`来支持promise了. 做起来比较难, 但一旦你实现了, 你就可以写出复杂的使用平直的代码的promise, 而不是`.then()`或者回调的异步算法了.

## 如何扩展一个生成器

你有注意`runGeneratorOnce`是如何处理错误的吗? 错误被忽略了!

好, 这并不好. 我们应该是希望生成器可以正常报错的. 并且生成器也支持: 你可以使用`generator.throw(error)`而不是`generator.next(result)`. 这会导致`yield`语句的地方来抛出, 和`.return()`一样, 生成器也会被终止. 但如果yield的点实在`try`块里, 并且`catch`与`finally`块都存在, 那么生成器可能会恢复运行.

修改`runGeneratorOnce`来保证`.throw()`被正确调用也是一个比较难的事. 要记得生成器中的异常抛出都要被传播到调用者上. 所以`generator.throw(error)`只能抛出被生成器捕获的异常!

以下是生成器到达`yield`表达式而暂停的可能情况的集合:

+ 有人调用了`generator.next(valu)`, 这个情况中, 生成器会继续执行到剩下的部分.
+ 有人调用了`generator.return()`, 也可能传入了参数. 在这个情况中, 生成器不会做任何继续执行的动作, 只会去执行`finally`块中的代码.
+ 有人调用了`generator.throw(error)`.  生成器会与做`yield`一样的行为并调用抛出`error`的方法.
+ 或者有人什么都没有做. 生成器也许会永远暂停. (是的, 也有可能生成器永远停在`try`块中而永远不会执行`finally`块, 这样的生成器也可以被垃圾回收机制回收.)

这不比解释一个老式到达方法调用麻烦. 只是, `.return()`真的是一个新的可能性.

事实上, `yield`与方法调用有许多相同处. 你调用了一个方法后, 你其实也是暂停了, 不是吗? 一个方法调用可以控制, 他可以return, 也可以throw, 或者也可以永远循环下去.

## 生成器一起工作

让我给你看另一个特性.假设我写了一个生成器把两个可遍历对象联系起来:

```js
function* concat(iter1, iter2) {
  for (var value of iter1) {
    yield value;
  }
  for (var value of iter2) {
    yield value;
  }
}
```

es6提供了一个简写的方法:

```js
function* concat(iter1, iter2) {
  yield* iter1;
  yield* iter2;
}
```

一个普通的`yield`表达式yield一个值, `yield*`表达式会消费整个遍历器并yield所有值.

这样的语法也解决了其他有趣的问题: 如何在生成器中调用另一个生成器. 在普通方法中, 我们可以把一个方法的一串代码分开到几个方法中, 并不改变他的行为. 显然我们也希望生成器可以这样做. `yield*`解决了这个问题.

```js
function* factoredOutChunkOfCode() { ... }

function* refactoredFunction() {
  ...
  yield* factoredOutChunkOfCode();
  ...
}
```

想一想一个机器人流畅的一个个完成任务. 你可以知道用生成器为基础的项目来保持代码整洁, 组织性有多重要.

## 退场

好了, 这就是生成器的全部内容! 下周我们将讨论es6的proxies.

---

es in depth 系列 [目录](/2016/09/10/es6-in-depth-content/) [原文地址](https://hacks.mozilla.org/category/es6-in-depth/)