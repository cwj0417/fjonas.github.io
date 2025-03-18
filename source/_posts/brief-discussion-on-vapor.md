---
title: 浅聊vapor
categories: 工作笔记
date: 2025-03-18 12:33:36
tags: [vue]
---
之前整理 vue 流程的时候了解到了 vapor, 所以现在来大概了解一下.

<!--more-->

## 什么是 vapor

接着上篇 post 对 vue 概念的分析, 操作 dom 性能开销大, 所以有了 vdom 的概念.

用 js 对象来描述 dom 结构, 把新老 vdom 对比, 来分析数据变更导致页面变化"最小的 dom 操作".

借鉴于 solidjs 和 svelte 的无 vdom 思路, 和 vue 的流程和可拓展性, vue 也可以尝试无 dom 模式.

(八卦: vapor 作者用 svelte 写了个爱坤组件库, 所以对 svelte 比较了解, 现在 vapor 被收到 vue 仓库中开发了)

我粗粗看了下 vapor 是如何避免 vdom 的.

## 如何绕开 vdom

先来回顾下 vdom 挂载与更新流程: 执行 render 函数, 获得 vnode => 根据新老 vnode 对比, 进行 dom 操作.

响应式的 effect 是包裹上述全流程的, 所以数据变化就会引起上面的步骤重新执行.

### 简单的思考

虽然绕开 vdom, 但有两个点是少不了的:

+ 响应式: 让数据更改可以触发界面变化, 并且可以使用新数据.
+ dom 操作: 最后改变页面的动作.

因为这些操作对用户是透明的, 所以选择在编译阶段处理.

### sfc 编译结果

在 vue 的 sfc playground, 观察一下 vapor 的编译结果.

`template`就是初始的:

```vue
<script setup vapor>
import { ref } from 'vue'

const msg = ref('Hello World!')
</script>

<template>
  <h1>{{ msg }}</h1>
  <input :value="msg" @input="v => msg = v.target.value"  />
</template>
```

vapor 编译结果中的 render 函数是这样的:

```js
const t0 = _template("<h1> </h1>")
const t1 = _template("<input>")
_delegateEvents("input")
function render(_ctx, $props, $emit, $attrs, $slots) {
  const n0 = t0()
  const n1 = t1()
  const x0 = _child(n0)
  n1.$evtinput = v => _ctx.msg = v.target.value
  
  _renderEffect(() => {
    const _msg = _ctx.msg
    
    _setText(x0, _toDisplayString(_msg))
    _setValue(n1, _msg)
  })
  
  return [n0, n1]
}
```

这个 render 函数做了:

1. 分析了 `template` , 把每部分内容都通过`_template()`函数生成真实 dom. 注意 dom 是空的.
2. 为 dom 绑定事件.
3. 创建一个 `renderEffect`, 更新有响应式数据绑定的 dom.

可以看到, vapor 的主要魔法在于, **在编译阶段把数据和 dom 的关系直接关联起来了**.

而 vue 3 在编译阶段已经完成了静态分析, 这个方案和现在的 vue 是很契合的.

### 试一下多变量与数组

此时我心里有了疑问, 想看看多个变量和数组的处理.

我做了第一个小修改, 增加了个 `ref` 变量与一个 `h2`, 在模板上新增了一个插值表达式.

编译结果中仍然只有一个 `renderEffect`, 所以**vapor 的更新粒度是组件**, 可能是避免重走 vue 1 的粒度过小的老问题.

做了第二个小修改, 数组遍历, 模板如下:

```vue
<template>
  <div v-for="item in array">
    {{item + 1}}
  </div>
</template>
```

编译结果是这样的:

```js
const t0 = _template("<div> </div>", true)
function render(_ctx, $props, $emit, $attrs, $slots) {
  const n0 = _createFor(() => (_ctx.array), (_for_item0) => {
    const n2 = t0()
    const x2 = _child(n2)
    _renderEffect(() => _setText(x2, _toDisplayString(_for_item0.value + 1)))
    return n2
  })
  return n0
}
```

粗看发现, `renderEffect` 被设在了组件内部.

但这样只能处理修改数组元素的情况, 那么如果直接对数组操作呢?

来看 `_createFor()` 函数, 也是用 `renderEffect()` 驱动的, 和以前的 diff children 差不多的逻辑.

如此这般, 这里就产生了 `数组长度 + 1` 数量的 watcher, 并且也需要进行 vdom 那样的 diff 算法.

**这2个小功能的观察让我感觉到 vapor 的开发量是很大的**, 并且应该是照着测试用例先完成功能, 再优化具体实现的.

vapor 宣传的包体积小应该是稳定的, 但性能方面, 还得后续看.

### 与以前流程的变化

我们现在已经知道了:

1. vapor 模式在编译的时候就让 render 函数返回了真实 dom, 并且建立了可以精准修改 dom 的 effect.
2. vapor 提供了一些方法来支持上面说的行为, 比如前面例子中的`template()`,`setText()`, `createFor()`等方法. 都是主版本 vue 没有的方法.

如果对 vue 流程熟悉的朋友, 应该已经想到, vapor 的改动远不止此, 这样的 render 函数是不能被原来的流程使用的.

vapor 的 render 函数返回了真实 dom 的数组, 而主版本的 render 函数只能返回 vnode.

并且 vapor 在 render 函数中建立了 renderEffect, 这个动作在主版本中, 是 mountComponent 做的.

再并且 vapor 的 renderEffect, 直接调用了 dom 操作的方法, 所以不会有 patch 方法, 不会有 updateComponent 的方法.

(细心的同志可能已经发现 vapor sfc 编译的 render 函数接受的参数都是不同的)

那么我们现在来理理 vapor 的运行时流程.

先从createVaporApp看起来.

```typescript
export const createVaporApp: CreateAppFunction<ParentNode, VaporComponent> = (
  comp,
  props,
) => {
  prepareApp()
  if (!_createApp) _createApp = createAppAPI(mountApp, unmountApp, getExposed)
  const app = _createApp(comp, props)
  postPrepareApp(app)
  return app
}
```

这里的`createAppAPI`是从`runtime-core`中引用的, 也就是 vapor 的 app 和主版本是一致的, 区别是`mountApp` 等方法.

(我们从这儿也看出来 vue 3 的分层设计很便于扩展)

那就来看`mountApp`:

```typescript
const mountApp: AppMountFn<ParentNode> = (app, container) => {

  const instance = createComponent(
    app._component,
    app._props as RawProps,
    null,
    false,
    app._context,
  )
  mountComponent(instance, container)

  return instance!
}

function mountComponent(
  instance: VaporComponentInstance,
  parent: ParentNode,
  anchor?: Node | null | 0,
): void {
 
  if (instance.bm) invokeArrayFns(instance.bm)
  insert(instance.block, parent, anchor)
  if (instance.m) queuePostFlushCb(() => invokeArrayFns(instance.m!))
  instance.isMounted = true
  
}
```

+ mountApp: 创建组件实例, 调用 mountComponent.
+ mountComponent: 调用 beforeMount => insert(instance.block) => mounted

`insert()`方法很简单就是插入 dom.

所以`mountApp`总结就是**创建组件实例, 并插入 dom**.

创建组件的过程就调用了前文提到编译后的 render 函数.

这个 render 函数执行后, 建立好 renderEffect, 并返回了 dom, 供 `insert()` 调用.

如果有兴趣就跟着一起看下创建组件实例:

```typescript
export function createComponent(
  component: VaporComponent,
  rawProps?: LooseRawProps | null,
  rawSlots?: LooseRawSlots | null,
  isSingleRoot?: boolean,
  appContext: GenericAppContext = (currentInstance &&
    currentInstance.appContext) ||
    emptyContext,
): VaporComponentInstance {
  const _insertionParent = insertionParent
  const _insertionAnchor = insertionAnchor

  const instance = new VaporComponentInstance(
    component,
    rawProps as RawProps,
    rawSlots as RawSlots,
    appContext,
  )

  const prev = currentInstance
  simpleSetCurrentInstance(instance)
  pauseTracking()


  const setupFn = isFunction(component) ? component : component.setup
  const setupResult = setupFn
    ? callWithErrorHandling(setupFn, instance, ErrorCodes.SETUP_FUNCTION, [
        instance.props,
        instance,
      ]) || EMPTY_OBJ
    : EMPTY_OBJ

  if (__DEV__ && !isBlock(setupResult)) {
    // ...
  } else {
    // component has a render function but no setup function
    // (typically components with only a template and no state)
    if (!setupFn && component.render) {
      instance.block = callWithErrorHandling(
        component.render,
        instance,
        ErrorCodes.RENDER_FUNCTION,
      )
    } else {
      // in prod result can only be block
      instance.block = setupResult as Block
    }
  }

  resetTracking()
  simpleSetCurrentInstance(prev, instance)

  onScopeDispose(() => unmountComponent(instance), true)

  if (!isHydrating && _insertionParent) {
    insert(instance.block, _insertionParent, _insertionAnchor)
  }

  return instance
}
```

我们关心的步骤是这几个:

1. 创建一个空的 vapor 组件实例.
2. 调用 setup 方法, 获取到 render 方法.
3. 调用 render 方法, 获取到 dom, 赋值给组件实例的 `block` 属性. (之后直接作为`insert()`的参数)

至于 setup 结果直接是 block 的情况和注释我没看懂, 按我理解这是"手动写 setup"的情况, 反而更可能出现在非 sfc 中, 而现在 vapor 是不支持非 sfc 的.

## 总结

vapor 的代码在 compiler-vapor 和 runtime-vapor, 跟主版本的区别也就在于这里.

我暂时只看到 vapor 的单独入口, 不确定现在是不是支持混合模式.

vapor 是依赖编译, 目前只能编译 sfc 和 jsx, 我感觉理论上 render 函数也能编译, 不算是绝对限制, 但太复杂了, 因为理论上vue的编译时标记也可以做, 但现在只能在sfc上. 但没关系, vapor支持混合模式.

最后, 还是想输出下自己了解了下 vapor 后的2个感受.

+ vapor 的开发离上生产还有一段距离.
+ 无 dom 很合适 vue 的情况, 但是不是在所有场景都比 vdom 好, 还需要努力.
+ 目前可能只支持 script setup, 对于组件开发不知道有没有影响.
+ 另外是不是能把 dom 操作抽出来以支持跨平台, 也挺重要的. (我觉得比支持手写 render 函数容易)
