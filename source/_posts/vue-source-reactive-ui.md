---
title: vue源码之数据控制视图
date: 2018-03-26 17:35:16
categories: 编码与分析
tags: [vue,vue源码,分析]
---
分析vue是如何实现数据改变更新视图的.

<!--more-->

## 前记

三个月前看了vue源码来分析如何做到响应式数据的, 文章名字叫*vue源码之响应式数据*, 最后分析到, 数据变化后会调用`Watcher`的`update()`方法. 那么时隔三月让我们继续看看`update()`做了什么. (这三个月用react-native做了个项目, 也无心总结了, 因为好像太简单了).

本文叙事方式为树藤摸瓜, 顺着看源码的逻辑走一遍, 查看的vue的版本为2.5.2. 我[fork了一份](https://github.com/fjonas/vue)源码用来记录注释.

## 目的

明确调查方向才能直至目标, 先说一下目标行为:  **数据变化以后执行了什么方法来更新视图的.** 那么准备开始以这个方向为目标从vue源码的入口开始找答案.

## 从之前的结论开始

先来复习一下之前的结论:

+ vue构造的时候会在data(和一些别的字段)上建立Observer对象, getter和setter被做了拦截, getter触发依赖收集, setter触发notify.
+ 另一个对象是Watcher, 注册watch的时候会调用一次watch的对象, 这样触发了watch对象的getter, 把依赖收集到当前Watcher的deps里, 当任何dep的setter被触发就会notify当前Watcher来调用Watcher的`update()`方法.

那么这里就从注册渲染相关的Watcher开始.

找到了文件在`src/core/instance/lifecycle.js`中.

```js
new Watcher(vm, updateComponent, noop, null, true /* isRenderWatcher */)
```

## mountComponent

渲染相关的Watcher是在`mountComponent()`这个方法中调用的, 那么我们搜一下这个方法是在哪里调用的. 只有2处, 分别是`src/platforms/web/runtime/index.js`和`src/platforms/weex/runtime/index.js`, 以web为例:

```js
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  el = el && inBrowser ? query(el) : undefined
  return mountComponent(this, el, hydrating)
}
```

原来如此, 是`$mount()`方法调用了`mountComponent()`, (或者在vue构造时指定`el`字段也会自动调用`$mount()`方法), 因为web和weex([什么是weex?之前别的文章介绍过](https://yo-cwj.com/2018/01/01/weex-quick-start/))渲染的标的物不同, 所以在发布的时候应该引入了不同的文件最后发不成不同的dist(这个问题留给之后来研究vue的整个流程).

下面是mountComponent方法:

```js
export function mountComponent (
  vm: Component,
  el: ?Element,
  hydrating?: boolean
): Component {
  vm.$el = el // 放一份el到自己的属性里
  if (!vm.$options.render) { // render应该经过处理了, 因为我们经常都是用template或者vue文件
    // 判断是否存在render函数, 如果没有就把render函数写成空VNode来避免红错, 并报出黄错
    vm.$options.render = createEmptyVNode
    if (process.env.NODE_ENV !== 'production') {
      /* istanbul ignore if */
      if ((vm.$options.template && vm.$options.template.charAt(0) !== '#') ||
        vm.$options.el || el) {
        warn(
          'You are using the runtime-only build of Vue where the template ' +
          'compiler is not available. Either pre-compile the templates into ' +
          'render functions, or use the compiler-included build.',
          vm
        )
      } else {
        warn(
          'Failed to mount component: template or render function not defined.',
          vm
        )
      }
    }
  }
  callHook(vm, 'beforeMount')

  let updateComponent
  /* istanbul ignore if */
  if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
    // 不看这里的代码了, 直接看else里的, 行为是一样的
    updateComponent = () => {
      const name = vm._name
      const id = vm._uid
      const startTag = `vue-perf-start:${id}`
      const endTag = `vue-perf-end:${id}`

      mark(startTag)
      const vnode = vm._render()
      mark(endTag)
      measure(`vue ${name} render`, startTag, endTag)

      mark(startTag)
      vm._update(vnode, hydrating)
      mark(endTag)
      measure(`vue ${name} patch`, startTag, endTag)
    }
  } else {
    updateComponent = () => {
      vm._update(vm._render(), hydrating)
    }
  }

  // we set this to vm._watcher inside the watcher's constructor
  // since the watcher's initial patch may call $forceUpdate (e.g. inside child
  // component's mounted hook), which relies on vm._watcher being already defined
  // 注册一个Watcher
  new Watcher(vm, updateComponent, noop, null, true /* isRenderWatcher */)
  hydrating = false

  // manually mounted instance, call mounted on self
  // mounted is called for render-created child components in its inserted hook
  if (vm.$vnode == null) {
    vm._isMounted = true
    callHook(vm, 'mounted')
  }
  return vm
}
```

这段代码其实只做了3件事:

+ 调用beforeMount钩子
+ 建立Watcher
+ 调用mounted钩子

(哈哈哈)那么其实核心就是建立Watcher了.

看一下Watcher的参数: vm是this, updateComponent是一个函数, noop是空, null是空, true代表是RenderWatcher.

在Watcher里看了`isRenderWatcher`:

```js
if (isRenderWatcher) {
      vm._watcher = this
    }
```

是的, 只是复制了一份用来在watcher第一次patch的时候判断一些东西(从注释里看的, 我现在还不知道是干嘛的).

那么只有一个问题没解决就是`updateComponent`是个什么东西.

## updateComponent

在Watcher的构造函数的第二个参数传了function, 那么这个函数就成了watcher的getter. 聪明的你应该已经猜到, 在这个`updateComponent`里一定调用了视图中所有的数据的getter, 才能在watcher中建立依赖从而让视图响应数据的变化.

```js
updateComponent = () => {
      vm._update(vm._render(), hydrating)
    }
```

那么就去找`vm._update()`和`vm._render()`.

在`src/core/instance/render.js`找到了`._render()`方法.

```js
Vue.prototype._render = function (): VNode {
    const vm: Component = this
    const { render, _parentVnode } = vm.$options // todo: render和_parentVnode的由来

    // reset _rendered flag on slots for duplicate slot check
    if (process.env.NODE_ENV !== 'production') {
      for (const key in vm.$slots) {
        // $flow-disable-line
        vm.$slots[key]._rendered = false
      }
    }

    if (_parentVnode) {
      vm.$scopedSlots = _parentVnode.data.scopedSlots || emptyObject
    }

    // set parent vnode. this allows render functions to have access
    // to the data on the placeholder node.
    vm.$vnode = _parentVnode
    // render self
    let vnode
    try {
      vnode = render.call(vm._renderProxy, vm.$createElement)
    } catch (e) {
      // catch其实不需要看了, 都是做异常处理, _vnode是在vm._update的时候保存的, 也就是上次的状态或是null(init的时候给的)
      handleError(e, vm, `render`)
      // return error render result,
      // or previous vnode to prevent render error causing blank component
      /* istanbul ignore else */
      if (process.env.NODE_ENV !== 'production') {
        if (vm.$options.renderError) {
          try {
            vnode = vm.$options.renderError.call(vm._renderProxy, vm.$createElement, e)
          } catch (e) {
            handleError(e, vm, `renderError`)
            vnode = vm._vnode
          }
        } else {
          vnode = vm._vnode
        }
      } else {
        vnode = vm._vnode
      }
    }
    // return empty vnode in case the render function errored out
    if (!(vnode instanceof VNode)) {
      if (process.env.NODE_ENV !== 'production' && Array.isArray(vnode)) {
        warn(
          'Multiple root nodes returned from render function. Render function ' +
          'should return a single root node.',
          vm
        )
      }
      vnode = createEmptyVNode()
    }
    // set parent
    vnode.parent = _parentVnode
    return vnode
  }
}
```

这个方法做了:

+ 根据当前vm的render方法来生成VNode. (render方法可能是根据template或vue文件编译而来, 所以推论直接写render方法效率最高)
+ 如果render方法有问题, 那么首先调用renderError方法, 再不行就读取上次的vnode或是null.
+ 如果有父节点就放到自己的`.parent`属性里.
+ 最后返回VNode

所以核心是这句:

```js
vnode = render.call(vm._renderProxy, vm.$createElement)
```

其中的`render()`, `vm._renderProxy`, `vm.$createElement`都不知道是什么.

先看`vm._renderProxy`: 是`initMixin()`的时候设置的, 在生产环境返回vm, 开发环境返回代理, 那么我们认为他是一个可以debug的vm(就是vm), 细节之后再看.

`vm.$createElement`的代码在vdom文件夹下, 看了下是一个方法, 返回值一个VNode.

render有点复杂, 能不能以后研究, 总之就是把template或者vue单文件和mount目标parse成render函数.

**小总结: vm._render()的返回值是VNode, 根据当前vm的render函数**

接下来看`vm._update()`

```js
Vue.prototype._update = function (vnode: VNode, hydrating?: boolean) {
    const vm: Component = this
    if (vm._isMounted) {
      callHook(vm, 'beforeUpdate')
    }
    // 记录update之前的状态
    const prevEl = vm.$el
    const prevVnode = vm._vnode
    const prevActiveInstance = activeInstance
    activeInstance = vm
    vm._vnode = vnode
    // Vue.prototype.__patch__ is injected in entry points
    // based on the rendering backend used.
    if (!prevVnode) { // 初次加载, 只有_update方法更新vm._vnode, 初始化是null
      // initial render
      vm.$el = vm.__patch__( // patch创建新dom
        vm.$el, vnode, hydrating, false /* removeOnly */,
        vm.$options._parentElm,
        vm.$options._refElm
      )
      // no need for the ref nodes after initial patch
      // this prevents keeping a detached DOM tree in memory (#5851)
      vm.$options._parentElm = vm.$options._refElm = null
    } else {
      // updates
      vm.$el = vm.__patch__(prevVnode, vnode) // patch更新dom
    }
    activeInstance = prevActiveInstance
    // update __vue__ reference
    if (prevEl) {
      prevEl.__vue__ = null
    }
    if (vm.$el) {
      vm.$el.__vue__ = vm
    }
    // if parent is an HOC, update its $el as well
    if (vm.$vnode && vm.$parent && vm.$vnode === vm.$parent._vnode) {
      vm.$parent.$el = vm.$el
    }
    // updated hook is called by the scheduler to ensure that children are
    // updated in a parent's updated hook.
  }
```

我们关心的部分其实就是`__patch()`的部分, `__patch()`做了对dom的操作, 在`_update()`里判断了是否是初次调用, 如果是的话创建新dom, 不是的话传入新旧node进行比较再操作.

## 结论

+ vue的视图渲染是一种特殊的Watcher, watch的内容是一个函数, 函数运行的过程调用了render函数, render又是由template或者el的dom编译成的(template中含有一些被observe的数据). 所以template中被observe的数据有变化触发Watcher的update()方法就会重新渲染视图.

## 遗留

+ render函数是在哪里被编译的
+ vue源码发布时引入不同平台最后打成dist的流程是什么
+ `__patch__`和VNode的分析