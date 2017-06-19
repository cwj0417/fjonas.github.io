---
title: es6 in depth 解构赋值
date: 2016-09-10 17:25:56
categories: 胡乱编码
tags: [javascript,深入es6,翻译,入门]
---

解构赋值允许你通过和数组对象相近的语法来使用数组或对象的属性. 他的语法非常简单. 而且还比传统的获取属性方法更清晰.

<!--more-->

## 什么是解构赋值?

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

## 解构数组与可遍历数据

我们已经看了一个解构赋值的示例了, 他的语法基本形式是:

```js
[ variable1, variable2, ..., variableN] = array;
```

这样做会把数组中对应的变量赋值给variable1到variableN. 如果你想同时声明变量, 你可以在赋值前加上表示声明的`var`, `let`, `const`.

```js
var [ variable1, variable2, ..., variableN ] = array;
let [ variable1, variable2, ..., variableN ] = array;
const [ variable1, variable2, ..., variableN ] = array;
```

事实上上面代码的`variable`并不正确, 因为你可以无限层嵌套:

```js
var [foo, [[bar], baz]] = [1, [[2], 3]];
console.log(foo);
// 1
console.log(bar);
// 2
console.log(baz);
// 3
```

而且你可以跳过数组的一些属性:

```js
var [,,third] = ["foo", "bar", "baz"];
console.log(third);
// "baz"
```

你也可以用"rest"风格来拿到尾部的多个内容.

```js
var [head, ...tail] = [1, 2, 3, 4];
console.log(tail);
// [2, 3, 4]
```

如果你尝试获取不存在的变量, 你会获得`undefined`, 就像你去获取一个不存在的索引一样:

```js
console.log([][0]);
// undefined

var [missing] = [];
console.log(missing);
// undefined
```

注意解构以后为数组赋值也可以在任何可遍历对象上执行:

```js
function* fibs() {
  var a = 0;
  var b = 1;
  while (true) {
    yield a;
    [a, b] = [b, a + b];
  }
}

var [first, second, third, fourth, fifth, sixth] = fibs();
console.log(sixth);
// 5
```
## 解构对象

对象的解构赋值让我们可以把值绑定到对象的不同属性上. 你指定的绑定属性需要和你解构的字段一样.

```js
var robotA = { name: "Bender" };
var robotB = { name: "Flexo" };

var { name: nameA } = robotA;
var { name: nameB } = robotB;

console.log(nameA);
// "Bender"
console.log(nameB);
// "Flexo"
```

当我们需要赋值的变量属性名一样的时候下面这个快捷的语法很有用:

```js
var { foo, bar } = { foo: "lorem", bar: "ipsum" };
console.log(foo);
// "lorem"
console.log(bar);
// "ipsum"
```

和数组的嵌套解构一样, 对象也可以这样:

```js
var complicatedObj = {
  arrayProp: [
    "Zapp",
    { second: "Brannigan" }
  ]
};

var { arrayProp: [first, { second }] } = complicatedObj;

console.log(first);
// "Zapp"
console.log(second);
// "Brannigan"
```

同样的, 当你尝试获取一个不存在的属性后也会得到`undefined`:

```js
var { missing } = {};
console.log(missing);
// undefined
```

有一个需要注意的地方是, 你在没有声明变量前(没有`let`,`const`或`var`)进行了对象的解构赋值就会发生:(数组的话可以不声明)

```js
{ blowUp } = { blowUp: 10 };
// Syntax error
```

发生这个语法错误的原因是js语法会告诉引擎把`{`开头的语句都认为是一个语句块(打个比方, `{console}`会被认为是个合法的语句块). 解决的方法是在这个表达式两边加上括号.

```js
({ safe } = {});
// No errors
```

## 解构不是数组,对象,或可遍历对象的值

当你尝试去解构`null`或者`undefined`, 你会获得一个TypeError:

```js
var {blowUp} = null;
// TypeError: null has no properties
```

但你如果尝试解构类似布尔值, 数字, 字符串这些乱七八糟的数据类型时, 你会获得`undefined`:

```js
var {wtf} = NaN;
console.log(wtf);
// undefined
```

这看起来很莫名, 但仔细考虑原因其实很简单. 当我们使用了赋值语句, 待被解构的值需要被[转换为对象](https://tc39.github.io/ecma262/#sec-requireobjectcoercible)来被解构. 大多类型都可以被转为对象, 但是`null`和`undefined`无法被转换. 举一反三, 当给数组解构赋值时, 目标值需要[有遍历器](https://people.mozilla.org/~jorendorff/es6-draft.html#sec-getiterator).

## 默认值

你也可以在解构可能没有值的时候设置默认值:

```js
var [missing = true] = [];
console.log(missing);
// true

var { message: msg = "Something went wrong" } = {};
console.log(msg);
// "Something went wrong"

var { x = 3 } = {};
console.log(x);
// 3
```

## 解构赋值的实际应用

### 函数参数定义

作为开发者, 我们现在可以提供更人性化的api: 接受一个包含多个属性的对象而不需要使用者来记住每个参数的顺序. 我们可以使用解构赋值来简化我们取到对应属性的过程:

```js
function removeBreakpoint({ url, line, column }) {
  // ...
}
```
### 配置参数对象

展开上一个例子, 我们同样可以给解构参数的属性默认值. 当我们需要给有很多属性的参数对象配置一些合理的默认值时这个特性就很有用.举个例子, jQuery的`ajax`函数接受一个对象配置作为第二个参数, 所以可以被写成这样:

```js
jQuery.ajax = function (url, {
  async = true,
  beforeSend = noop,
  cache = true,
  complete = noop,
  crossDomain = false,
  global = true,
  // ... more config
}) {
  // ... do stuff
};
```

这样写避免了给每个属性的默认值重复写`var foo = config.foo || theDefaultFoo;`

### 与es6的遍历协议配合

es6定义了遍历器的协议, 在我们之前的章节讲过了. 当我们遍历[Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map)时, 会得到一系列的`[key, value]`对. 我们解构他时可以同时获得键和值:

```js
var map = new Map();
map.set(window, "the global");
map.set(document, "the document");

for (var [key, value] of map) {
  console.log(key + " is " + value);
}
// "[object Window] is the global"
// "[object HTMLDocument] is the document"
```

只遍历键:

```js
for (var [key] of map) {
  // ...
}
```

或者只遍历值:

```js
for (var [,value] of map) {
  // ...
}
```

### 多个返回值

语言特性里没有被假如返回多个值, 是因为没有必要, 因为你可以解构函数返回值:

```js
function returnMultipleValues() {
  return [1, 2];
}
var [foo, bar] = returnMultipleValues();
```

当然你也可以你也可以把对象作为返回值来解构:

```js
function returnMultipleValues() {
  return {
    foo: 1,
    bar: 2
  };
}
var { foo, bar } = returnMultipleValues();
```

以上两种都比创建一个临时变量优雅:

```js
function returnMultipleValues() {
  return {
    foo: 1,
    bar: 2
  };
}
var temp = returnMultipleValues();
var foo = temp.foo;
var bar = temp.bar;
```

或者使用延续传值的形式:

```js
function returnMultipleValues(k) {
  k(1, 2);
}
returnMultipleValues((foo, bar) => ...);
```

### 从commonJS模块中import name

还没有使用es6的模块? 还在用commonJS的模块? 没问题! 当我们引入某个commonJS的模块X, 模块X提供了比你需要得更多的功能是很正常的. 使用了解构, 你可以引入你需要的模块而避免污染你的命名空间:

```js
const { SourceMapConsumer, SourceNode } = require("source-map");
```

(如果你在用es6的模块, 你应该知道`import`声明有类似的语法)

## 结论

我们已经知道了解构在各种小场景中都很有用. 在火狐中我们已经有一些这方面的经验了. Lar Hansen在十年前就在Opera里引入了解构, Brendan Eich在后来给火狐添加了这个特性. 解构赋值已经被使用到了我们每天对js的使用中, 让我们的代码更简短.

---

es in depth 系列 [目录](/2016/09/10/es6-in-depth-content/) [原文地址](https://hacks.mozilla.org/category/es6-in-depth/)
