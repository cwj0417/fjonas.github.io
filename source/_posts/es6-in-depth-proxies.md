---
title: es6 in depth Proxy
date: 2016-09-10 17:27:56
categories: 胡乱编码
tags: [ES2015,es6-in-depth,翻译]
---
下面的代码是我们今天要讲的内容:

```js
var obj = new Proxy({}, {
  get: function (target, key, receiver) {
    console.log(`getting ${key}!`);
    return Reflect.get(target, key, receiver);
  },
  set: function (target, key, value, receiver) {
    console.log(`setting ${key}!`);
    return Reflect.set(target, key, value, receiver);
  }
});
```

第一个例子略微复杂, 之后的部分再来解释. 现在呢, 来看一下上面的代码创建的对象:

```js
> obj.count = 1;
    setting count!
> ++obj.count;
    getting count!
    setting count!
    2
```

这里发生了什么? 我们在获得对象属性时做了拦截. 我们重载了`"."`操作符.



## 这是如何做到的

计算机中最有趣的诡计被叫做*虚拟化*. 是在做一些令人惊奇的事情时经常用到的技术. 这是他的工作方式:

1. 拿一个图片

   ![一个风景图](https://2r4s9p1yi1fa2jd7j43zph8r-wpengine.netdna-ssl.com/files/2015/07/power-plant.jpg)

2. 围着图中的某个东西画一个轮廓

   ![风景图中的一艘船的周围被画了圈](https://hacks.mozilla.org/files/2015/07/power-plant-with-outline.png)

3. 现在把轮廓中的东西用别的东西替代, 或者替代轮廓外的所有东西, 代替品是完全不相关的东西. 只有一个规矩, 就是背景适配. 你的替换必须让不知情的人注意不到某些东西被替换过.


   ![圈中的东西已被替换成了背景色相似的没有船的图片](https://2r4s9p1yi1fa2jd7j43zph8r-wpengine.netdna-ssl.com/files/2015/07/wind-farm.png)

你可能感到和某些经典电影的场景很像, 比如*楚门的世界*和*黑客帝国*. 一个人生活在一个轮廓中, 而其余部分的世界都被精心设计的假象包围着.

为了达成背景适配, 你的替换必须精心设计. 但真的难点是轮廓圈在哪.

*轮廓*其实就是API包装, 一个接口, 用来告诉别的代码自己的行为或者需求对自己的输入的东西. 所以系统需要有接口, 而接口正是你应该圈画的轮廓. 你可以在满足接口的条件下替换行为, 这样别处的代码就不关心你的改动.

因为*没有*现有的接口你才必须变得有创造性. 一些很酷的软件花了很多时间去整理API的设计, 并花大量的努力去把接口实现.

[虚拟内存](https://en.wikipedia.org/wiki/Virtual_memory), [硬件虚拟化](https://en.wikipedia.org/wiki/Hardware_virtualization), [Docker](https://en.wikipedia.org/wiki/Docker_%28software%29), [Valgrind](http://valgrind.org/), [rr](http://rr-project.org/)-从各个角度来说所有这些软件都把新的, 甚至想不到的接口引入了现有的系统. 在一些情况下, 需要用一个新的操作系统, 甚至新的硬件来让新的接口良好工作.

最好的虚拟化拦截来自对虚拟化更新的理解. 为了给一些东西写API, 你必须先理解他. 一旦你理解了, 你就可以做出惊人的东西.

 es6提供了javascript里最基础的东西:object的虚拟化支持.

## 什么是object?

哦, 这个标题是认真的, 用一段时间想一下. 如果你知道什么是object的话可以向下滑来跳过这章了.

![很有名的思考者雕像](https://hacks.mozilla.org/files/2015/07/thinker.jpg)

这个问题对我来说很难! 我从来没听过令人满意的定义. 

很惊奇? 定义一个基础的概念一向很难 —— 来看看[几何原本](http://aleph0.clarku.edu/~djoyce/java/elements/bookI/bookI.html)的第一个定义. ECMAScript语言定义很清楚, 虽然如此, 当需要解释"对象成员"的时候并没什么用. 

之后, 定义增加了"一个object是一些属性的集合". 这个讲法不错. 如果你需要一个定义, 那就是他了, 我们之后会回来讲这个.

在我说为一些东西写API之前你必须理解他. 所以其实我可以保证通过这个我们能更好理解object, 并可以做出一些amazing的事来.

好我们来跟着es标准委员会来看看改如为object何定义一个API, 一个接口. 我们需要什么样的方法, object可以做什么.

以上的问题答案是需要看具体是什么object. DOM元素object可以做一些事情; AudioNode object可以做另外些事情. 但有一部分基础的行为是object共有的:

+ object有属性. 你可以对属性设置, 删除等等.
+ object有prototype. 这是js继承的原理.
+ 有些object有方法和构造器, 你可以调用他们

几乎所有js程序员都使用object的属性, prototype和函数. 即使是比较特殊的dom元素或者audionode对象也是通过调用方法来操作他的.

完整的列表可以在[es5和6标准](http://www.ecma-international.org/ecma-262/6.0/index.html#table-5)中看到. 我这里只将了一部分. 奇怪的双中括号:[[]], 强调了这是*内部*方法, 被从原声js代码中隐藏了. 你不可以像普通方法一样调用, 删除, 或者重载他们.

+ **obj.\[\[Get\]\](key, reciever)** - 获取一个属性的值.

  调用点: `obj.prop` or `obj[key]`

  obj是正在被搜索的object; *receiver*是这个object第一个开始搜索的属性. 有时候我们必须搜索一些object. obj可能是*receiver*原型链上的一个对象.

+ **obj.\[\[Set]](key, value, receiver)** - 为object的属性赋值

  调用点: `obj.prop = value` or `obj[key] = value`

  当赋值语句为`obj.prop += 2`, [[Get]]方法会先被调用, 再调用[[Set]]方. `++`和`--`也是如此.

+ **obj.\[\[HasProperty]](key)** - 查看属性是否存在

  调用点: `key in obj`

+ **obj.\[\[Enumerate]]()** - 列出obj的可枚举属性.

  调用点: `for(key in obj)`...

  返回的是一个遍历器对象, 这是为什么`for-in`循环拿到的是键名.

+ **obj.\[\[GetPrototypeOf]]()** - 返回obj的prototype

  调用点: `obj.__proto__` or `Object.getPrototyoeOf(obj)`.

+ **functionObj.\[\[Call]](thisValue, arguments)** - 调用方法

  调用点: `functionObj()` or `x.method()`

  可选的, 不是每个object都是函数.

+ **constructorObj.\[\[Construct]](arguments, newTarget)** - 调用一个构造器

  调用点: 比如`new Date(2890, 6, 2)`
  可选的, 因为不是每个object都是构造器.

  newTarget参数是subclassing. 我们以后会讲到.

也许你已经可以猜到另外七个了.

通过es6标准, 任何一个语法或者内置函数对object的操作某个角度来说都是调用了这14个内部方法. es6在脑内勾画了一个object的轮廓. proxy就是让你可以随意替换这些行为.

在我们开始讲解重载这些内置方法前, 再重申一遍, 我们重载的是内置方法, 类似于`obj.prop`, `Object.keys()`.

## Proxy

es6定义了一个新的全局构造器, [Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy). 他接受2个参数: *target object*和*handler object*. 所以以下是一个简单的例子:

```js
var target = {}, handler = {};
var proxy = new Proxy(target, handler);
```

我们先把handler object稍微放一下, 先来看看proxy和target object的关系.

我可以告诉你proxy在某行代码中是如何表现的. 所有proxy的内部方法都会forward到一个target上. 也就是, 如果proxy\[\[Enumerate\]\]()被调用, 他的返回值为 target.\[\[Enumerate]]().

 我们来试一下. 我们来做点会激发proxy的事, \[\[Set]]()会被调用.

```js
proxy.color = "pink";
```

发生了什么? proxy.\[\[Set]]()的target.\[\[Set]]()方法被调用, 所以会在target上创建一个新属性:

```js
>target.color
 "pink"
```

是的, 和大多数内部方法一样, proxy在大多数情况的行为如同操作了target目标.

对于这个'幻觉'的真实性还是有一些限制. 你会发现`proxy !== target`. proxy对象有时候会通不过类型检查. 比如: 即使proxy的target是一个dom元素, 但proxy并不是一个真的dom元素; 例如`document.body.appendChild(proxy)`的操作会因为`TypeError`而失败.

## Proxy handler

现在回来说handler object. 这是让proxy有用的东西. 

handler object的方法可以重载任何proxy的内部方法.

举个例子, 如果你想拦截任何对object属性的赋值, 你可以定义[handler.set()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/handler/set)方法:

```js
var target = {};
var handler = {
  set: function (target, key, value, receiver) {
    throw new Error("Please don't set properties on this object.");
  }
};
var proxy = new Proxy(target, handler);

> proxy.name = "angelina";
    Error: Please don't set properties on this object.
```

handler的所有方法在[MDN Proxy文档](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy#Methods_of_the_handler_object)中. 一共有14个方法, 列出了14个es6的内部方法.

所有handler的方法都是可选的. 如果一个proxy的handler object没有方法, 那么这个proxy就是直接forward target的, 正如之前所见.

## 例子: "不可能的" 自动创建object属性

我们现在知道了, proxy可以做到没有proxy就做不到的,奇怪的, 不可能的事.

这是我们的第一个练习. 写一个`Tree()`函数, 效果如下:

```js
> var tree = Tree();
> tree
    { }
> tree.branch1.branch2.twig = "green";
> tree
    { branch1: { branch2: { twig: "green" } } }
> tree.branch1.branch3.twig = "yellow";
    { branch1: { branch2: { twig: "green" },
                 branch3: { twig: "yellow" }}}
```

注意object的中间变量*branch1*, *branch2*, *branch3*是怎么被在需要时创建的. 很方便吧? 那么到底是如何工作的呢.

之前这么做是不可能的. 但现在有了proxy几行代码就搞定了. 我们只需要对\[\[Get]]()方法做点修改. 如果你想挑战下那么就在看下去前自己试一下.

![这是一个阻止读者看到下文的图片, 意味不明](https://hacks.mozilla.org/files/2015/07/maple-tap.jpg)

这是我的答案:

```js
function Tree() {
  return new Proxy({}, handler);
}

var handler = {
  get: function (target, key, receiver) {
    if (!(key in target)) {
      target[key] = Tree();  // auto-create a sub-Tree
    }
    return Reflect.get(target, key, receiver);
  }
};
```

注意, 最后调用了`Reflect.get()`方法. 这能看出这是一个必须做的事, 在proxy的handler方法中, 需要告诉对象"现在返回代表target对象的默认行为". 所以es6定义了新的[Reflect对象](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Reflect)也有14个方法, 都是你需要用的.

## 例子: read-only view

我想我可能给了大家错误的印象: proxy很容易用. 让我们再看一个例子来证实是否真的容易.

这次我们的赋值更复杂点: 我们需要实现一个函数, `readOnlyView(object)`, 接受一个object然后返回一个proxy行为和输入一样, *除了*不可以修改他. 举个例子, 他的行为可能如下:

```js
> var newMath = readOnlyView(Math);
> newMath.min(54, 40);
    40
> newMath.max = Math.min;
    Error: can't modify read-only view
> delete newMath.sin;
    Error: can't modify read-only view
```

我们如何去实现他?

首先我们要把改变目标属性的拦截了, 有五个哟:

```js
function NOPE() {
  throw new Error("can't modify read-only view");
}

var handler = {
  // Override all five mutating methods.
  set: NOPE,
  defineProperty: NOPE,
  deleteProperty: NOPE,
  preventExtensions: NOPE,
  setPrototypeOf: NOPE
};

function readOnlyView(target) {
  return new Proxy(target, handler);
}
```

这样是可以工作的. 通过这个read-only view可以阻止赋值, 属性定义, 等等.

那么有什么漏洞吗?

最大的问题就是\[\[Get]]方法, 或者其他方法, 会返回可编辑的object. 所以即便object`x`是read-only view, `x.prop`也是可编辑的! 这是个很大的漏洞.

要修复他, 我们需要加上`handler.get()`方法:

```js
var handler = {
  ...

  // Wrap other results in read-only views.
  get: function (target, key, receiver) {
    // Start by just doing the default behavior.
    var result = Reflect.get(target, key, receiver);

    // Make sure not to return a mutable object!
    if (Object(result) === result) {
      // result is an object.
      return readOnlyView(result);
    }
    // result is a primitive, so already immutable.
    return result;
  },

  ...
};
```

这还是不够. 其他的方法也需要这些代码来补充, 比如`getPrototypeOf`, `getOwnPropertyDescriptor`.

然后还有别的问题. 当getter方法被这种proxy调用, 被传入getter的`this`值将会是proxy本身. 正如我们之前说过的, proxy不能通过类型检测. 我们就需要用target来替换proxy. 你能猜到需要怎么做么?

来创建一个这样的proxy比较容易, 但要创建一个行为良好的proxy就比较难了.

## 杂项

+ **真正需要proxy的地方**

  当你需要观察或记录一个object被读取的情况时很有用. 也就是debug的时候很有用. 测试框架的时候可以用他们来创建[mock object](https://en.wikipedia.org/wiki/Mock_object). 

  proxy也在你需要一个普通object稍微改变行为的情况: 比如延迟吐出属性.

  我几乎不想提起这点: 但最好的知道代码运行过程的方式是... 用*另一个proxy*包装proxy的handler object, 这样可以在每次handler被访问的时候打下log.

  proxy可以用来控制object的读写权限, 正如刚才的例子`readOnlyView`. 但是这种用法在应用代码中很少, 但火狐使用了proxy来实现不同域名的[安全边界](https://developer.mozilla.org/en-US/docs/Mozilla/Gecko/Script_security). 这是安全模型的重要部分.

+ **proxy ♥ WeakMaps**. 在刚才的`readOnlyView`例子中, 我们会在object每次被访问时创建一个proxy. 如果在`WeakMap`中创建proxy对象的话我们可以省下很多内存, 所以无论多少object被应用`readOnlyView`, 只有一个proxy被创建.

  这也是一个使用`WeakMap`的地方.

+ **Revocable proxy**. es6也定义了一个方法, `Proxy.revocable(target, handler)`, 这样会创建一个和`Proxy(target, handler)`创建出的一样的对象, 只是之后可以被*revoke*.(`Proxy.revocable`返回一个带有`.proxy`属性和`.revoke`方法的对象). 一但proxy被revoke, 他就是不能再工作了; 他所有的方法都没了.

+ **object 不变序列**. 在某种情况下, es6需要proxy handler的方法来看出 target的状态. 这样做是为了强制对象的不可编辑, 即使是proxy. 举例, proxy不可以被声明成不可拓展的, 除非他的target是不可拓展的.

  真正的规则在这很难讲清楚, 但如果你看到错误信息类似`"proxy can't report a non-existent property as nonconfigurable"`, 就是这种情况. 最像样的解决方案是改变proxy输出自己.

## 那么现在: 什么是object?

我想我们之前还留下了: "一个object是一些属性的集合".

我不是完全赞同这个定义, 即使再加上属性和可调用性. 我觉得"集合"这个词太笼统, 那会给proxy一个多烂的定义. 他的handler方法可以做任何事情.  甚至可以返回随机结果.

通过猜测object可以做什么, 标准化这些方法, 增加每个人都会用到的虚拟化, es6标准委员会拓展了很大的可能行. 

object现在几乎可以是任何东西.

## 我现在可以用Proxy了嘛?

不, web上用不了proxy.

---

es in depth 系列 [目录](/2016/09/10/es6-in-depth-content/) [原文地址](https://hacks.mozilla.org/category/es6-in-depth/)