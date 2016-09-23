---
title: es6 in depth rest参数与默认参数
date: 2016-09-10 17:25:30
categories: 代码
tags: [ES2015,es6-in-depth,翻译]
---
今天,我们来讲一下es6让js语法更有表达性的两个特性: rest参数和默认参数.

## rest参数

这是一个普遍的需求, 当需要创建一个可以接受任何数量参数的函数, 叫做无限参数函数(variadic function). 比如[String.prototype.concat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/concat)可以接受任何数量的参数. 通过rest参数, es6提供了一个新的方法来写无限参数函数.

来写一个例子, 我们写了一个`containsAll`函数来检查是否一个字符串包含一些字符串. 比如`containsAll('banana', 'b', 'nan')会返回`true`, `containsAll('banana','c','nan')`会返回`false`.

如果是传统的方法实现是以下的样子:

```js
function containsAll(haystack) {
  for (var i = 1; i < arguments.length; i++) {
    var needle = arguments[i];
    if (haystack.indexOf(needle) === -1) {
      return false;
    }
  }
  return true;
}
```

上面的实现使用了[arguments对象](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/arguments), 一个包含了被传入函数的参数的类数组的对象. 这个代码当然已经实现了我们的需求, 但他的可读性不是最理想. 函数参数只能列出有限的参数. 我们不能直接看出函数可以接受无限参数. 另外我们必须小心地从`1`开始遍历`arguments`而不是`0`, 因为`auguments[0]`代表固定的参数. 如果我们想在参数前再加一个参数, 我们就要重写循环了. rest参数解决了以上所有问题. 以下是rest参数的`containsAll`实现代码:

```js
function containsAll(haystack, ...needles) {
  for (var needle of needles) {
    if (haystack.indexOf(needle) === -1) {
      return false;
    }
  }
  return true;
}
```

这个包含了特殊语法`...needles`的函数做了和上一个函数一样的事. 我们来看看调用了`containsAll('banana', 'b', 'nan')`后发生了什么. 固定的函数`banana`和通常一样是被传入的第一个参数. 前面带有省略号的`needles`代表他是一个*rest参数*. 所有被传入的其他的参数都被放进一个数组并赋值到`needles`变量中. 在我们的调用例子中, `needles`就是`['b', 'nan']`. 然后函数和平时一样继续执行. (注意我们用了es6的`for-of`循环)

函数只有最后一个参数可以被标记为rest参数. 在调用中, rest参数前的参数获得与通常是一样的. 并且任何其他'多余'的参数会被塞入rest参数. 如果不再有其他额外的参数, rest参数的值称为一个简单的空数组; rest参数永远不会为`undefined`.

## 默认参数

通常, 一个函数的参数不要求传入所有的参数, 一些参数有默认值不需要每次都传值是合理的. javascript向来都有一种不灵活的默认参数的形式; 参数没有被传入的时候默认为`undefined`. es6引入了一个新的方法来指定参数的默认值.

以下是例子. (反引号是模板字符串的特性, 在上篇文章有提及)

```js
function animalSentence(animals2="tigers", animals3="bears") {
    return `Lions and ${animals2} and ${animals3}! Oh my!`;
}
```

在每个参数中, `=`的值代表如果调用时没传入值的默认参数. 所以
`animalSentence()`会返回
` "Lions and tigers and bears! Oh my!"`,
 `animalSentence("elephants")`会返回
`"Lions and elephants and bears! Oh my!"`,
`animalSentence("elephants", "whales")`会返回
`"Lions and elephants and whales! Oh my!"`.

默认参数还有一些细节:

+   和Python不同, **默认参数在函数被调用时**被从左到右的赋值. 这意味着默认参数表达式可以使用之前的参数. 比如我们可以让之前的函数更溜如下:
    ```js
    function animalSentenceFancy(animals2="tigers",
        animals3=(animals2 == "bears") ? "sealions" : "bears")
    {
      return `Lions and ${animals2} and ${animals3}! Oh my!`;
    }
    ```
    然后`animalSentenceFancy("bears")`的调用会返回
    `"Lions and bears and sealions. Oh my!"`.

+   传入`undefined`会被认为没有传入任何参数. 所以
    `animalSentence(undefined, "unicorns")`的返回结果是
    `"Lions and tigers and unicorns! Oh my!"`.

+   没有被保留默认值的参数默认为undefined, 所以
    ```js
    function myFunc(a=42, b) {...}
    ```
    是被允许的, 并等价于
    ```js
    function myFunc(a=42, b=undefined) {...}
    ```

## 废弃`arguments`

我们现在知道了rest参数和默认参数可以代替`arguments`的使用了. 所以废弃`arguments`可以使我们的代码更好更可读. `arguments`的魔性也造成了[优雅化js的头疼](https://github.com/petkaantonov/bluebird/wiki/Optimization-killers#3-managing-arguments).

我们希望rest参数和默认参数可以完全代替`arguments`. 作为第一步, 使用rest参数和默认参数的函数就不允许使用`arguments`. 鉴于`arguments`不太会被很快移除, 如果这样的话, 我们还是尽量用rest参数和默认参数去代替他吧.

## 浏览器支持

除了火狐15+对此特性有支持, 其他浏览器都不太行, 所以建议用babel.

## 结论

虽然技术上说rest参数和默认参数没有改变任何js行为, 但他让js函数声明更有表现力, 更可读. 快乐的调用吧!

---

下周我们会讲另外一个es6的特性, 他简单优雅, 实际, 每天都会用到. 他用了类似你已经在写的数组对象类似的语法, 我们会用新的语法来拆分数组和对象. 什么意思呢? 为什么要把对象拆开呢? 期待下周的解构赋值吧.

---

es in depth 系列 [目录](/2016/09/10/es6-in-depth-content/) [原文地址](https://hacks.mozilla.org/category/es6-in-depth/)
