---
title: 从provide和inject聊一下vue3的use
categories: 工作笔记
date: 2024-12-14 13:59:55
tags: [vue]
---
接上次看`vue-router`看到了`provide`和`inject`, 觉得应该比较简单, 打算看一下实现.

过程中发现`provide`, `inject`与其他一些 api 比如`onMounted`, `onUnmounted`是不能在异步结果中调用的. (更不能在setup外调用)

另外`provide`的时候可不可以`inject`到自己也不太确定. (虽然文档里都说得很明确)

<!--more-->

## provide/inject用法

普通的用法就是`provide(key, value)`, 这样是子孙组件中就可以通过`inject(key)`获取到`value`了.

需要注意的是这需要在`setup()`中同步调用. 其实`inject()`也是一样的, 只是取值不会有异步场景所以文档中没提示.

`setup()`是组件里的, 而在插件中不是一定加载组件的, 所以还有所谓"app level provide", 方式就是`app.provide(key, value)`.

先从比较简单的app-level provide开始.

## app-level provide

```typescript
function createApp(rootComponent, rootProps = null) {
    // ...option api兼容和其他app方法用到的变量声明
    const context = {
      // ...
      app: null as any,
      provides: Object.create(null),
    }
    // ...
    const app: App = (context.app = {
      _context: context,
      // ...use, directive, component等方法
      mount(
        rootContainer: HostElement,
        isHydrate?: boolean,
        namespace?: boolean | ElementNamespace,
      ): any {
        if (!isMounted) {
          const vnode = app._ceVNode || createVNode(rootComponent, rootProps)
          // store app context on the root VNode.
          // this will be set on the root instance on initial mount.
          vnode.appContext = context
          // ...mount流程
      },
      provide(key, value) {
        context.provides[key as string | symbol] = value
        return app
      },
      runWithContext(fn) {
        const lastApp = currentApp
        currentApp = app
        try {
          return fn()
        } finally {
          currentApp = lastApp
        }
      },
    })
    return app
  }
```

这个是我们启动vue流程要调用的`createApp()`, 他返回的`app`对象中的`provide()`方法非常简单, 就是把键值写到`context.provides`里.

而这个`context`可以从`app._context`, 或者是根节点的`vnode`的`appContext`里获取到.

这个`vnode`又会被`mount()`后续的动作传到后面的子组件实例里. 

## inject

`provide`设置的内容放在了`app._context`中, 我们看一下`inject`是如何取到的.

```typescript
export function inject(
  key: InjectionKey<any> | string,
  defaultValue?: unknown,
  treatDefaultAsFactory = false,
) {
  // fallback to `currentRenderingInstance` so that this can be called in
  // a functional component
  const instance = currentInstance || currentRenderingInstance

  // also support looking up from app-level provides w/ `app.runWithContext()`
  if (instance || currentApp) {
    // #2400
    // to support `app.use` plugins,
    // fallback to appContext's `provides` if the instance is at root
    // #11488, in a nested createApp, prioritize using the provides from currentApp
    const provides = currentApp
      ? currentApp._context.provides
      : instance
        ? instance.parent == null
          ? instance.vnode.appContext && instance.vnode.appContext.provides
          : instance.parent.provides
        : undefined

    if (provides && (key as string | symbol) in provides) {
      // TS doesn't allow symbol as index type
      return provides[key as string]
    } else if (arguments.length > 1) {
      // ...默认值相关
    }
  }
}
```

可以看到关键点就在于`const provides = ...`的取值, 之后就是把`provides`对应的key返回就行.

我们仔细来看`provides`的取值优先级:

1. 如果有`currentApp`就取`currentApp._context.provides`. 而`currentApp`这个变量非常明确, 只有`runWithContext()`可以调用他.

   所以这第一个情况是`runWithContext()`+`inject()`专属情况.

   接下来的情况是有`currentInstance`的, 也就是在`setup()`里调用的. (`currentRenderingInstance`是执行`render()`函数的时候设置的, 其实是同一个实例.)

2. 如果是根节点, 就取`instance.vnode.appContext.provides`. 也就是`app-level provide`设置的值.

3. 如果不是根节点, 就取`instance.parent.provides`.

看到这里就需要去了解`currentInstance`了, 因为:

+ 上面提到的(2)中, 其实我们只知道`vnode.appContext`是上面`app-level provide`的值, 但并不知道`instance`的`vnode`是如何挂上的, 挂的是不是期望的`vnode`, 没有连起来.
+ 上面提到的(3)中, `instance`的`parent`是如何挂上的, `parent`的`provides`又是什么. (不能因为`provides`名字而和上文提到的`context.provides`搞混, 名字类似并不表示他们是指到一个地址的)
+ 最重要的是`currentInstance`是什么时候被创建的, 对应的是什么实例, parent之间的数据结构又是什么.

## currentInstance的来源和相关的vue的启动流程

总结下我们现在的信息: `app.provide`是把信息存在了一个变量`context`里, `inject`取变量的时候分为三个情况, 是通过三个不同的路径取到`context`的.

其中通过`runWithContext()`从`currentApp`取`_context`, 比较明确, 而后面2个涉及到`currentInstance`这个变量, 就需要简单理一下从项目入口到调用`inject()`的过程了.

### 从入口到`patch()`

一个普通vue项目的入口大概是这样的: `createApp(App).mount('#app')`.

其中`App`从sfc编译过来是个组件声明的js对象, 有`setup`和`render`属性, 其实就对应了sfc的`script`和`template`.

`.mount()`方法是`createApp()`返回的, 本文开头有, 现在补充`.mount()`的详细内容:

```typescript
{
  mount(
      rootContainer: HostElement,
      isHydrate?: boolean,
      namespace?: boolean | ElementNamespace,
    ): any {
      if (!isMounted) {
        const vnode = app._ceVNode || createVNode(rootComponent, rootProps)
        // store app context on the root VNode.
        // this will be set on the root instance on initial mount.
        vnode.appContext = context
      	// ...hmr相关
        if (isHydrate && hydrate) {
          hydrate(vnode as VNode<Node, Element>, rootContainer as any)
        } else {
          render(vnode, rootContainer, namespace)
        }
        isMounted = true
        app._container = rootContainer

        return getComponentPublicInstance(vnode.component!)
      }
    }
}
```

我们是客户端的情况, 所以会走到`render()`, 创建`vnode`的参数`rootComponent`就是`createApp(App)`的`App`.

```js
  const render = (vnode, container, namespace) => {
    if (vnode == null) {
      if (container._vnode) {
        unmount(container._vnode, null, null, true);
      }
    } else {
      patch(
        container._vnode || null,
        vnode,
        container,
        null,
        null,
        null,
        namespace
      );
    }
    if (!isFlushing) {
      isFlushing = true;
      flushPreFlushCbs();
      flushPostFlushCbs();
      isFlushing = false;
    }
    container._vnode = vnode;
  };
```

挂载和卸载都是调用`render()`, 如果是挂载的情况, 就会调用`patch()`.

```js
 const patch = (...) => {
    if (n1 === n2) {
      return;
    }
    if (n1 && !isSameVNodeType(n1, n2)) {
      anchor = getNextHostNode(n1);
      unmount(n1, parentComponent, parentSuspense, true);
      n1 = null;
    }
    if (n2.patchFlag === -2) {
      optimized = false;
      n2.dynamicChildren = null;
    }
    const { type, ref, shapeFlag } = n2;
    switch (type) {
      case Text:
        processText(...);
        break;
      case Comment:
        processCommentNode(...);
        break;
      case Static:
        if (n1 == null) {
          mountStaticNode(...);
        } else if (!!(process.env.NODE_ENV !== "production")) {
          patchStaticNode(...);
        }
        break;
      case Fragment:
        processFragment(...);
        break;
      default:
        if (shapeFlag & 1) {
          processElement(...);
        } else if (shapeFlag & 6) {
          processComponent(...);
        } else if (shapeFlag & 64) {
          type.process(...);
        } else if (shapeFlag & 128) {
          type.process(...);
        }
    }
    if (ref != null && parentComponent) {
      setRef(ref, n1 && n1.ref, parentSuspense, n2 || n1, !n2);
    }
  };
```

`patch()`的任务是对比"上个状态"和"目标状态"的`vnode`(`n1`和`n2`)调用dom操作.

叶子节点`vnode`的`patch()`分2步:

1. 根据`vnode`的类型, 分配给不同函数处理.
2. 根据`n1`是否存在, 来判断是挂载还是`diff`. 最后进行dom操作.

而我们关心的组件, 不是叶子节点, 会交给`processComponent()`处理.

组件里最终还是会包含叶子节点的, 在经过一些处理后, 会递归调用`patch()`, 直到叶子节点, 以dom操作退出递归.

### 挂载组件

在`n1`为空的情况下, `processComponent()`会把挂载流程交给`mountComponent()`.

```js
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

   `inject()`就是从这个组件实例中获取`provides`.

   在一些流程中, 组件实例会被设置为`currentInstance`.

   而要获取实例, 以及相关的变量关系是:

   dom => dom._vnode (vnode) => vnode.component (component实例), vnode.type (component定义)

2. 进行组件的`setup`.

   `setup()`作用是为`render()`做准备的.

   `render()`的作用是每次运行会返回最新的`vnode`, 把最新的`vnode`与老的一起给`patch()`, 就可以进行`diff`最后操作dom.

   `setup()`只会执行一次, 而`render()`在每次更新组件都会执行.

   `setup()`的形式有很多种, 最常见的sfc是返回`template`的执行环境, 在一些组件里会直接返回`render()`函数, 或者是异步组件会返回`promise`. (但作用都是为`render()`的执行做准备)

3. 创建组件的`render-effect`.

   `effect`的内容是执行`render()`函数, 获取到`vnode`, 并且`patch()`. (这个流程本文前面已经提到几次了, 以前的文章里有详细说)

   然后把`effect`挂到组件实例上, 再给组件实例挂个`update()`方法, 就是执行一下`effect.run()`.

   顺带一提, `patch`组件如果有老`vnode`, 就会走到`updateComponent`, 而不是现在的`mountComponent`, 这时候就会直接执行组件实例的`update()`方法, 并且把老`vnode`上的组件实例赋值给新`vnode`, 而这个`vnode`会在`effect`执行的时候被挂到组件实例的`subTree`上.

其实讲到这里已经理清了. 如果想更清晰, 下面会贴一些这三个步骤的具体代码.

### createComponentInstance细节

```js
function createComponentInstance(vnode, parent, suspense) {
  const type = vnode.type;
  const appContext = (parent ? parent.appContext : vnode.appContext) || emptyAppContext;
  const instance = {
    // ...省略了一些属性, 保留了一些本文中提及的属性.
    type,
    parent,
    appContext,
    root: null,
    next: null,
    subTree: null,
    effect: null,
    update: null,
    render: null,
    proxy: null,
    provides: parent ? parent.provides : Object.create(appContext.provides),
  };
  // ...一些属性的初始化设置
  return instance;
}
```

在创建组件实例的时候我们细看2个点.

+ `appContext`的取值: 根节点会取`createApp()`时创建的`context`, 其余组件实例都会指向父实例.

  也就是所有组件实例挂上的是同一个`context`. 

  (可以通过在任何组件的`setup()`中打印`getCurrentInstance()`的`appContext`都是可以三等的)

+ `provides`的取值: 与`context`类似, 但根组件用`Object.create()`来创建了新对象.

  利用js原型链来使修改组件实例的`provides`不影响`context`中的, 却能取到`context`中的值.

  如果不是根节点, 就指向父节点. (但在调用`provide()`的时候会修改, 后面展开)

创建完的组件实例会被频繁的使用, 获取这个实例的方式请看上文的总结.

### setup细节

```js
function setupComponent(instance, isSSR = false) {
  isSSR && setInSSRSetupState(isSSR);
  const { props, children } = instance.vnode;
  const isStateful = isStatefulComponent(instance);
  initProps(instance, props, isStateful, isSSR);
  initSlots(instance, children);
  const setupResult = isStateful ? setupStatefulComponent(instance, isSSR) : void 0;
  isSSR && setInSSRSetupState(false);
  return setupResult;
}
```

把`vnode`上的属性同步到组件实例上, 并调用`setupStatefulComponent()`

```js
function setupStatefulComponent(instance, isSSR) {
  var _a;
  const Component = instance.type;
  instance.accessCache = /* @__PURE__ */ Object.create(null);
  instance.proxy = new Proxy(instance.ctx, PublicInstanceProxyHandlers);
  const { setup } = Component;
  if (setup) {
    const setupContext = instance.setupContext = setup.length > 1 ? createSetupContext(instance) : null;
    const reset = setCurrentInstance(instance);
    pauseTracking();
    const setupResult = callWithErrorHandling(
      setup,
      instance,
      0,
      [
        !!(process.env.NODE_ENV !== "production") ? shallowReadonly(instance.props) : instance.props,
        setupContext
      ]
    );
    resetTracking();
    reset();
    if (isPromise(setupResult)) {
      // ...异步组件的处理
    } else {
      handleSetupResult(instance, setupResult, isSSR);
    }
  } else {
    finishComponentSetup(instance, isSSR);
  }
}
```

可以看到在执行`setup()`前后分别调用了`setCurrentInstance(instance)`和`reset()`.

然后获得`setup()`的执行结果, 会在接下来的`handleSetupResult()`里来处理不同类型的结果.

```js
function handleSetupResult(instance, setupResult, isSSR) {
  if (isFunction(setupResult)) {
    if (instance.type.__ssrInlineRender) {
      instance.ssrRender = setupResult;
    } else {
      instance.render = setupResult;
    }
  } else if (isObject(setupResult)) {
    instance.setupState = proxyRefs(setupResult);
  }
  finishComponentSetup(instance, isSSR);
}
```

常用的sfc, `setup()`返回的是对象, 这个对象会作为`template`的执行环境, 会走到`instance.setupState = proxyRefs(setupResult)`

组件因为比较灵活, `setup()`可能返回`render()`函数, 会走到`instance.render = setupResult`.

(到这里已经可以猜到, 在创建`render-effect`的时候, 就会带着"`setupState`"来跑`render()`函数来获取最新的`vnode`)

到现在, sfc情况的组件实例还没有`render()`函数, 所以在`finishComponentSetup()`里处理.

```js
function finishComponentSetup(instance, isSSR, skipOptions) {
  const Component = instance.type;
  if (!instance.render) {
    if (!isSSR && compile && !Component.render) {
      const template = Component.template || resolveMergedOptions(instance).template;
      if (template) {
        const { isCustomElement, compilerOptions } = instance.appContext.config;
        const { delimiters, compilerOptions: componentCompilerOptions } = Component;
        const finalCompilerOptions = extend(
          extend(
            {
              isCustomElement,
              delimiters
            },
            compilerOptions
          ),
          componentCompilerOptions
        );
        Component.render = compile(template, finalCompilerOptions);
      }
    }
    instance.render = Component.render || NOOP;
    if (installWithProxy) {
      installWithProxy(instance);
    }
  }
}
```

可以看到给组件实例的`render()`函数赋值为`instance.render = Component.render`.

这个`Component`是组件定义对象. 按我理解, 正常的sfc走到这里, `template`已经在编译时被编译成`render()`函数了.

如果在组件定义时使用了js对象, 又手动写了`template`属性, 在这里会进行一次运行时编译. (如果引入的vue没有运行时编译, 会进行提示, 我这里没有贴这段代码)

到这里, `setup()`的任务已经做完了, 组件实例有了`render()`方法和执行环境, (执行`render()`方法后就能获得最新`vnode`), 就可以下一步建立组件的render-effect了.

### render-effect细节

```js
const setupRenderEffect = (instance, initialVNode, container, anchor, parentSuspense, namespace, optimized) => {
    const componentUpdateFn = () => {
      // ..
    };
    const effect = instance.effect = new ReactiveEffect(
      componentUpdateFn,
      NOOP,
      () => queueJob(update),
      instance.scope
      // track it in component's effect scope
    );
    const update = instance.update = () => {
      if (effect.dirty) {
        effect.run();
      }
    };
    update.id = instance.uid;
    toggleRecurse(instance, true);
    update();
  };
```

上文的总结已经提到, 建立render-effect的时候做了这几件事:

+ 创建一个`effect`, 内容是执行`render()`函数, 获取最新`vnode`, 再把新老`vnode`进行`patch()`.

  (`effect`属于响应式知识, 以前的文章有写过, `patch()`的作用前文也提到几次了)

+ 组件实例挂上这个`effect`.

+ 组件实例挂上`update()`方法, 内容是执行`effect()`. 这是便于`updateComponent`调用.

+ 立马执行这个`effect()`. (最后一行`update()`)

现在来看一下执行`render()`函数, 获取`vnode`进行`patch()`的细节:

```js
const componentUpdateFn = () => {
      if (!instance.isMounted) {
        let vnodeHook;
        const { el, props } = initialVNode;
        const { bm, m, parent } = instance;
        const isAsyncWrapperVNode = isAsyncWrapper(initialVNode);
        toggleRecurse(instance, false);
        if (bm) {
          invokeArrayFns(bm);
        }
        if (!isAsyncWrapperVNode && (vnodeHook = props && props.onVnodeBeforeMount)) {
          invokeVNodeHook(vnodeHook, parent, initialVNode);
        }
        toggleRecurse(instance, true);
        if (el && hydrateNode) {
          // ...同构渲染的情况
        } else {
          const subTree = instance.subTree = renderComponentRoot(instance);
          patch(
            null,
            subTree,
            container,
            anchor,
            instance,
            parentSuspense,
            namespace
          );
          initialVNode.el = subTree.el;
        }
        // ...后续流程, 以后再讨论
        instance.isMounted = true;
        initialVNode = container = anchor = null;
      } else {
        let { next, bu, u, parent, vnode } = instance;
        let originNext = next;
        let vnodeHook;
        toggleRecurse(instance, false);
        if (next) {
          next.el = vnode.el;
          updateComponentPreRender(instance, next, optimized);
        } else {
          next = vnode;
        }
        if (bu) {
          invokeArrayFns(bu);
        }
        if (vnodeHook = next.props && next.props.onVnodeBeforeUpdate) {
          invokeVNodeHook(vnodeHook, parent, next, vnode);
        }
        toggleRecurse(instance, true);
        const nextTree = renderComponentRoot(instance);
        const prevTree = instance.subTree;
        instance.subTree = nextTree;
        patch(
          prevTree,
          nextTree,
          // parent may have changed if it's in a teleport
          hostParentNode(prevTree.el),
          // anchor may have changed if it's in a fragment
          getNextHostNode(prevTree),
          instance,
          parentSuspense,
          namespace
        );
        next.el = nextTree.el;
        if (originNext === null) {
          updateHOCHostEl(instance, nextTree.el);
        }
      }
    };
```

根据`instance.isMounted`判断是首次挂载还是更新, 其实都调用了同一个函数`renderComponentRoot()`来根据组件实例获得`vnode`.

也调用了同样的`patch()`函数, 新建的时候"老vnode"参数为空而已.

那么更新时是怎么获取老`vnode`呢, 把`vnode`挂在`instance`的`subTree`属性下.

(组件实例还有另外个属性`vnode`是创建时就有的, 他表示组件本身, 而**组件本身其实是空, 所有组件的vnode属性的el都是空文本, 真正内容在他subTree的children里.**)

(所以推论`vnode`下的`component`(组件实例)只要不为null, 这个`component`的`type`一定是组件定义, 并且这个`vnode`的`el`一定是空文本.)

然后更新组件的时候设个临时变量简简单单操作下就好了.

最后深入看一下`renderComponentRoot`是如何执行`render()`函数获得`vnode`的

```js
function renderComponentRoot(instance) {
  const {
    // ...取了很多组件实例的属性
  } = instance;
  const prev = setCurrentRenderingInstance(instance);
  let result;
  let fallthroughAttrs;
  try {
    if (vnode.shapeFlag & 4) {
      const proxyToUse = withProxy || proxy;
      const thisProxy = proxyToUse;
      result = normalizeVNode(
        render.call(
          thisProxy,
          proxyToUse,
          renderCache,
          !!(process.env.NODE_ENV !== "production") ? shallowReadonly(props) : props,
          setupState,
          data,
          ctx
        )
      );
      fallthroughAttrs = attrs;
    } else {
      const render2 = Component;
      // ...这里让Component作为render函数, 我猜测是函数组件的case, 不是本文探究范围
    }
  } catch (err) {
    blockStack.length = 0;
    handleError(err, instance, 1);
    result = createVNode(Comment);
  }
  // ...有一段比较长的逻辑看起来不是主线, 没有贴上来
  setCurrentRenderingInstance(prev);
  return result;
}
```

可以看到在执行`render()`函数前后也设置了`CurrentRenderingInstance`, 来使上面提到的`provide/inject`系列的api生效. 但`render()`函数里调用这些api, 应该是`setup()`返回的函数, sfc不会出现这个情况.

然后用一些参数执行了`render()`函数. proxy是用来提示错误设置的, `setupState`就是在`setup`阶段准备好的`render`执行环境.

最后用`normalizeVNode()`包了一下, 交给调用方去`patch()`了.

## provide

从上文`inject()`的分析知道了三种取值, 在了解了组件实例后, 再配合组件`setup`中的`provide`看就能得出最后结论了.

```js
function provide(key, value) {
  if (!currentInstance) {
    if (!!(process.env.NODE_ENV !== "production")) {
      warn$1(`provide() can only be used inside setup().`);
    }
  } else {
    let provides = currentInstance.provides;
    const parentProvides = currentInstance.parent && currentInstance.parent.provides;
    if (parentProvides === provides) {
      provides = currentInstance.provides = Object.create(parentProvides);
    }
    provides[key] = value;
  }
}
```

从刚才`createComponentInstance()`我们可以知道, 创建组件实例的时候, `provides`就是取`parent.provides`地址的.

所以在一个`setup`里调用的第一次`provide()`, 会走到`if`里, 把当前组件实例的`provides`修改成继承`parent.provides`的对象.

这个操作在`createComponentInstance()`的`provides`属性里是有过的, 目的就是"改变自己不影响父级, 但能取到父级的值".

这样保证了`inject()`只能获取到自己祖先级的`provides`.

我们分析下根节点, 其实也是如此的: `inject()`取值是`instance.vnode.appContext.provides`, 而自己组件实例上的`provides`值是`Object.create(vnode.appContext.provides)`, 此时`provide()`取到的`provides`不是当前环境`inject()`的取值, 所以同一个`setup()`中是取不到当前环境`provide()`的值的.

## 总结

2个方面的总结.

第一是`provide/inject`的.

+ `provide/inject`是有传递方向的. 由`app.provide`, 根组件实例, 向更深的组件实例传递.
+ 同级组件实例的`setup()`中, 自己取不到自己`provide()`的值.
+ 如果位于不同2个大分支的组件实例, 是可以`provide`同一个`key`不同值的. (key是同一个Symbol也如此)

另外个总结是为了看组件实例, 对 vue3 有了一些深一些的认识.

vue3 的`composition api`为了代码的复用, 使用了这个`useXXX`的形式, 其实就是让代码在不同地方都可以取到变量, 而不需要在组件内部.

组件实例还是在的, 为了`useXXX`能准确的指到期望的实例, 就有了`currentXXX`的概念.

而设置`currentXXX`是 vue 内部流程进行的, 异步操作要注意回调执行的时候是不是已经脱离环境, 即使看起来代码是写在组件的`setup()`中的. 具体解决方案主要靠避免, 或者是调用一些 api 里预留的参数, 用`getCurrentInstance()`把实例传进去.
