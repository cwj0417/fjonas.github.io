---
title: es6 in depth 模版字符串
date: 2016-09-10 17:25:09
categories: 胡乱编码
tags: [javascript,深入es6,翻译,入门]
---

上周我说了准备改变下节奏. 在遍历器和生成器之后我们要来说一些简单的东西. 一些不会烧脑的东西. 你们可以看下我最后有没有实现承诺.

现在开始, 我们将以一些简单的东西开始.

## 反引号

es6引入了一个新的字符串字面语法叫做*模版字符串*. 他看起来和普通字符串差不多, 除了用了反引号<code>\`</code>而不是通常的引号`'`或者`"`. 简单的例子的话就是以下的单纯字符串:

```js
context.fillText(`Ceci n'est pas une chaîne.`, x, y);
```

但他被叫做"模版字符串"而不是"只是加了反引号的无聊的老式字符串"是有原因的. 模版字符串带来了简单的javascript[字符串插值](https://en.wikipedia.org/wiki/String_interpolation). 就是看起来很舒服, 又很方便地把js的变量插入到字符串中.

有一万个方法可以使用他, 但最温暖人心的使用点是在显示错误信息:

```js
function authorize(user, action) {
    if (!user.hasPrivilege(action)) {
        throw new Error(
            `User ${user.name} is not authorized to do ${action}.`);
    }
}
```

在这个例子中, `${user.name}` 和`${action}`被叫做模版占位符. javascript会把`user.name`和`action`插入到输出字符串中. 这样就会输出这样的信息: `User joredorff is not authorized to do hockey.`(这是真的, 我确实没有hockey证书)

到了这里, 看起来只是相较`+`操作符稍微好一点的语法, 而以下的细节可能是你所期待的:

+ 模版占位符可以是任何javascript表达式. 函数调用, 算数表达式等等都是可以的. (如果你真的想, 甚至可以在模版字符串里嵌入另一个模版字符串, 这样叫做*模版嵌套*)
+ 如果插值内容不是字符串, 他会被用通常的规则转为字符串. 比如`action`是一个对象的话, 就会调用他的`toString()`方法.
+ 如果你想在模版字符串中写反引号, 那么就要把他转义为<code>\\\`</code>, 得到的效果如同<code>"\`"</code>.
+ 同样的, 如果你想要在模版字符串中包含这2个字母`${`, 你也可以用反斜杠把他们转义成`write \${ or $\{`.

和普通字符串不同, 模版字符串可以包含多行:

```js
$("#warning").html(`
  <h1>Watch out!</h1>
  <p>Unauthorized hockeying can result in penalties
  of up to ${maxPenalty} minutes.</p>
`);
```

所有在模版字符串里的空格, 包括新起一行和缩进, 都会被原样输出.

好, 因为我上周的承诺, 我要对大家的大脑健康负责. 所以这里给个提醒: 接下来的东西可能会让你略烦. 你可以现在停止阅读并且喝杯咖啡, 享受一下轻松没有烧起来的脑子. 当然谈, 继续回来看也没什么不好意思的. [Lopes Gonçalves](https://en.wikipedia.org/wiki/Lopes_Gon%C3%A7alves)有没有在证明了用船穿越赤道不会被怪物攻击也不会掉到地球边缘之后有没有探索整个南半球呢? 没有, 他回来了, 回家吃了顿好饭, 你也喜欢吃饭, 对吧?

## 反引号的未来

我们来说一下几个模版字符串没有做到的事情

+ 没有把特殊字符自动转义, 为了避免[跨站脚本攻击(XSS)](http://www.techrepublic.com/blog/it-security/what-is-cross-site-scripting/), 你仍需要对待普通的连续字符串一样小心处理不能信任的数据.
+ 没有明确与[i18n类库](http://yuilibrary.com/yui/docs/intl/)(把你代码显示的语言国际化)的交互. 模版字符串不会处理语言相关的数字和日期的格式化.
+ 不能替代类似[Mustache](https://mustache.github.io/)和[Nunjucks](https://mozilla.github.io/nunjucks/)的模版类库.
打个比方, 在某种需求下, 模版字符串没有内置的for循环模版来把数组显示在html上.

es6还提供了一个比较搞的模版字符串, 给js开发者和类库设计者提供了处理上述限制的可能性. 这个特性叫做*标签模版(tagged templates).*

标签模版的语法很简单. 只是在模版字符串的开头多了一个额外的*tag(标签)*. 对于上面第一个不足点, 标签可以为`SaferHTML`, 我们将用这个标签来处理上述提到的第一个限制:自动转义特殊字符.

注意`SaferHTML`并不是es6标准库提供的东西, 而是我们之后要来自己实现的.

```js
var message = 
    SaferHTML`<p>${bonk.sende} has sent you a bonk.</p>`;
```

这里的标签是一个简单的标识符`SaferHTML`, 标签也可以是一个属性, 类似`SaferHTML.escape`, 或者一个方法调用, 类似`SaferHTML.escape({unicodeControlCharacter: false})`. (准确地说, 任何es6[成员表达式或者调用表达式](https://tc39.github.io/ecma262/#sec-left-hand-side-expressions)都可以作为标签.)

没有被标签的模版字符串是简单字符串拼接的简写方式. 标签模版字符串是用剩余其他的字符串的简写, 其实全是*方法调用*.

所以以上的代码是等价于:

```js
var message = 
    SaferHTML(templateData, bonk.sender);
```

`templateData`是一个我们用js写的包含模版各个部分的固定的数组. 数组需要有两部分组成, 因为标签模版是被占位符分割的两个字符串的部分. 所以`templateData`可能会是`Object.freeze(["<p>", " has sent you a bonk. </p>"])`.

(实际上`templateData`还有一个存在的属性. 我们在本文中不会用, 但我为了完整性所以说一下: `templateData.raw`是一个包含数组所有部分的数组, 但看起来像源代码的感觉, 因为有像`\\n`类似的字符, 而不是转化以后的缩进等. 标准的标签[String.raw](https://tc39.github.io/ecma262/#sec-left-hand-side-expressions)用了这个.)

这样可以让`SaferHTML`有一万个可能去自由的操作和编译字符串和占位符.

继续看下去前, 你可能想猜出`SaferHTML`需要做些什么, 然后试着自己去实现他. 毕竟只是一个函数. 你可以在浏览器控制台中测试一下你的代码.

答案可能是以下这样的:

```js
function SaferHTML(templateData) {
  var s = templateData[0];
  for (var i = 1; i < arguments.length; i++) {
    var arg = String(arguments[i]);

    // Escape special characters in the substitution.
    s += arg.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

    // Don't escape special characters in the template.
    s += templateData[i];
  }
  return s;
}
```

这样做以后, 标签模版的<code>SaferHTML\`&lt;p&gt;${bonk.sender} has sent you a bonk.&lt;/p&gt;\`</code>会被展开成<code>"&lt;p&gt;ES6& lt;3er has sent you a bonk.&lt;/p&gt;"</code> 这样用户及时遇到恶意的攻击也是安全的, 例如: ` Hacker Steve <script>alert('xss');</script>` 的发起攻击.

(顺带一提, 如果函数的参数对象太多让你很烦, 下周我会给大家介绍一个我想你会喜欢的新特性)

一个简单的例子不足以完全说清标签模版的灵活性. 让我们回顾一下刚才所列出的模版字符串的限制, 这样我们才知道我们还可以进一步做些什么:

+ 模版字符串不会自动转义特殊字符. 但我们已经看到用了标签的模版可以来处理这个问题.

事实上你可以做到更多.

从安全角度来说, 我的`SaferHTML`其实相当弱. html不同的地方需要有不同的转义策略; `SaferHTML`没有把他们都转义. 但只需要再折腾一下, 你就可以写出比`SaferHTML`智能很多的函数, 可以分辨每个在`templateData`中的字节, 知道哪些是html代码; 那些实在元素属性中的, 他们需要被转义`'`和`"`; 那些是在url的参数里的, 这些需要被url编码; 等等. 他们每个都需要被正确地替换.

这样听起来是不是有点牵强, 因为html转换太慢了. 幸运的是, 标签模板的字符串部分被二次编译时不会再有变化. `SaferHTML`会把转换的结果缓存起来来提升以后编译的速度. (缓存可以是[WeakMap](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap)是es6另一个特性, 以后也会讲到).

+ 模板字符串没有内置的i18n特性. 但可以用标签来实现. 有一篇[Jack hsu的文章](http://jaysoo.ca/2014/03/20/i18n-with-es6-template-strings/)写了我们第一步大概该如何做, 以下样例抛砖引玉:

```js
i18n`Hello ${name}, you have ${amount}:c(CAD) in your bank account.`
// => Hallo Bob, Sie haben 1.234,56 $CA auf Ihrem Bankkonto.
```

注意到这个例子, `name`和`amout`是javascript, 但有一个不熟悉的代码, `:c(CAD)`, Jack把他放在了字符串部分. javascript是javascript引擎处理的部分; 字符串部分就由Jack的`i18n`标签来处理. 我们可以从`i18n`的文档中读到`:c(CAD)`意思是`amount`是一个货币计量, 加拿大刀.

以上是关于标签模板的事情.

+ 模板字符串不能代替Mustache和Nunjucks, 一部分是因为他没有内置的循环和条件语句. 现在我们开始看看你可以如何修复这个问题. 如果js没有提供这个特性, 那么我可以写个标签来提供这个特性.

```js
// Purely hypothetical template language based on
// ES6 tagged templates.
var libraryHtml = hashTemplate`
  <ul>
    #for book in ${myBooks}
      <li><i>#{book.title}</i> by #{book.author}</li>
    #end
  </ul>
`;
```

灵活性还不止于此. 注意标签函数的参数不会被自动转换成字符串. 他们可以是任何东西. 包括返回值也一样, 可以是任何东西. 标签模板甚至也不一定是字符串! 你可以用标签字符串来创建: 正则, dom树, 图片, promise, js数据结构, openGL 的shader...
**标签模板让类库开发者来创造更多强大的面向领域的语言.** 这些语言可能看起来不像js, 但他们可以无缝插入js并与其余语言智能互动. 我一时想不出别的有这样特性的语言了. 我不知道这个特性会给我们带来什么, 这种可能性让人兴奋.

## 我们什么时候可以使用他?

用高端浏览器和nodejs, 或者是typescript.

## 等等..那markdown呢?

嗯哼?

噢.. 好问题.

(这个缓解并没有在讲js, 如果你不用markdown, 你可以跳过这里)

用模板字符串的话, markdown和javascript都用了<code>`</code>来表示一些特殊的东西. 其实在markdown里, 反引号是用来分隔文本中的``code``(代码)的.

这带来了些小问题! 如果你写了以下的markdown文档:

```
To display a message, write `alert(`hello world!`)`.
```

他可能会被显示成:

   To display a message, write `alert(h`ello world!).

注意markdown是不存在反引号的. markdown会把所有反引号认为是代码并把他们用html标签替换.

为了避免这点, 我告诉你一个新手不太知道的事: 你可以用多个反引号来作为代码分隔符, 像这样:

```
To display a message, write ``alert(`hello world!`)``.
```

[这里](https://gist.github.com/jorendorff/d3df45120ef8e4a342e5)有详情, 这些使用markdown写的你可以看一下.

## 下一章

下一章我们将说一下许多程序员在别的语言中喜欢了几十年的两个特性: 一个是为了尽量节省参数的人, 一个是为了需要写很多参数的人. --我会讲一下函数的参数问题.

我们将看到在在火狐中实现这个特性的人的眼里这个特性是怎么样的. 下周我们的嘉宾Benjamin Peterson带来的es6的rest默认参数和rest参数.

---

es in depth 系列 [目录](/2016/09/10/es6-in-depth-content/) [原文地址](https://hacks.mozilla.org/category/es6-in-depth/)