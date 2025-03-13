---
title: vue流程梳理
categories: 工作笔记
date: 2025-03-07 14:03:36
tags: [vue,vue源码]
---
最近看面试题, 我粗看了几个网上的q&a都比较粗糙, 像是背答案, 逻辑连不起来.

所以打算总结一下vue的启动与更新流程.

<!--more-->

全文的内容围绕`createApp(App).mount('#app')`做了什么.

先以最简单的流程, 渐进式深入.

## 简要流程

### vue为开发者做了什么

为什么我们要使用前端框架? 因为可以更容易的维护代码.

各类框架会比较性能, 而性能最好的一定是 " js 直接操作dom ", 因为各类框架经过一番操作最后也要做这一步的.

vue 对于使代码更易维护的解决方案是什么? **UI = f ( state )**, 数据驱动界面.

每一个`状态`都对应着一个`界面`, 这是函数的定义.

而开发者要做的, 就是编写这个函数, 也就是**描述"状态"与"界面"的关系**.

当然作为前端, 界面也是自己写的. 所以在 .vue 文件中, 有 2 个部分`template`和`script`.

`template`是界面, 视图, 也就是所谓的 **view**.

`script`是描述视图与数据的关系, vue 在代码中把自己称为 "vm", 就是 **view-model**.

数据实体是 model, 这部分分给后端做了, 前端的"vm", 就是描述model 与 view 的关系.

vm 就是上个时代 mvc 中的"c", controller 的重点在"操作, 动作", vm 的重点在 view 和 model 的对应关系.

### vue的主要流程

我们写的界面就是 `template`, 其实他不是 html, 而是一个模板.

所以 vue 会把 `template` 处理成真实 dom, 并贴到页面上.

很明显的, 模板中包含了一些数据.

当这些数据改变, vue 会把改变后的数据代入模板, 并修改页面上的 dom.

到这里, 就是 vue 的全部工作了, 业务多复杂, 也就包含了"数据变化页面变化", 与"收集数据发送给服务端".

下面我们再深入一些些细节.

### 深入一点点

再深入一点点, 需要了解一些概念.

+ 虚拟 dom.

  在数据改变而需要改变 dom 的时候, 操作 dom 的成本都比较大.

  **虚拟 dom 是描述 dom 状态的 js 对象**.

  对比虚拟 dom 就是对比2个 js 对象, 算出 dom 的最小操作, 再操作 dom, 让性能最大化.

  (题外话, 如果可以不计算, 直接有办法让数据的变化操作 dom, vdom 的对比也可以节省, 关于 vapor 可能会深入看一下, 但现在 vue 的主版本还是基于 vdom 的)

+ render函数.

  vdom 是没有数据变量的, 是一个快照. 所以才能把新老 vdom 进行比较操作.

  而我们的`template`模板, 是根据包含数据变量的, 不能直接被编译成 vdom.

  `template`模板被编译成 render 函数, 这个函数是包含变量的.

  变量改变, 就可以根据变量生成新的 vdom.

  所以 **render 函数是生成 vdom 的函数, 由`template`编译而来**.

+ 组件.

  vue 应用是以组件为单位"搭积木"的.

  因为组件可以"复用", 所以我们编写的组件是"组件定义".

  在使用的时候可以被多次实例化, 形成组件实例, 组件实例是个 js 对象, 会被关联到 vue 应用实例和 dom 上.

  其实有另外组件类型是"容器型组件", 根组件(页面入口)就是这样的. (这个类型不是实现上的, 是概念上的)

+ effect.

  开始就提到, vue 的方案是 `UI = f ( state )`.

  那么当 `state` 变化的时候, 希望函数会自动执行, `UI` 就会自动变成新的.

  vue 的响应式系统写了 `effect` 函数, 在 `effect` 中执行的其他函数, 内部变量改变都会触发函数重新执行.

  大概样子就是 `effect(() => UI = f(state))`.

  这样 `state` 变化, `UI` 就自动更新. 这个 effect 称作 render effect, 粒度是组件, 这也是容器组件存在的必要性.

接下来说一下启动 vue 的流程:

+ 编译 vue 组件. 这个流程大多情况下是在打包过程中进行的.

  每个 .vue文件都是一个组件, 会被打包成一个 js 对象, 来描述组件.

  这个 js 对象的内容有2部分, `script`标签返回的内容, 和由 `template` 编译过来的 render 函数.

+ 创建 vue 应用.

  vue 应用也是一个 js 对象, 提供了一些 api, 并包含了我们编写的页面.

+ 挂载应用.

  挂载流程从根组件开始.

  执行组件描述对象的 render 函数, 获取到 vdom. (组件描述对象是从 .vue文件编译来的)

  遍历 vdom, 根据 vdom的类型, 创建真实 dom, 贴到挂载目标上.

  如果 vdom 类型是组件, 就递归执行挂载动作.

+ 更新视图.

  刚才挂载的流程其实都被包裹在 effect 中.

  在运行环境中的 reactive 变量与 data, props 变化了, 就会引起 组件的 effect 运行.

  effect 运行内容是执行 render 函数, 获取到新的 vdom.

  把新老 vdom 进行比较, 判断出需要更改的 dom, 进行 dom 操作.

## 细节

上面的内容都是经过简化的, 实际的 vue 使用还有很多分支.

下面会深入一些, 介绍更细节的东西, 也会介绍更多的分支情况.

### vue app

通过 `createApp()` 创建的 `app` 是个 js 对象, 有这些属性:

+ _component. 应用的根组件. 也就是整个应用树.
+ _container. 应用挂载的目标 dom 节点. 在创建时是空, `mount()`的时候被赋值.
+ _context. 存放很多应用的信息: config / components / directives / mixins / provide.
+ _instance. 把跟组件实例暴露给 devtools 交互.

有这些方法: `use`, `mixin`, `component`, `directive`, `mount`, `unmount`, `onUnmount`, `provide`, `runWithContext`.

这些方法大家都很熟悉, 都是向实例或上下文添加内容, 供后面的流程使用.

启动后面流程的方法是`mount()`

### mount与patch

`mount()`做的事是把根组件转成 vdom, 区分 ssr 环境, 最后把 vdom 交给 `patch()`.

`patch()`其实就是大家老说的所谓的 diff, 所以自然会接受新老 vdom 这2个参数来进行比较.

他做的大多数事情并不复杂, 复杂的2个点是涉及到"组件"与"子元素是数组"的情况, 这2个情况后面单独讲.

这里就顺着代码看`patch()`做了什么:

```typescript
const patch: PatchFn = (
    n1,
    n2,
    // ...
  ) => {
    if (n1 === n2) {
      return
    }

    // patching & not same type, unmount old tree
    if (n1 && !isSameVNodeType(n1, n2)) {
      anchor = getNextHostNode(n1)
      unmount(n1, parentComponent, parentSuspense, true)
      n1 = null
    }

    if (n2.patchFlag === PatchFlags.BAIL) {
      optimized = false
      n2.dynamicChildren = null
    }

    const { type, ref, shapeFlag } = n2
    switch (type) {
      //
    }

    // set ref
    if (ref != null && parentComponent) {
      setRef(ref, n1 && n1.ref, parentSuspense, n2 || n1, !n2)
    }
  }
```

1. 如何新老 vdom 相同, 不做处理.
2. 新老 vdom 类型不同, 卸载老的组件实例, 把"n1"设为null, 让后续代码走"新挂载"的分支.
3. 响应关闭简化 diff 的标志. 比如手动写 render 函数而不是实用 `template`.
4. 根据 vdom 的类型进行不同处理.
5. 如果设置了 `ref`, 就设置下 `ref`.

大多数 vdom 的类型都容易处理, 几乎都是"如果没老 vdom, 则插入 dom, 否则修改 dom".

如果 vdom 的类型是组件, 或者走到了 patch children 就会比较复杂.

组件和 patch children 都没有实际操作, 最后都会递归调用到真实的 vdom 类型, 并进行 dom 操作, 所以 `patch()` 的作用根据新老 vdom, 最终落地操作 dom.

下面先展开组件, 我们所说的"生命周期"和很多主流程都在组件的挂载里.

### 组件挂载

页面首次挂载, 老 vdom 为空, `processComponent()`会把挂载流程交给`mountComponent()`.

```typescript
  const mountComponent = (initialVNode, container, anchor, parentComponent, parentSuspense, namespace, optimized) => {
    const instance = (initialVNode.component = createComponentInstance(
      initialVNode,
      parentComponent,
      parentSuspense
    ));
    // ...keep-alive组件处理
    setupComponent(instance);
    if (instance.asyncDep) {
      // ...异步组件处理
    } else {
      setupRenderEffect(
        instance,
        initialVNode,
        container,
        anchor,
        parentSuspense,
        namespace,
        optimized
      );
    }
  };
```

可以看到关键的代码分为这三步:

1. 创建组件实例, 并挂到`vnode`的`component`属性上.

   在一些流程中, 组件实例会被设置为`currentInstance`, 是 composition api 让业务逻辑更容易抽取的解决方案.

   而要获取实例, 以及相关的变量关系是:

   dom => dom._vnode (vnode) => vnode.component (component实例), vnode.type (component定义)

2. 进行组件的`setup`.

   `setup()`作用是为`render 函数`做准备的.

   `render()`的作用是每次运行会返回最新的`vnode`, 把最新的`vnode`与老的一起给`patch()`, 就可以进行`diff`最后操作dom.

   `setup()`只会执行一次, 而`render 函数`在每次更新组件都会执行.

   `setup()`的形式有很多种:

   + 最常见的 sfc 是返回 js 对象, 作为`template`的执行环境`instance.setupState`.
   + 异步组件会返回`promise`. 作用也是为`render()`的执行做准备.
   + 如果直接返回了`render 函数`, 就直接赋值给`instance.render`.

3. 创建组件的`render-effect`.

   (effect 的作用, 下面一节会详细展开)

   `effect`的内容是执行`render()`函数, 获取到`vnode`, 并且`patch()`.

   然后把`effect`挂到组件实例上, 再给组件实例挂个`update()`方法, 就是执行一下`effect.run()`.

挂载组件已经结束.

最后说的 `render-effect` 中的数据变化, 触发了 `effect` 运行时, `patch()` 的 "n1"参数就有值了.

此时就会走到`updateComponent`, 这时候就会直接执行组件实例的`update()`方法, 并且把老`vnode`上的组件实例赋值给新`vnode`, 而这个`vnode`会在`effect`执行的时候被挂到组件实例的`subTree`上.

### 生命周期函数

组件的生命周期都在`update`函数中, 每次执行`effect`都会触发, 我们仔细观察下生命周期和其他关键步骤的调用顺序.

```typescript
const componentUpdateFn = () => {
      if (!instance.isMounted) {
        const { el, props } = initialVNode
        const { bm, m, parent, root, type } = instance
        // beforeMount hook
        if (bm) {
          invokeArrayFns(bm)
        }
        if (el && hydrateNode) {
          // hydrate code...
        } else {
          const subTree = (instance.subTree = renderComponentRoot(instance))
          patch(
            null,
            subTree,
            container,
            anchor,
            instance,
            parentSuspense,
            namespace,
          )
          initialVNode.el = subTree.el
        }
        // mounted hook
        if (m) {
          queuePostRenderEffect(m, parentSuspense)
        }
        // activated hook for keep-alive roots.
        // #1742 activated hook must be accessed after first render
        // since the hook may be injected by a child keep-alive
        if (
          initialVNode.shapeFlag & ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE ||
          (parent &&
            isAsyncWrapper(parent.vnode) &&
            parent.vnode.shapeFlag & ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE)
        ) {
          instance.a && queuePostRenderEffect(instance.a, parentSuspense)
        }
        instance.isMounted = true
        // #2458: deference mount-only object parameters to prevent memleaks
        initialVNode = container = anchor = null as any
      } else {
        let { next, bu, u, parent, vnode } = instance
        // updateComponent
        if (next) {
          next.el = vnode.el
          updateComponentPreRender(instance, next, optimized)
        } else {
          next = vnode
        }
        // beforeUpdate hook
        if (bu) {
          invokeArrayFns(bu)
        } 
        // render
        const nextTree = renderComponentRoot(instance)
        const prevTree = instance.subTree
        instance.subTree = nextTree
        patch(
          prevTree,
          nextTree,
          // parent may have changed if it's in a teleport
          hostParentNode(prevTree.el!)!,
          // anchor may have changed if it's in a fragment
          getNextHostNode(prevTree),
          instance,
          parentSuspense,
          namespace,
        )
        next.el = nextTree.el
        // updated hook
        if (u) {
          queuePostRenderEffect(u, parentSuspense)
        }
      }
    }
```

根据组件是第一次挂载还是更新, 分成2个大分支:

+ 挂载:

  触发生命周期`beforeMount` => `patch()` => 触发生命周期`mounted`.

  另外处理了`keepAlive`组件, 在这些动作后又触发了`activated`.

+ 更新:

  触发生命周期`beforeUpdate` => patch() => 触发生命周期`updated`.

上面已经提到 `patch()` 的作用是落地操作 dom, 所以 "before" 的钩子和 "ed" 钩子区别是 dom 存不存在 / dom 是不是新的.

另外, 如果 `patch()` 的 vdom 里包含组件, 那么父子组件的生命周期函数触发顺序, 也可以很清楚的知道了.

再另外, vue 3 是没有 `beforeCreated` 和 `created` 的. 他们是在 `finishComponentSetup` 的 `applyOptions` 中调用的, 也就是 `created` 的钩子的意义就是"组件实例拥有了options中的属性(如data, props, method等)"的意思.

这些属性访问都只是`setup()`返回值的执行上下文, 所以就没意义了.

如果又写`setup()`又写了`created`钩子, 那么`setup()`是先执行的, 原因上面说了, `created`相关钩子是在`finisComponentSetup`中调用的, 此时`setup()`已经运行完了.

### patchChildren

上面提到, patch children 只是 patch 流程的一个分支.

只有当新老 vdom 都是数组的时候, 才进入这个面试题里.

(其实还会被 patchFlag 过滤一波, 但只有 sfc 才能享受编译时打标签的优化)

源码的注释写得非常体贴, 所以我就模仿源码中的注释来写例子.

+ 去头去尾

  (a b) i j k (c d)
  (a b) x y z (c d)

  找出头尾可以复用的dom, 只patch他们的attributes, 减少diff范围.

  具体方法:
  两次遍历. 分别用1跟指针和2跟指针(数组长度可能不同, 去尾的时候需要2跟指针)
  循环判断指针节点是否可复用.
  如果可以, patch他们的attributes, 并移动指针.
  如果不可以复用. 停止指针.
  最后得到3个指针. 来判断需要进一步diff的内容.

+ 简单的情况: 纯新增或减少

  (a b) c
  (a b)

  或

  (a b)
  (a b) c

  需要diff的内容有一边是完全没有的情况, 只需要新增或卸载节点就可以了.

  具体方法:
  判断指针是否重合, 可以判断出是否有一边的数组被完全处理完了.
  如果新数组的指针还为重合, 循环2个指针中间的索引, 逐个新增.
  反之逐个卸载.

+ 新老数组都还有长度

  a b [c d e] f g
  a b [e d c h] f g

  面对这2个序列, 我们要做的事有3个:

  1. 找出可以复用, 并不需要移动的元素, patch他们的attributes.
  2. 移动可以复用但需要移动的元素, patch他们的attributes.
  3. 新增或卸载节点.
  4. 如果需要移动节点, 则移动节点.

  具体方法:

  1. 遍历新数组, 创建一个新数组的key-value的map`keyToNewIndexMap`.
  2. 创建一个数组`newIndexToOldIndexMap`, 长度为新数组的长度, 内容是"新元素在老数组里是第几个", 初始值为0. 代表"新元素在老数组里不存在"
  3. 遍历老数组, 利用第一步创建的`keyToNewIndexMap`寻找每个老元素是否有对应的新数组.
  4. 如果老元素在新数组中存在, patch这个元素的attributes, 并更新第二步创建的`newIndexToOldIndexMap`.
  5. 如果老元素在新数组中不存在, 则卸载当前老元素.
  6. 建立一个变量来计数被patch的数量, 如果新元素已经都被patch, 就卸载当前老元素.(这个算算法优化)
  7. 建立一个变量`moved`, 初始值为false, 如果每次从`keyToNewIndexMap`取出的不是递增, 就将`moved`设为true, 后续根据`moved`来判断是否移动节点.
  8. 至此, 老元素的卸载已完成, 并且我们获得了每个新元素对应了哪个老元素的信息`newIndexToOldIndexMap`.
  9. 从`newIndexToOldIndexMap`里获取一个最长递增子序列. 意义是: 新数组和最长递增子序列重合的部分是不需要移动的. (lss: longest stable subsequence)
  10. 反向遍历新数组. 同时增加一根lss的指针, 一起遍历.
  11. 如果新元素符合lss, 则不动. 并向上移动lss的指针.
  12. 如果新元素在`newIndexToOldIndexMap`里的索引是0, 则新增元素.
  13. 如果都不是, 则将这个新元素移动到当前的指针位置.

### effect

上面已经提到了`effect`的概念, 如果忘记了建议回去看一下, 这一节展开一下实现原理.

想实现" state 变化, 自动执行 UI = f ( state ) 更新页面", 把这种"变化触发执行"叫做`effect`.

那么**如何知道 state 变化呢? 就要拦截 state 的 setter 方法**.

另外**如何知道`effect`执行要响应哪些变量? 那就拦截 state 的 getter 方法**, 第一次执行就会走一遍所有需要监听的变量的 getter 方法.

于是业务代码就是这样的:

```js
const state = reactive(data)
effect(() => {
  UI = f(state)
})
```

`reactive()`声明 data 变量是需要被响应的.

`effect()`包裹的内容, 是需要在"响应变量"变化时, 重新执行的.

现在再展开一下 `reactive` 与 `effect` 的实现.

+ `reactive` 的工作就是拦截 `data` . 分别是 setter 和 getter.

  拦截 setter 方法, 去触发 `effect` 执行, 这个叫 `trigger`.

  拦截 getter 方法, 记录什么变量应该触发什么函数的执行, 这个叫 `track`.

  具体如何记录, 是和 `effect` 配合的.

+ 因为 `effect` 执行的时候, 一定会触发"响应式变量"的 getter 方法.

  所以在 getter 方法中, 把当前变量与"正在执行的函数"关联起来, 以便 setter 触发的时候找到需要执行的函数.

`reactive`和`effect`分别就是"依赖"(dep), 和"订阅"(sub).

在 vue 中, 执行"依赖"的函数还有 `ref`, `shallowRef`, `shallowReactive`等, 他们的核心在于调用 `track` 和`trigger`, 在 vue 2 中好像叫`dep()`方法.

执行"订阅"的函数还有`watch`系列, `computed`等, 他们的相同实现都是设置`currentEffect`, 再调用触发 `getter` 来收集依赖. 所以`track`里也会先判断是否有`currentEffect`, 在`effect`外被取值不需要进入这个逻辑.

到这里, `effect` 已经说完了, 详细的在以往的文章里有, 所有版本的 vue 响应式都是这个思路, 细节上有所不同:

+ vue2 的拦截方式不同, 还需要拦截数组方法, 以及提供 set, delete 的 api 以覆盖业务场景.
+ dep 和 sub 的关系记录的地方不同. vue2 记录在 data 的属性里, 类似"dep", "_ob"的属性. vue3 记录在全局的 weakMap中. vue3.5 重构放到双向链表中来提高性能.
+ 还有 vue2, vue3 的调用方法, 函数名字, api 的不同.

## 最后

很明显的, 这里的细节也不是很细节.

这篇 post 的目的是从大方向看, 把 vue 的流程看简单.

也算是把网上其他 q&a 整体串起来, 便于真正理解.

上面提到的细节, 在以往的 post 都有贴代码更深入介绍.
