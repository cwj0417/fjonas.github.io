---
title: es6 in depth 集合
date: 2016-09-10 17:27:21
categories: 胡乱编码
tags: [javascript,深入es6,翻译,入门]
---

es6的声明, 官方title为ECMA-262, 第六个版本, ECMAScript2015语言声明, 已经被最后确定并作为ECMA标准. 恭喜TC39和所有贡献的朋友们! es6已经转正了!

更好的消息: 下个新版本将不会再需要6年, 标准委员会现在目标是大约每一年左右发布一个新版本. [es7提案](https://github.com/tc39/ecma262)已经在发展中了.

最后很合适的引入今天要讨论的东西. 这个我很早就希望js拥有的特性, 并且我仍觉得这个特性在未来有提升空间.

## 共同进化的难点

js与其他语言很不相像, 这个特点有时候对js的进化产生了奇妙的影响.

es6的module就是一个很好的例子. 别的语言有自己的模块系统. racket就由一个很好的, python也有. 当标准委员会决定为es6加上一个模块系统, 为什么不直接拷贝现有的系统呢?

js背景与那些语言不同的. 因为他还需要在浏览器中运行. I/O会占用很多时间. 所以js需要一个可以支持异步加载代码的模块系统. 但也做不到从一些文件夹里顺序地搜索模块. 拷贝现有的系统行不通. es6模块需要一些新的东西的.

这是如何影响最后设计会是一个有意思的故事. 但我们现在先不展开模块的事.

本文会讲一下es6标准中的'带键集合':`Set`,`Map`,`WeakSet`, 和`WeakMap`. 这个特性从很多角度来看就像是别的语言中的[hash tables](https://en.wikipedia.org/wiki/Hash_table). 但标准委员会也做了一些有意思的平衡, 因为js与众不同.

## 为什么需要集合?

任何熟悉js的人都知道js已经有类似hash table的东西内置在语言里: 对象.

一个普通的`Object`毕竟是一个比较开放式键值对的集合. 你可以设置, 获取, 和删除属性, 遍历他们-hash table可以做的所有事. 所以为什么要去添加一个新特性呢?

好, 许多程序员用普通对象来保存键值对, 并且工作得很顺利, 并没有什么理由去使用`Map`或者`Set`. 好的, 那么我来说一下一些著名的使用对象的问题吧:

+	作为键值储存表的对象不能有方法, 因为避免冲撞的发生.
+	所以程序员必须使用`Object.create(null)`(而不是普`{}`)或者特别注意来避免把内置的方法(比如`Object.prototype.toString`)也读成数据.
+	键只能是字符串(或者es6的symbol). 对象不可以为键.
+	没有高效率的方法来查询对象有多少属性.

es6也多了一个新的担心: 普通的对象是不可遍历的, 所以他们不能与`for-of`循环, `...`操作符等良好配合.

重复一下, 现在有很多程序员没有真正碰到什么问题, 所以普通的对象还是在被选择使用. `Map`和`Set`被用在另外一些情况下.

因为他们是被设计用来避免用户数据和内置方法冲撞的, es6的集合*不会把自己的数据暴露为属性*. 这意味着类似`obj.key`或者`obj[key]`这样的表达式不能被用来获取hash table的数据了. 你必须写`map.get(key)`. 同样的, hash table的创建也不像属性, *不会*继承原型链.

好的方面是, 与普通的`Object`不同, `Map`和`Set`拥有方法, 也可以被添加更多的方法, 甚至在某个标准下, 或者你自己的类下, 不会有冲突.

## `Set`

`Set`是一个值的集合. 是可变的, 所以你的程序可以增加和删除其中的值. 直到这里, 他还只是像一个数组. 但虽然有一些相同点, set和array的区别还是有很多的.

首先, 不同于array, set不会存在相同的值. 如果你给set添加了相同的值, 什么都不会发生.

```js
> var desserts = new Set("🍪🍦🍧🍩");
> desserts.size
    4
> desserts.add("🍪");
    Set [ "🍪", "🍦", "🍧", "🍩" ]
> desserts.size
    4
```

以上例子用了字符串, 但`Set`可以包含任何类型的js值. 和字符串一样, 添加任何相同的对象, 数组多次都是无效的.

第二, `Set`会维护好内部的数据来使寻找成员更快.

```js
> // Check whether "zythum" is a word.
> arrayOfWords.indexOf("zythum") !== -1  // slow
    true
> setOfWords.has("zythum")               // fast
    true
```

你不能从索引获得`Set`的值:

```js
> arrayOfWords[15000]
    "anapanapa"
> setOfWords[15000]   // sets don't support indexing
    undefined
```

以下是所有set的操作:

+  `new Set`来创建一个新的空set

+  `new Set(iterable)`创建一个新的set并且遍历参数来填充数据

+  `set.size`返回set的个数

+  `set.has(value)`如果给set包含value就返回`true``

+  `set.add(value)`为set添加一个value, 如果value已经存在什么都不做

+  `set.delete(value)`从set删除一个value. 如果value本身不存在, 什么也不做. `.add()`和`.delete()`都会返回他本身, 所以你可以做连式操作.

+  `set[Symbol.iterator]()`返回一个包含set数据的遍历器. 你一般不需要直接着么调用它, 但这样可以告诉你你是怎么遍历set的. 所以你可以直接写`for(v of set)`来遍历.

+  `set.forEach(f)`用代码来解释最方便, 他是以下的简写:

   ```js
   for (let value of set)
    f(value, value, set);
   ```

    这个方法与数组的`.forEach()`差不多.

+  `set.clear()`移除set的所有数据.

+  `set.keys()`,`set.values()`和`set.entries()`返回各自的遍历器. 这些是为了和`Map`良好配合, 我们下面会讲.

以上这些特性中, 构造器`new Set(iterable)`是最强大的, 因为他操作了数据结构的层次. 你可以把一个array转为一个set, 只用一行代码就做了去重. 或者给他写一个生成器: 之后就可以按照你的意愿来遍历这个set. 构造器也是你可以拷贝现有`Set`的一个方法.
​	
我上周说好我会讲一下es6的新集合, 我们已经开始了, 虽然`Set`已经很厉害了, 还是有一些希望在以后的标准里被添加的新特性:

+	一些功能性的辅助函数, 就像现在已经存在于array的`.map()`, `.filter()`, `.some()`和`.every()`.
+	同样的`set1.union(set2)`和`set1.intersection(set2)`
+	一些可以一次就操作一批值的方法:`set.addAll(iterable)`, `set.removeAll(iterable)`, 和`set.hasAll(iterable)`.

好的方面是, 以上这些都可以用es6提供的方法很快的自己实现.

## `Map`

`Map`是键值对的集合, 以下是`Map`可以做的事:

+  `new Map`返回一个新的空map.
+  `new Map(pairs)`创建一个新的map并用现有的`[key, value]`对来填充数据. *pairs*可以是已经存在的`Map`对象, 或者是一个有2个元素的数组组成的数组, 或者是一个每次yield一个2个元素的数组的生成器, 等等
+  `map.size`获得map的数据的个数.
+  `map.has(key)`匹配存在的key(类似`key in obj`)
+  `map.get(key)`获得到key对应的值, 如果没有对应的就返回undefined(类似`obj[key]`).
+  `map.set(key, value)`添加关联的键值对, 并且会覆盖已经存在的(类似`obj[key] = value`).
+  `map.delete(key)`删除一个数据(类似`delete obj[key]`).
+  `map.clear()`移除map的所有属性.
+  `map[Symbol.iterator]()`返回一个map属性的遍历器. 遍历器每次会吐出类似`[key, value]`的数组.
+  `map.forEach(f)`等价于:
   ```js
   for (let [key, value] of map)
   		f(value, key, map);
   ```
   	这个比较奇怪的参数是因为它类似于`Array.prototype.forEach()`.
+  `map.keys()`返回一个包含map中所有key的遍历器.
+  `map.values()`返回一个包含map中所有值的遍历器.
+  `map.entries()`返回一个包含map中所有key value的遍历器. 和调用`map[Symbol.iterator]()`的结果一样. 实际上本来就是同一个方法的不同调用方式.

然后我要开始抱怨一下了, 以下是我觉得有用但是没有在es6标准里实现的功能:

+	一个默认值的机制, 类似Python的[collections.defaultdict](https://docs.python.org/3/library/collections.html#defaultdict-examples).
+ 一个有用的方法, `Map.fromObject(obj)`, 这样可以轻松的用写对象的语法来构造map.

同样的, 这些特性也很容易添加的.

好, 记得文章开头说的需要在浏览器中运行导致js语言设计的特殊性吗? 这是我们开始话题的地方. 现在我有三个例子, 下面是前两个.

## js与其他语言不同处1: 没有hash code的hash table?

有一个有用的特性es6的集合一直没有支持.

假设我有一个[URL对象](https://url.spec.whatwg.org/)的`Set`.

```js
var urls = new Set;
urls.add(new URL(location.href));  // two URL objects.
urls.add(new URL(location.href));  // are they the same?
alert(urls.size);  // 2
```

这2个URL对象真的需要被认为是一样的. 他们的一切都相同. 但是在javascript中这两个对象是不同的, 我们也没有办法重写语言判断是否相等的逻辑.

其他的语言是支持这样做的, 在Java, Python和Ruby里, 独立的类可以重写相等的规则. 在许多计划的实行里, 独立的hash table可以使用不同的相等策略. C++全都支持.

但是, 所有这些机制都需要用户去实现自定义的hash函数和系统默认的hash函数. 委员会选择不暴露js的hash code, 至少是现在还没-因为担心互相操作和安全性, 其他的语言没有这个顾虑.

## js与其他语言不同处2: 天呐! 可预测性!

我可能觉得计算机的行为是可预见的一点不奇怪. 但是当我告诉别人`Map`和`Set`访问属性的顺序是他们被插入的顺序大家都由点惊讶呢.

我们已经习惯了hash table的顺序是随意的. 我们已经慢慢接受了这个设定. 但有一些办法可以避免这种随机性. 

+	一开始一些程序员觉得随机的遍历顺序很奇怪.[1](http://stackoverflow.com/questions/2453624/unsort-hashtable),[2](http://stackoverflow.com/questions/1872329/storing-python-dictionary-entries-in-the-order-they-are-pushed),[3](https://groups.google.com/group/comp.lang.python/browse_thread/thread/15f3b4a5cd6221b1/1b6621daf5d78d73),[4](http://bytes.com/topic/c-sharp/answers/439203-hashtable-items-order),[5](http://stackoverflow.com/questions/1419708/how-to-keep-the-order-of-elements-in-hashtable),[6](http://stackoverflow.com/questions/7105540/hashtable-values-reordered)
   +ECMAScript并没有指定属性的枚举顺序, 而大多数实现都是强制为插入的顺序, 为了和web的做法达成一致. 所以有一些担忧就是TC39没有指定遍历的顺序, 这样每个web可能会自己指定顺序.[7](https://mail.mozilla.org/pipermail/es-discuss/2012-February/020576.html)
   +hash table遍历顺序可以暴露一些对象的hash code. 这让牵扯hash的函数实现有了比较大的安全问题. 比如, 一个对象的地址不能因为被暴露了hash code而可回收.(给非可信任的js代码暴露了对象的地址, 自己又并不需要使用, 这样增加了web上的安全漏洞)

这些我已经在2012年的2月讨论过了, 我讨论过了[遍历器的随机顺序的问题](https://wiki.mozilla.org/User:Jorend/Deterministic_hash_tables). 然后我开始尝试用实验来证明要保持追踪插入的顺序使hash table的速度变得太慢. 我写了一个C++的小标准, [结果让我震惊](https://wiki.mozilla.org/User:Jorend/Deterministic_hash_tables).

这就是为什么我们的js最后选择了检测着插入顺序.

## 一千个使用弱集合的理由

symbol那篇文章, 我们讲了一个关于动画lib的js例子. 我们想要为每个dom元素来设置一个flag, 以下:

```js
if (element.isMoving) {
  smoothAnimations(element);
}
element.isMoving = true;
```

不幸的是在dom对象上加一个拓展属性好像是个坏主意, 我们在上篇文章有讲过.

那篇文章说了用symbol解决问题的方法. 那我们可不可以用`Set`来解决呢? 可能是这样的:

```js
if (movingSet.has(element)) {
  smoothAnimations(element);
}
movingSet.add(element);
```

这么做的话有一个唯一的缺点: `Map`和`Set`对象维护着他们内部的每一个键的关系. 这意味着如果dom元素被移除了document以后, 垃圾回收机制直到这个元素被移出`movingSet`前都不能回收这个内存. 当然lib一般都会有综合性的成功处理, 用户只能被强制自己做这个操作. 着么做也可能导致内存泄露.

es6有一个很惊人的对这个问题的修复. 把`movingSet`设置为`WeakSet`而不是`Set`. 内存泄露就解决了!

那这意味着解决这个问题可以用弱集合或者是symbol, 到底哪个更好呢? 完整的对于权衡的讨论可能会让这篇文章太长了. 如果你可以在整个web应用的生命周期里只用一个symbol, 那么用symbol好. 如果你希望用生命周期比较短的symbol, 那么这是一个危险的信号: 所以就考虑使用`WeakMap`来防止内存泄露.

## `WeakMap`和`WeakSet`

`WeakMap`和`WeakSet`的表现行为就类似`Map`和`Set`, 但有以下几点限制:

+	`WeakMap`只支持`new`, `.has()`, `.get()`, `set()`, 和`.delete()`.
+ `WeakSet`只支持`new`, `.has()`, `.add()`, 和`.delete()`.
+ 在`WeakSet`中的值和`WeakMap`中的键必须是对象.

注意任何类型的弱集合都是可遍历的. 除非你传入你指定的键, 其他情况你是得不到弱集合的属性的.

这些仔细设计的限制使垃圾回收机制可以收集到激活状态的集合中的已经不需要的对象. 效果就类似你可以通过弱索引或者弱键词典来找到东西, 但es6的弱集合有益于内存管理*并不需要脚本知道垃圾回收原理并用代码做操作*.

## js与其他语言的不同处3: 隐藏垃圾回收机制的不确定性

通过以上的场景, 我们知道了弱集合是一种[短声明中期table](http://www.jucs.org/jucs_14_21/eliminating_cycles_in_weak/jucs_14_21_3481_3497_barros.pdf)的实现.

简而言之, `WeakSet`没有维护内部对象的强关系. 当一个`WeakSet`内的对象被采集, 他被很轻松地移出了`WeakSet`. `WeakMap`也是类似的. 都没有维护键值的强关系. 只要键存在, 那对应的值就存在.

为什么要添加这些限制? 为什么不直接在js中增加一种弱关系?

再说一次, 标准委员会非常不愿意把一些不可确定的行为暴露给脚本. 很差的跨浏览器兼容性是web开发的噩梦. 弱关系暴露了底层垃圾回收机制的实现-也正是'平台相关'的随意性行为. 当然应用不应该是依赖'平台相关'细节的, 但弱关系也让我们很难知道到底我们正在使用多少'平台相关'的垃圾回收机制. 我们很难去搞清原因.

对比来看, es6的弱集合是由一些限制特征的集合, 而且集合的特征很明显. 被采集以后的键值永远不会被发现, 所以应用不能着么使用他, 即使偶尔会发现.

这是一个由浏览器特性的问题导致的惊人的语法设计而使js成为了更好的语言的案例.

## 如何在代码中使用集合?

许多现代浏览器都可以.

---

es in depth 系列 [目录](/2016/09/10/es6-in-depth-content/) [原文地址](https://hacks.mozilla.org/category/es6-in-depth/)