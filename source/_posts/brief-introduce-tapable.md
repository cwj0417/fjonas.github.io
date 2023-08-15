---
title: 简单介绍tapable
categories: 工作笔记
date: 2023-08-10 16:41:17
tags: [webpack]
---
调试webpack一定避免不了tapable.

有时走进一段不认识的代码, step into烦了, 就选择step over, 然后就直接跑完了.

所以最好简单看下tapable才能更好调试webpack.

<!--more-->

所以本文目的就是简单看下流程并解决调试时的困惑. 内容很简单, 看代码大概就花了零碎的2~3小时. (前几篇webpack都花了2~3周了)

### 使用方法

tapable输出了若干个hook的构造函数, 但所有构造函数的流程是大同小异的, 所以这里就用`SyncHook`来说.

1. `import { SyncHook } from 'tapable'`  tapable的输出是个构造函数.
2. `const hook = new SyncHook()` 实例化.
3. `hook.tap('id', console.log)` 在实例化上注册.
4. `hook.call('hello')` 调用.

很明显就是个订阅发布系统, 所以就是在`tap`的时候把方法存起来, `call`的时候拿出来调用.

比普通订阅发布还简单的是, tapable的订阅不需要根据key查找, 因为不同hook是需要主动声明, 不存在动态创建的.

具体的最佳实践看文档就行了, 但我相信稍微看过点webpack的都比较了解了.

### tapable输出对象观察

不同的hook输出的构造函数, 都会实例化一个`Hook`. 并且修改一些实例的方法.

每个hook都会修改`compile`方法, 可以说是每个hook区别的关键.

另外, 不同hook可以调用的tap和call方法不同, 所以要把不能调用的禁用掉, 这些操作都不重要.

所以总结是: **所有输出的hook, 都是`Hook`的实例, 主要是`compile`方法不同. **

接下来就看看`Hook`的tap和call系列的方法. 

### tap

```js
tap(options, fn) {
  this._tap("sync", options, fn);
}

tapAsync(options, fn) {
  this._tap("async", options, fn);
}

tapPromise(options, fn) {
  this._tap("promise", options, fn);
}
```

进入到`_tap()`方法, 可以看到tap系列的方法的区别, 只是`type`不同.

经过一波整理和拦截器加载, 可以看到每个tap都是以对象的形式保存起来的.

tap的主要的信息有`name`, `type`, `fn`, 高级信息有`before`, `stage`. (高级用法可以在webpack代码里看到, 看起来是控制执行顺序)

然后调用`_insert()`方法, 根据`before`和`stage`把每个tap放到`Hook.taps`里.

### call

```js
const CALL_DELEGATE = function(...args) {
	this.call = this._createCall("sync");
	return this.call(...args);
};
const CALL_ASYNC_DELEGATE = function(...args) {
	this.callAsync = this._createCall("async");
	return this.callAsync(...args);
};
const PROMISE_DELEGATE = function(...args) {
	this.promise = this._createCall("promise");
	return this.promise(...args);
};
```

可以看到, call系列的方法和tap系列的很像, 也是调用了同一个方法, 传了不同的type而已.

```js
_createCall(type) {
  return this.compile({
    taps: this.taps,
    interceptors: this.interceptors,
    args: this._args,
    type: type
  });
}
```

而`_createCall()`方法, 就是调用了`compile()`方法, 用实例中保存的几个信息, 把多个tap合成一个方法. 供上一级方法调用.

这里的`compile`之前已经提到, 每个hook都不同.

`compile`方法是通过使用`HookCodeFactory`的一些方法, 根据taps和类型, 合成单个方法. (具体方法不展开, 我没细看, 主要是字符串拼接)

至于为什么用new Function, 为什么要合成一个方法, [讨论](https://github.com/webpack/tapable/issues/162)的不少, 我也不想站立场, 这里有个[monomorphic方法](https://mrale.ph/blog/2015/01/11/whats-up-with-monomorphism.html)的概念.

### 总结: 调试webpack时遇到tapable应该如何处理

当我们调试webpack方法进入了一个临时方法, 就不慌了, 我们已经知道了他是被compile出来的.

在临时方法的`_x`里是可以通过tap的name看到当前hook注册了哪些tap的.

总结一下, 在调试webpack时进入call方法以后: 

+ 要step over `compile()`方法.
+ 在临时方法里可以查看到当前hook还有哪些tap. (通过tap的name)
+ 可以根据需求step over.
+ 如果想跳过所有, 在run to临时方法的最后一行, 再step into就行了.

