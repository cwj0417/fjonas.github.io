---
title: vue源码之virtual dom
date: 2018-04-03 10:32:01
categories: 编码与分析
tags: [vue,vue源码,分析]
---
这次来看看vue的虚拟dom是咋肥色儿~

<!--more-->

## 回顾

之前分析如何数据响应到视图最后发现是调用了`__patch()__`方法来生成/diff`dom`的. 最后留下了2个问题~ 1. template或者el是如何被编译成render的. 2. patch的实现.

template或者el被编译成render差不多就是正则匹配~ 然后统一成render函数的格式, 所以我们直接用render函数套进patch可以知道patch的参数的样子, 可以先看patch的实现.

本文叙事方式为树藤摸瓜, 顺着看源码的逻辑走一遍, 查看的vue的版本为2.5.2. 我[fork了一份](https://github.com/fjonas/vue)源码用来记录注释.

## 开始了

先来承接上局的源码分析~

```js
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
```

从这里看出~ 创建dom调用的时候传了6个参数, diff的时候传了2个参数. 那么就想一个例子来看创建和diff的过程.

```js
render: function (createElement) {
  return createElement('h1', this.blogTitle)
}
```

这个例子是从vue文档的render function这里拿来的~ 现在我们就来看看这个例子的调用发生了什么~ (和之前一样是以web为例).

参数中的`_parentElm`和`_refElm`暂时没找到, 缓缓, 其中的`vnode`, `preVnode`, `vnode`都是`_render()`方法的返回值(上篇讲过了), 那么我们来看看`_render()`方法吧.

## ` _render()`

```js
  Vue.prototype._render = function (): VNode {
    const vm: Component = this
    const { render, _parentVnode } = vm.$options // render是由template或el编译而来的, parentVnode是更新子component的
	...
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

节选了一段代码, 这里做的事情就是: `render.call(vm._renderProxy, vm.$createElement)`, 或者在发生错误的时候尝试使用`renderError()`方法(好像之前也说过了), 如果再错误就避免系统崩溃创建一个空vnode`vnode = createEmptyVNode()`. 那么一切正常的话就是调用render方法, 我们把之前的例子套进去~

`vm.renderProxy`之前说过就是`vm`. `$createElement`找到了在`src/core/vdom/create-element.js`. 代入例子结果为:

```js
vm.$createElement('h1', vm.blogTitle)
```

所以看一下`_createElement()`

```js
export function _createElement (
  context: Component,
  tag?: string | Class<Component> | Function | Object,
  data?: VNodeData,
  children?: any,
  normalizationType?: number
): VNode | Array<VNode> {
  // 对应例子的参数: context: vm, tag: 'h1', data: vm.blogTitle
  ... // 省略
  let vnode, ns
  if (typeof tag === 'string') {
    let Ctor
    ns = (context.$vnode && context.$vnode.ns) || config.getTagNamespace(tag) // 如果有旧的取旧的, 没得就获得, 用来判断svg或者math
    if (config.isReservedTag(tag)) {
      // platform built-in elements
      vnode = new VNode(
        config.parsePlatformTagName(tag), data, children,
        undefined, undefined, context
      )
    } else if (isDef(Ctor = resolveAsset(context.$options, 'components', tag))) {
      // resolveAsset: 如果有 options.components[tag], 就返回他, 也就是返回了一个component
      // component
      vnode = createComponent(Ctor, data, context, children, tag)
    } else {
      // unknown or unlisted namespaced elements
      // check at runtime because it may get assigned a namespace when its
      // parent normalizes children
      // 对这个情况在后面做处理~ 这里先正常返回
      vnode = new VNode(
        tag, data, children,
        undefined, undefined, context
      )
    }
  } else {
    // direct component options / constructor
    // 另一种语法: 直接传component options的情况
    vnode = createComponent(tag, data, context, children)
  }
  if (Array.isArray(vnode)) {
    return vnode
  } else if (isDef(vnode)) {
    if (isDef(ns)) applyNS(vnode, ns) // 把ns放到vnode上
    if (isDef(data)) registerDeepBindings(data) // 对style和class做数据响应
    return vnode
  } else {
    return createEmptyVNode()
  }
```

createElement里先判断了tag: 是否是字符串/是否html标签/是否自定义组件来调用`new VNode()`或是`createComponent()`.

VNode的构造函数啥都没做, 就保存下数据然后返回vnode. `createComponent()`又引入了好多, 子组件作为之后讨论的话题吧. 

对于我们的例子~ 返回值就是`new VNode('h1', vm.blogTitle, undefined, undefined, undefined, vm)`. 也就是一个包含了这些信息的vnode对象.

那么来看`__patch__()`方法~

`src/platforms/web/runtime/patch.js`:

```js
import * as nodeOps from 'web/runtime/node-ops'
import { createPatchFunction } from 'core/vdom/patch'
import baseModules from 'core/vdom/modules/index'
import platformModules from 'web/runtime/modules/index'

// the directive module should be applied last, after all
// built-in modules have been applied.
const modules = platformModules.concat(baseModules)

export const patch: Function = createPatchFunction({ nodeOps, modules })
```

这里根据平台的node操作库和平台专有module来生成patch函数.

nodeOps在web中就是操作dom的动作了, document.createElement这种.

modules的值是各个声明周期调用的方法. 在`createPatchFunction()`里只有一小段代码关于调用的, 下面马上会贴. 下一节进入`createPatchFunction()`来看看`__patch__()`方法的面目.

## `__patch__()`

到核心了~ 先贴一下`createPatchFunction()`:

```js
export function createPatchFunction (backend) {
  let i, j
  const cbs = {}

  const { modules, nodeOps } = backend

  for (i = 0; i < hooks.length; ++i) { // 把modules的各个生命周期执行的方法按照"cbs.hookName = [function (){}, function () {}]"的格式推到cbs里.
    cbs[hooks[i]] = []
    for (j = 0; j < modules.length; ++j) {
      if (isDef(modules[j][hooks[i]])) {
        cbs[hooks[i]].push(modules[j][hooks[i]])
      }
    }
  }
    ... // 省略大段方法
 return function patch (oldVnode, vnode, hydrating, removeOnly, parentElm, refElm) {
    if (isUndef(vnode)) {
      if (isDef(oldVnode)) invokeDestroyHook(oldVnode) // 根据新旧vnode是否存在来判断是否要调用destroy钩子
      return
    }

    let isInitialPatch = false // 是创建模式还是diff模式, 初始值diff模式
    const insertedVnodeQueue = []

    if (isUndef(oldVnode)) { // 如果old vnode为空, 就是创建模式
      // empty mount (likely as component), create new root element
      isInitialPatch = true
      createElm(vnode, insertedVnodeQueue, parentElm, refElm) // 创建dom, patch剩下所有代码都是diff
    } else {
      ... // diff dom的操作, 之后再贴
}
```

我们来看一下我们例子是怎么调用的:

```js
vm.__patch__( // patch创建新dom
        vm.$el, vnode, false, false /* removeOnly */,
        vm.$options._parentElm,
        vm.$options._refElm
      )
vm.__patch__(prevVnode, vnode) // diff的时候
```

先来看创建, 创建dom的内容很简单: `createElm(vnode, insertedVnodeQueue, parentElm, refElm)`, 贴一下createElm的核心部分:

```js
function createElm (
    vnode,
    insertedVnodeQueue,
    parentElm,
    refElm,
    nested,
    ownerArray,
    index
  ) {
    ...
    const data = vnode.data
    const children = vnode.children
    const tag = vnode.tag
    if (isDef(tag)) {
      vnode.elm = vnode.ns
        ? nodeOps.createElementNS(vnode.ns, tag) // 这个还是针对svg和math
        : nodeOps.createElement(tag, vnode) // vnode.elm已经是dom了
      setScope(vnode) // 如果有scoped的话给node的attr加上scope标识

      /* istanbul ignore if */
      if (__WEEX__) {
        ...
      } else {
        createChildren(vnode, children, insertedVnodeQueue) // 处理子组件
        if (isDef(data)) {
          invokeCreateHooks(vnode, insertedVnodeQueue)
        }
        insert(parentElm, vnode.elm, refElm) // 把dom插到父组件上
      }

      if (process.env.NODE_ENV !== 'production' && data && data.pre) {
        creatingElmInVPre--
      }
    } else if (isTrue(vnode.isComment)) {
      vnode.elm = nodeOps.createComment(vnode.text)
      insert(parentElm, vnode.elm, refElm)
    } else {
      vnode.elm = nodeOps.createTextNode(vnode.text)
      insert(parentElm, vnode.elm, refElm)
    }
  }
```

这里的主要流程是: 判断是否有tag, 如果是的话, 创建tag的dom, 如果不是, 判断是否是注释来添加注释或文字节点.

创建dom:

```js
vnode.elm = vnode.ns
        ? nodeOps.createElementNS(vnode.ns, tag) // 这个还是针对svg和math
        : nodeOps.createElement(tag, vnode) // vnode.elm已经是dom了
```

贴上:

```js

```

这里的parentElm和refElm我竟然找了2小时没找到, 估摸着应该是父组件或是el. 之后再研究了.

createElemenNS的话就是针对svg和math~ 最后调用的就是`document.createElement('h1')`了(针对本文的例子), 然后调用`createChildren(vnode, children, insertedVnodeQueue)` 来把我们的`h1`创建文字子节点.

```js
  function createChildren (vnode, children, insertedVnodeQueue) {
    if (Array.isArray(children)) {
      if (process.env.NODE_ENV !== 'production') {
        checkDuplicateKeys(children)
      }
      for (let i = 0; i < children.length; ++i) {
        createElm(children[i], insertedVnodeQueue, vnode.elm, null, true, children, i) // 递归调用createElm
      }
    } else if (isPrimitive(vnode.text)) {
      nodeOps.appendChild(vnode.elm, nodeOps.createTextNode(String(vnode.text))) // 是字的话简单地贴上就ok
    }
  }
```

// diff dom的代码看不动了, vue的源码告一段落. 小总结: vnode是保存node信息的对象, 调用patch的时候调用平台专属的node操作来贴到真实dom上.