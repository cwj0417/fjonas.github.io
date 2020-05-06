---
title: vue源码之响应式数据
date: 2017-12-22 06:35:47
categories: 工作笔记
tags: [vue,vue源码,分析]
---
分析vue是如何实现数据响应的.

<!--more-->

## 前记

住了半个月院, 第一批90后已经痛风/肝损/腰突了. 腰突还很严重, 昨天做了核磁共振, 椎管已经压没了, 网上说1/3就要手术, 害怕. 那么继续之前的工作.

现在回顾一下看数据响应的原因. 之前看了vuex和vue-i18n的源码, 他们都有自己内部的vm, 也就是vue实例. 使用的都是vue的响应式数据特性及`$watch`api. 所以决定看一下vue的源码, 了解vue是如何实现响应式数据.

本文叙事方式为树藤摸瓜, 顺着看源码的逻辑走一遍, 查看的vue的版本为2.5.2.

## 目的

明确调查方向才能直至目标, 先说一下目标行为: 

1. vue中的数据改变, 视图层面就能获得到通知并进行渲染.
2. `$watch`api监听表达式的值, 在表达式中任何一个元素变化以后获得通知并执行回调.

那么准备开始以这个方向为目标从vue源码的入口开始找答案.

## 入口开始

来到`src/core/index.js`, 调了`initGlobalAPI()`, 其他代码是ssr相关, 暂不关心.

进入`initGlobalAPI`方法, 做了一些暴露全局属性和方法的事情, 最后有4个init, initUse是Vue的install方法, 前面vuex和vue-i18n的源码分析已经分析过了. initMixin是我们要深入的部分.

在`initMixin`前面部分依旧做了一些变量的处理, 具体的init动作为:

```js
vm._self = vm
initLifecycle(vm)
initEvents(vm)
initRender(vm)
callHook(vm, 'beforeCreate')
initInjections(vm) // resolve injections before data/props
initState(vm)
initProvide(vm) // resolve provide after data/props
callHook(vm, 'created')
```

vue启动的顺序已经看到了: 加载生命周期/时间/渲染的方法 => beforeCreate钩子 => 调用injection => 初始化state => 调用provide => created钩子.

injection和provide都是比较新的api, 我还没用过. 我们要研究的东西在initState中.

来到initState:

```js
export function initState (vm: Component) {
  vm._watchers = []
  const opts = vm.$options
  if (opts.props) initProps(vm, opts.props)
  if (opts.methods) initMethods(vm, opts.methods)
  if (opts.data) {
    initData(vm)
  } else {
    observe(vm._data = {}, true /* asRootData */) // 如果没有data, _data效果一样, 只是没做代理
  }
  if (opts.computed) initComputed(vm, opts.computed)
  if (opts.watch && opts.watch !== nativeWatch) {
    initWatch(vm, opts.watch)
  }
}
```

做的事情很简单: 如果有props就处理props, 有methods就处理methods, …, 我们直接看`initData(vm)`. 

## initData

initData做了两件事: proxy, observe.

先贴代码, 前面做了小的事情写在注释里了.

```js
function initData (vm: Component) {
  let data = vm.$options.data
  data = vm._data = typeof data === 'function' // 如果data是函数, 用vm作为this执行函数的结果作为data
    ? getData(data, vm)
    : data || {}
  if (!isPlainObject(data)) { // 过滤乱搞, data只接受对象, 如果乱搞会报警并且把data认为是空对象
    data = {}
    process.env.NODE_ENV !== 'production' && warn(
      'data functions should return an object:\n' +
      'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
      vm
    )
  }
  // proxy data on instance
  const keys = Object.keys(data)
  const props = vm.$options.props
  const methods = vm.$options.methods
  let i = keys.length
  while (i--) { // 遍历data
    const key = keys[i]
    if (process.env.NODE_ENV !== 'production') {
      if (methods && hasOwn(methods, key)) { // 判断是否和methods重名
        warn(
          `Method "${key}" has already been defined as a data property.`,
          vm
        )
      }
    }
    if (props && hasOwn(props, key)) { // 判断是否和props重名
      process.env.NODE_ENV !== 'production' && warn(
        `The data property "${key}" is already declared as a prop. ` +
        `Use prop default value instead.`,
        vm
      )
    } else if (!isReserved(key)) { // 判断key是否以_或$开头
      proxy(vm, `_data`, key) // 代理data
    }
  }
  // observe data
  observe(data, true /* asRootData */)
}
```

我们来看一下proxy和observe是干嘛的.

proxy的参数: vue实例, `_data`, 键.

作用: 把vm.key的setter和getter都代理到vm._data.key, 效果就是vm.a实际实际是vm.\_data.a, 设置vm.a也是设置vm.\_data.a.

代码是:

```js
const sharedPropertyDefinition = {
  enumerable: true,
  configurable: true,
  get: noop,
  set: noop
}
export function proxy (target: Object, sourceKey: string, key: string) {
  // 在initData中调用: proxy(vm, `_data`, key)
  // target: vm, sourceKey: _data, key: key. 这里的key为遍历data的key
  // 举例: data为{a: 'a value', b: 'b value'}
  // 那么这里执行的target: vm, sourceKey: _data, key: a
  sharedPropertyDefinition.get = function proxyGetter () {
    return this[sourceKey][key] // getter: vm._data.a
  }
  sharedPropertyDefinition.set = function proxySetter (val) {
    this[sourceKey][key] = val // setter: vm._data.a = val
  }
  Object.defineProperty(target, key, sharedPropertyDefinition) // 用Object.defineProperty来设置getter, setter
  // 第一个参数是vm, 也就是获取`vm.a`就获取到了`vm._data.a`, 设置也是如此.
}
```

代理完成之后是本文的核心, initData最后调用了`observe(data, true)`,来实现数据的响应.

## observe

observe方法其实是一个滤空和单例的入口, 最后行为是创建一个observe对象放到observe目标的`__ob__`属性里, 代码如下:

```js
/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 */
export function observe (value: any, asRootData: ?boolean): Observer | void {
  if (!isObject(value) || value instanceof VNode) { // 只能是监察对象, 过滤非法参数
    return
  }
  let ob: Observer | void
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__ // 如果已被监察过, 返回存在的监察对象
  } else if ( // 符合下面条件就新建一个监察对象, 如果不符合就返回undefined
    observerState.shouldConvert &&
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue
  ) {
    ob = new Observer(value)
  }
  if (asRootData && ob) {
    ob.vmCount++
  }
  return ob
}
```

那么关键是`new Observer(value)`了, 赶紧跳到Observe这个类看看是如何构造的.

以下是Observer的构造函数:

```js
  constructor (value: any) {
    this.value = value // 保存值
    this.dep = new Dep() // dep对象
    this.vmCount = 0
    def(value, '__ob__', this) // 自己的副本, 放到__ob__属性下, 作为单例依据的缓存
    if (Array.isArray(value)) { // 判断是否为数组, 如果是数组的话劫持一些数组的方法, 在调用这些方法的时候进行通知.
      const augment = hasProto
        ? protoAugment
        : copyAugment
      augment(value, arrayMethods, arrayKeys)
      this.observeArray(value) // 遍历数组, 继续监察数组的每个元素
    } else {
      this.walk(value) // 直到不再是数组(是对象了), 遍历对象, 劫持每个对象来发出通知
    }
  }
```

做了几件事:

+ 建立内部Dep对象. (作用是之后在watcher中递归的时候把自己添加到依赖中)
+ 把目标的`__ob__`属性赋值成Observe对象, 作用是上面提过的单例.
+ 如果目标是数组, 进行方法的劫持. (下面来看)
+ 如果是数组就observeArray, 否则walk.

那么我们来看看observeArray和walk方法.

```js
  /**
   * Walk through each property and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   */
  walk (obj: Object) {
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i], obj[keys[i]]) // 用'obj[keys[i]]'这种方式是为了在函数中直接给这个赋值就行了
    }
  }

  /**
   * Observe a list of Array items.
   */
  observeArray (items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
```

我们发现, observeArray的作用是递归调用, 最后调用的方法是**`defineReactive`**, 可以说这个方法是最终的核心了.

下面我们先看一下数组方法劫持的目的和方法, 之后再看`defineReactive`的做法.

## array劫持

之后会知道defineReactive的实现劫持的方法是`Object.defineProperty`来劫持对象的getter, setter, 那么数组的变化不会触发这些劫持器, 所以vue劫持了数组的一些方法, 代码比较零散就不贴了. 

最后的结果就是: array.prototype.push = function () {…}, 被劫持的方法有`['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse']`, 也就是调用这些方法也会触发响应. 具体劫持以后的方法是:

```js
 def(arrayMethods, method, function mutator (...args) {
    const result = original.apply(this, args) // 调用原生的数组方法
    const ob = this.__ob__ // 获取observe对象
    let inserted
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args
        break
      case 'splice':
        inserted = args.slice(2)
        break
    }
    if (inserted) ob.observeArray(inserted) // 继续递归
    // notify change
    ob.dep.notify() // 出发notify
    return result
  })
```

做了两件事: 

1. 递归调用
2. 触发所属Dep的`notify()`方法.

接下来就说最终的核心方法, defineReactive, 这个方法最后也调用了notify().

## defineReactive

这里先贴整个代码:

```js
/**
 * Define a reactive property on an Object.
 */
export function defineReactive (
  // 这个方法是劫持对象key的动作
  // 这里还是举例: 对象为 {a: 'value a', b: 'value b'}, 当前遍历到a
  obj: Object, // {a: 'value a', b: 'value b'}
  key: string, // a
  val: any, // value a
  customSetter?: ?Function,
  shallow?: boolean
) {
  const dep = new Dep()

  const property = Object.getOwnPropertyDescriptor(obj, key)
  if (property && property.configurable === false) { // 判断当前key的操作权限
    return
  }

  // cater for pre-defined getter/setters
  // 获取对象本来的getter setter
  const getter = property && property.get
  const setter = property && property.set

  let childOb = !shallow && observe(val) // childOb是val的监察对象(就是new Observe(val), 也就是递归调用)
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter () {
      const value = getter ? getter.call(obj) : val // 如果本身有getter, 先调用
      if (Dep.target) { // 如果有dep.target, 进行一些处理, 最后返回value, if里的代码我们之后去dep的代码中研究
        dep.depend()
        if (childOb) {
          childOb.dep.depend()
          if (Array.isArray(value)) {
            dependArray(value)
          }
        }
      }
      return value
    },
    set: function reactiveSetter (newVal) {
      const value = getter ? getter.call(obj) : val // 如果本身有getter, 先调用
      /* eslint-disable no-self-compare */
      if (newVal === value || (newVal !== newVal && value !== value)) { // 如果值不变就不去做通知了, (或是某个值为Nan?)
        return
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter() // 根据"生产环境不执行"这个行为来看, 这个方法可能作用是log, 可能是保留方法, 还没地方用?
      }
      if (setter) { // 如果本身有setter, 先调用, 没的话就直接赋值
        setter.call(obj, newVal)
      } else {
        val = newVal // 因为传入参数的时候其实是'obj[keys[i]]', 所以就等于是'obj[key] = newVal'了
      }
      childOb = !shallow && observe(newVal) // 重新建立子监察
      dep.notify() // 通知, 可以说是劫持的核心步骤
    }
  })
}
```

解释都在注释中了, 总结一下这个方法的做的几件重要的事:

+ 建立Dep对象. (下面会说调用的Dep的方法的具体作用)
+ 递归调用. 可以说很大部分代码都在递归调用, 分别在创建子observe对象, setter, getter中.
+ getter中: 调用原来的getter, 收集依赖(Dep.depend(), 之后会解释收集的原理), 同样也是递归收集.
+ setter中: 调用原来的setter, 并判断是否需要通知, 最后调用`dep.notify()`. 

总结一下, 总的来说就是, 进入传入的data数据会被劫持, 在get的时候调用`Dep.depend()`, 在set的时候调用`Dep.notify()`. 那么Dep是什么, 这两个方法又干了什么, 带着疑问去看Dep对象.

## Dep

Dep应该是dependencies的意思. dep.js整个文件只有62行, 所以贴一下:

```js
/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 */
export default class Dep {
  static target: ?Watcher;
  id: number;
  subs: Array<Watcher>;

  constructor () {
    this.id = uid++
    this.subs = []
  }

  addSub (sub: Watcher) {
    this.subs.push(sub)
  }

  removeSub (sub: Watcher) {
    remove(this.subs, sub)
  }

  depend () {
    if (Dep.target) {
      Dep.target.addDep(this)
    }
  }

  notify () {
    // stabilize the subscriber list first
    const subs = this.subs.slice()
    for (let i = 0, l = subs.length; i < l; i++) {
      subs[i].update()
    }
  }
}

// the current target watcher being evaluated.
// this is globally unique because there could be only one
// watcher being evaluated at any time.
// 这是一个队列, 因为不允许有多个watcher的get方法同时调用
Dep.target = null
const targetStack = []

export function pushTarget (_target: Watcher) {
  // 设置target, 把旧的放进stack
  if (Dep.target) targetStack.push(Dep.target)
  Dep.target = _target
}

export function popTarget () {
  // 从stack拿一个作为当前的
  Dep.target = targetStack.pop()
}
```

首先来分析变量:

+ 全局Target. 这个其实是用来跟watcher交互的, 也保证了普通get的时候没有target就不设置依赖, 后面会解释.
+ id. 这是用来在watcher里依赖去重的, 也要到后面解释.
+ subs: 是一个watcher数组. sub应该是subscribe的意思, 也就是当前dep(依赖)的订阅者列表.

再来看方法: 

+ 构造: 设uid, subs. addSub: 添加wathcer, removeSub: 移除watcher. 这3个好无聊.

+ depend: 如果有Dep.target, 就把自己添加到Dep.target中(调用了`Dep.target.addDep(this)`).

  那么什么时候有Dep.target呢, 就由`pushTarget()`和`popTarget()`来操作了, 这些方法在Dep中没有调用, 后面会分析是谁在操作Dep.target.(这个是重点)

+ notify: 这个是setter劫持以后调用的最终方法, 做了什么: 把当前Dep订阅中的每个watcher都调用`update()`方法.

Dep看完了, 我们的疑问都转向了Watcher对象了. 现在看来有点糊涂, 看完Watcher就都明白了.

## Watcher

watcher非常大(而且打watcher这个单词也非常容易手误, 心烦), 我们先从构造看起:

```js
constructor (
    vm: Component,
    expOrFn: string | Function,
    cb: Function,
    options?: Object
  ) {
    this.vm = vm // 保存vm
    vm._watchers.push(this) // 把watcher存到vm里
    // options
    // 读取配置 或 设置默认值
    if (options) {
      this.deep = !!options.deep
      this.user = !!options.user
      this.lazy = !!options.lazy
      this.sync = !!options.sync
    } else {
      this.deep = this.user = this.lazy = this.sync = false
    }
    this.cb = cb
    this.id = ++uid // uid for batching
    this.active = true
    this.dirty = this.lazy // for lazy watchers
    this.deps = []
    this.newDeps = []
    this.depIds = new Set()
    this.newDepIds = new Set()
    this.expression = process.env.NODE_ENV !== 'production' // 非生产环境就记录expOrFn
      ? expOrFn.toString()
      : ''
    // parse expression for getter
    // 设置getter, parse字符串, 并滤空滤错
    if (typeof expOrFn === 'function') {
      this.getter = expOrFn
    } else {
      this.getter = parsePath(expOrFn)
      if (!this.getter) {
        this.getter = function () {}
        process.env.NODE_ENV !== 'production' && warn(
          `Failed watching path: "${expOrFn}" ` +
          'Watcher only accepts simple dot-delimited paths. ' +
          'For full control, use a function instead.',
          vm
        )
      }
    }
    // 调用get获得值
    this.value = this.lazy
      ? undefined
      : this.get()
  }
```

注释都写了, 我来高度总结一下构造器做了什么事:

+ 处理传入的参数并设置成自己的属性.

+ parse表达式. watcher表达式接受2种: 方法/字符串. 如果是方法就设为getter, 如果是字符串会进行处理:

  ```js
  /**
   * Parse simple path.
   */
  const bailRE = /[^\w.$]/
  export function parsePath (path: string): any {
    if (bailRE.test(path)) {
      return
    }
    const segments = path.split('.')
    // 这里是vue如何分析watch的, 就是接受 '.' 分隔的变量.
    // 如果键是'a.b.c', 也就等于function () {return this.a.b.c}
    return function (obj) {
      for (let i = 0; i < segments.length; i++) {
        if (!obj) return
        obj = obj[segments[i]]
      }
      return obj
    }
  }
  ```

  处理的效果写在上面代码的注释里.

+ 调用`get()`方法.

下面说一下get方法. **get()方法是核心, 看完了就能把之前的碎片都串起来了**. 贴get()的代码:

```js
  /**
   * Evaluate the getter, and re-collect dependencies.
   */
  get () {
    pushTarget(this)
    // 进入队列, 把当前watcher设置为Dep.target
    // 这样下面调用getter的时候出发的dep.append() (最后调用Dep.target.addDep()) 就会调用这个watcher的addDep.
    let value
    const vm = this.vm
    try {
      value = this.getter.call(vm, vm)
      // 调用getter的时候会走一遍表达式,
      // 如果是 this.a + this.b , 会在a和b的getter中调用Dep.target.addDep(), 最后结果就调用了当前watcher的addDep,
      // 当前watcher就有了this.a的dep和this.b的dep
      // addDep把当前watcher加入了dep的sub(subscribe)里, dep的notify()调用就会运行本watcher的run()方法.
    } catch (e) {
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {
      // "touch" every property so they are all tracked as
      // dependencies for deep watching
      // 走到这里已经通过了getter获得到了value, 或者失败为undefined, 这个值返回作为watcher的valule
      // 处理deep选项 (待看)
      if (this.deep) {
        traverse(value)
      }
      popTarget() // 移除队列
      this.cleanupDeps() // 清理依赖(addDep加到newDep数组, 这步做整理动作)
    }
    return value
  }
```

注释都在代码中了, 这段理解了就对整个响应系统理解了. 

我来总结一下: (核心, 非常重要)

+ **dep方面: 传入vue参数的data(实际是所有调用`defineReactive`的属性)都会产生自己的Dep对象.**

+ **Watcher方面: 在所有new Watcher的地方产生Watcher对象.**

+ **dep与Watcher关系: Watcher的get方法建立了双方关系:**

  **把自己设为target, 运行watcher的表达式(即调用相关数据的getter), 因为getter有钩子, 调用了Watcher的addDep, addDep方法把dep和Watcher互相推入互相的属性数组(分别是deps和subs)**

+ **dep与Watcher建立了多对多的关系: dep含有订阅的watcher的数组, watcher含有所依赖的变量的数组**

+ **当dep的数据调动setter, 调用notify, 最终调用Watcher的update方法**.

+ **前面提到dep与Watcher建立关系是通过`get()`方法, 这个方法在3个地方出现: 构造方法, run方法, evaluate方法. 也就是说, notify了以后会重新调用一次get()方法. (所以在lifycycle中调用的时候把依赖和触发方法都写到getter方法中了). **

那么接下来要看一看watcher在什么地方调用的.

找了一下, 一共三处: 

+ initComputed的时候: (state.js) 

  ```js
  watchers[key] = new Watcher(
          vm,
          getter || noop,
          noop,
          computedWatcherOptions
        )
  ```

+ $watch api: (state.js)

  ```js
  new Watcher(vm, expOrFn, cb, options)
  ```

+ lifecycle的mount阶段: (lifecycle.js)

  ```js
  new Watcher(vm, updateComponent, noop)
  ```

## 总结

看完源码就不神秘了, 写得也算很清楚了. 当然还有很多细节没写, 因为冲着目标来.

总结其实都在上一节的粗体里了.

## 甜点

我们只从data看了, 那么props和computed应该也是这样的, 因为props应该与组建相关, 下回分解吧, 我们来看看computed是咋回事吧.

```js
const computedWatcherOptions = { lazy: true }

function initComputed (vm: Component, computed: Object) {
  const watchers = vm._computedWatchers = Object.create(null)
  // computed properties are just getters during SSR
  const isSSR = isServerRendering()
  for (const key in computed) {
    // 循环每个computed
    // ------------
    // 格式滤错滤空
    const userDef = computed[key]
    const getter = typeof userDef === 'function' ? userDef : userDef.get
    if (process.env.NODE_ENV !== 'production' && getter == null) {
      warn(
        `Getter is missing for computed property "${key}".`,
        vm
      )
    }

    if (!isSSR) {
      // create internal watcher for the computed property.
      // 为computed建立wathcer
      watchers[key] = new Watcher(
        vm,
        getter || noop,
        noop,
        computedWatcherOptions
      )
    }

    // component-defined computed properties are already defined on the
    // component prototype. We only need to define computed properties defined
    // at instantiation here.
    // 因为没有被代理, computed属性是不能通过vm.xx获得的, 如果可以获得说明重复定义, 抛出异常.
    if (!(key in vm)) {
      defineComputed(vm, key, userDef)
    } else if (process.env.NODE_ENV !== 'production') {
      if (key in vm.$data) {
        warn(`The computed property "${key}" is already defined in data.`, vm)
      } else if (vm.$options.props && key in vm.$options.props) {
        warn(`The computed property "${key}" is already defined as a prop.`, vm)
      }
    }
  }
}
```

已注释, 总结为:

+ 遍历每个computed键值, 过滤错误语法.
+ 遍历每个computed键值, 为他们建立watcher, options为`{ lazy: true}`.
+ 遍历每个computed键值, 调用defineComputed.

那么继续看defineComputed.

```js
export function defineComputed (
  target: any,
  key: string,
  userDef: Object | Function
) {
  const shouldCache = !isServerRendering()
  // 因为computed除了function还有get set 字段的语法, 下面的代码是做api的兼容
  if (typeof userDef === 'function') {
    sharedPropertyDefinition.get = shouldCache
      ? createComputedGetter(key)
      : userDef
    sharedPropertyDefinition.set = noop
  } else {
    sharedPropertyDefinition.get = userDef.get
      ? shouldCache && userDef.cache !== false
        ? createComputedGetter(key)
        : userDef.get
      : noop
    sharedPropertyDefinition.set = userDef.set
      ? userDef.set
      : noop
  }
  // 除非设置setter, computed属性是不能被修改的, 抛出异常 (evan说改变了自由哲学, 要控制低级用户)
  if (process.env.NODE_ENV !== 'production' &&
      sharedPropertyDefinition.set === noop) {
    sharedPropertyDefinition.set = function () {
      warn(
        `Computed property "${key}" was assigned to but it has no setter.`,
        this
      )
    }
  }
  // 其实核心就下面这步... 上面步骤的作用是和data一样添加一个getter, 增加append动作. 现在通过vm.xxx可以获取到computed属性啦!
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

function createComputedGetter (key) {
  return function computedGetter () {
    const watcher = this._computedWatchers && this._computedWatchers[key]
    if (watcher) {
      if (watcher.dirty) {
        watcher.evaluate()
      }
      if (Dep.target) {
        watcher.depend()
      }
      return watcher.value
    }
  }
}
```

因为computed可以设置getter, setter, 所以computed的值不一定是function, 可以为set和get的function, 很大部分代码是做这些处理, 核心的事情有2件:

+ 使用Object.defineProperty在vm上挂载computed属性.
+ 为属性设置getter, getter做了和data一样的事: depend. 但是多了一步: `watcher.evalueate()`.

看到这里, computed注册核心一共做了两件事:

1. 为每个computed建立watcher(lazy: true)
2. 建立一个getter来depend, 并挂到vm上.

那么dirty成了疑问, 我们回到watcher的代码中去看, lazy和dirty和evaluate是干什么的.

精选相关代码:

+ (构造函数中) `this.dirty = this.lazy`

+ (构造函数中) `this.value = this.lazy  ? undefined  : this.get()`

+ (evaluate函数) 

  ```js
  evaluate () {
      this.value = this.get()
      this.dirty = false
    }
  ```

到这里已经很清楚了. 因为还没设置getter, 所以在建立watcher的时候不立即调用getter, 所以构造函数没有马上调用get, 在设置好getter以后调用evaluate来进行依赖注册.

总结: computed是watch+把属性挂到vm上的行为组合.

