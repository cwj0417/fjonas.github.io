---
title: 比较vue2和vue3的响应式
date: 2021-02-01 16:11:38
categories:
tags:
---
前一阵写了一个[最简单版本的vue响应式](https://github.com/cwj0417/reactive-mini), 比较了下vue2和vue3响应式系统, 并做一下总结.

<!--more-->

## 粗略总览

为什么要开发vue3, 尤总说了很多原因, vdom性能(重写算法), 响应式性能(proxy), 打包体积(treeshaking), 开发者体验(切换ts), 难解决的issue(独立实例).

为了更深刻理解开发vue3, 我尝试从最简单的模块深入, 分析下两个版本的区别.

### 相似的点

vue2和vue3的总体结构是不变的, 都是有三大模块组成: compiler, reactivity, renderer. compiler把各种输入编译成ast, 再由renderer把ast渲染到dom上. reactivity检测数据变化, 再去调用compiler和renderer更新视图.

react和vue的本质区别就在于vue有reactivity系统, 我猜想react和vue有对应的概念, 之后熟悉react以后再回来和vue的整体做一下对比.

本文关注的重点, reactivity模块, vue2和vue3的基本思路也是相同的: **拦截数据的改变, 触发对应的操作.** 更详细地说, 触发了什么操作? 触发的操作是在做初始化的时候按需注册的.

### 调用响应式的入口

vue2和vue3调用响应式系统的点也是相同的.

vue2reactivity的入口是`new Watcher()`, 在构造时注册编译渲染动作, 调用的地方一共有三处:

1. `mountComponent`, 调用`$mount()`的时候.

   ```js
   new Watcher(vm, vm._update(vm._render()), noop, null, true))
   ```

2. 初始化computed的时候:

   ```js
   watchers[key] = new Watcher(
     vm,
     getter || noop,
     noop,
     computedWatcherOptions
   )
   ```

3. `$watch()` 中调用:

   ```js
   const watcher = new Watcher(vm, expOrFn, cb, options)
   ```

vue3reactivity的入口是`effect()`, `effect()`执行的时候会建立监察关系. 直接调用的地方也有3处:

1. `setupRenderEffect()`的时候调用, 同样用于触发渲染, 但调用`setupRenderEffect()`的地方就比vue2复杂多了.

   ```js
       instance.update = effect(function componentEffect() {
         // 此处省略180行代码, 为啥不抽方法也得以后继续深入才知道
       }
   ```

2. 注册computed时的构造方法里, 我们还能看出`effect()`有很多options:

   ```js
   this.effect = effect(getter, {
     lazy: true,
     scheduler: () => {
       if (!this._dirty) {
         this._dirty = true
         trigger(toRaw(this), TriggerOpTypes.SET, 'value')
       }
     }
   })
   ```
   
3. watch api:

   ```js
     const runner = effect(getter, {
       lazy: true,
       onTrack,
       onTrigger,
       scheduler
     })
   ```

## 细看区别

虽然有这么多相同的, 但是从api也看出来有许多不同点. 很容易第一反应想到的区别:

1. api的名字不同了. 作者说只是换了语态.
2. class变成function, 使用了set, map. 作者说只是更新了语法, 也更贴近实际意义.
3. flow切换到ts. ts现在变成主流, 更多开发者使用ts环境(vscode), 用ts写可以让大部分开发者体验更好. (浅层次理解)
4. Object.defineProperty切换到Proxy. 减少了对浏览器的支持, 增加捕捉get set操作, 提升性能.

这些都是第一层比较浅的区别. 下面我们深入一些, 看一下第二层的区别有哪些.

### 没有callback的effect

上面的例子可以看出, (至少我认为)vue3的`effect`和vue2的`new Watcher()`是对应的. 但实际上vue3是有watch api, 并且`effect`没有callback, 而vue2的`Watcher`有.

故事要从vue2的mountComponent说起.

vue2是通过`observe()`处理数据, `new Watcher()`注册事件的, 而在注册"生成ast并渲染dom"事件的时候发现, 不需要callback, **callback的参数本身就需要调用一次getter作为callback的参数, ballback也必须依赖getter才有实际意义**, 所以也许尤总感觉到了, **在这种拦截数据的情况下, 带有响应式数据的操作更像是一种side effect**, 所以把这种行为命名为`effect`, 并且延伸出了其他的方法名.

我们把`effect`近似理解为没有callback的`new Watcher()`, 可以做以下比较:

|               | 创建时调用          | 触发时调用           |
| ------------- | ------------------- | -------------------- |
| new Watcher() | expression          | expression, callback |
| effect()      | expression+callback | expression+callback  |

我们来做2种尝试, 分别用一个模式的参数去实现另一个模式:

1. `new Watcher(expression, callback)`, 转换成`effect(() => callback(expression))`, 区别是effect第一次执行的时候也会触发一次callback.
2. `effect(() => someEffect())`, 我们就会发现, 无法把expression从someEffect中剥离出来. 如果要举例, 那就是vue2中mountComponent的情况. (数据藏在`vm._render()`生成的ast里, 很难自动抽离出来, 也没必要)

**小小的总结: vue3的effect概念, 可能是更接近"数据触发行为"这种模式的描述.**

那么vue3中的watch api的实现, 是通过`effect`的options`scheduler`来实现的. 这里先不再深入了.

### 监察关系存放的位置

vue3很简单, 所有的effect都被存在一个全局weakMap里, **不同的vue实例的effect也会被存在同一个weakMap里**, 已验证. 以`{target -> key -> dep}`的格式存着, 在trigger的时候根据target, key去取到然后执行.

而vue2把需要运行的函数都放在Dep对象里, 存到闭包里了,  **其实vue3可以这样优化是因为weakMap.**

而vue2更有问题的是, 每个也许touch不到的对象属性, 都会建立一个闭包, 比可见的`.__ob__`更多. vue3的优化是基于Proxy的.

### Proxy和Object.defineProperty

Proxy相对于Object.defineProperty的优点之一是, 他是"懒"的(暂时想不到更好的描述): Proxy的拦截是在对象发生操作时才对应执行的, 而Object.definProperty需要遍历对象, 改写getter/setter, 把操作都存在闭包里.

之前介绍的immer也是同样的Proxy受益者, immer只在对象被修改的时候才创建新地址, 而深浅拷贝都会为其他根本不会改动的叶子节点创建新地址, **Proxy的性能优势在对象树大的时候表现得更明显**, 这个适用于vue3和immer.

我们来看一下vue2的响应式在哪些地方会存闭包:

+ getter, setter. 对象的值改变后需要触发的. 闭包是`defineReactive`生成的
+ 每个对象下挂着的`__ob__`对象. 这个是拦截数组方法后调用的handler. 闭包是`new Observer()`生成的

(另外, set和delete是需要主动调用的.)

每个对象自带一个闭包, 一个键又加一个, 键的值是下一层的递归. **每个闭包都存着当前值和注册要触发的事件.** 并且不管有没有被touch到的机会, 所有对象都会被遍历加上这些东西. 所以vue2要注意, 不要把后端返回实体的所有东西都放到数据里.

而Proxy还产生一个问题, 开发过程中console打印的问题, immer提供了api, vue3也设了个key`__v_raw`来获取target.